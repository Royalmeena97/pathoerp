import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { pool, initSchema, DEFAULT_TESTS, SECURITY_QUESTIONS } from "./db.js";
import { createSession, requireSession, requireAdmin, createOwnerSession, requireOwnerSession } from "./sessions.js";
import { isValidPhone, isValidName, isValidPassword, isValidPrice, isValidCommission } from "./validation.js";
import { streamPatientReport } from "./report.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

/* ---------- security middleware ---------- */

// Helmet sets sane default security headers (X-Content-Type-Options, HSTS, etc.)
app.use(helmet());

// CORS: in production, only allow the deployed frontend's origin(s).
// Set ALLOWED_ORIGINS as a comma-separated list, e.g.
// "https://pathoerp.up.railway.app,https://mypathoerp.com"
// If unset, falls back to allowing any origin — fine for local dev, NOT
// recommended once this is live.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);

app.use(express.json());

// Rate limit login and signup specifically — these are the endpoints someone
// could try to brute-force (a password, or spamming lab creation).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

const PORT = process.env.PORT || 4000;

/* ---------- helpers ---------- */
async function labCodeExists(code) {
  const { rows } = await pool.query("SELECT 1 FROM labs WHERE code = $1", [code]);
  return rows.length > 0;
}

async function slugify(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "").slice(0, 8) || "lab";
  let code;
  do {
    code = base + Math.floor(100 + Math.random() * 900);
  } while (await labCodeExists(code));
  return code;
}

async function getTests(labCode) {
  const { rows } = await pool.query(
    "SELECT code, name, price, tat, category FROM tests WHERE lab_code = $1 ORDER BY category, id",
    [labCode]
  );
  return rows;
}
async function getPatients(labCode) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.age, p.phone, p.test_code as test, p.status, p.due, p.amount, p.result,
            p.doctor_id, d.name as doctor_name, p.created_at
     FROM patients p
     LEFT JOIN doctors d ON p.doctor_id = d.id
     WHERE p.lab_code = $1
     ORDER BY p.created_at DESC`,
    [labCode]
  );
  return rows;
}
async function getDoctors(labCode) {
  const { rows } = await pool.query(
    "SELECT id, name, phone, commission_percent FROM doctors WHERE lab_code = $1 ORDER BY name",
    [labCode]
  );
  return rows;
}

/* ---------- lab signup / login ---------- */

// Create a new lab account
app.post("/api/labs", authLimiter, async (req, res, next) => {
  try {
    const { name, city, password } = req.body || {};
    if (!isValidName(name)) return res.status(400).json({ error: "Lab name must be 2-80 characters" });
    if (!isValidPassword(password)) return res.status(400).json({ error: "Password must be 4-72 characters" });

    // Lab name is now the login identifier, so it has to be unique — this
    // is also what lets people log in without ever needing a "lab code".
    const { rows: dup } = await pool.query("SELECT 1 FROM labs WHERE LOWER(name) = LOWER($1)", [name.trim()]);
    if (dup.length) {
      return res.status(409).json({ error: "This lab is already registered. Try logging in instead." });
    }

    const code = await slugify(name);
    const passwordHash = bcrypt.hashSync(password, 10);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // security_question / security_answer_hash are left NULL here — the
      // client prompts for them as a short follow-up step right after
      // signup (see /api/labs/:code/security-question-setup below), not on
      // the signup form itself.
      await client.query(
        `INSERT INTO labs (code, name, city, password_hash)
         VALUES ($1, $2, $3, $4)`,
        [code, name.trim(), (city || "").trim().slice(0, 80), passwordHash]
      );
      for (const t of DEFAULT_TESTS) {
        await client.query(
          "INSERT INTO tests (lab_code, code, name, price, tat, category) VALUES ($1, $2, $3, $4, $5, $6)",
          [code, t.code, t.name, t.price, t.tat, t.category]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      // 23505 = unique_violation — covers a race where two signups for the
      // same name land at the same instant and both pass the check above.
      if (e.code === "23505") {
        return res.status(409).json({ error: "This lab is already registered. Try logging in instead." });
      }
      throw e;
    } finally {
      client.release();
    }

    // The UI takes a lab straight into the admin dashboard right after
    // signup (no separate login step), so issue a session token here too.
    const token = await createSession(code);
    res.json({ code, name: name.trim(), city: (city || "").trim(), token, role: "admin", needsSecurityQuestion: true });
  } catch (err) {
    next(err);
  }
});

// Follow-up step right after signup: set the security question that will
// be used later if this lab's owner forgets their password. Kept off the
// main signup form on purpose, so that form stays short.
app.post("/api/labs/:code/security-question-setup", requireSession, requireAdmin, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { securityQuestion, securityAnswer } = req.body || {};
    if (!SECURITY_QUESTIONS.includes(securityQuestion)) {
      return res.status(400).json({ error: "Please choose a valid security question" });
    }
    if (!securityAnswer || !securityAnswer.trim()) {
      return res.status(400).json({ error: "A security answer is required (used to reset your password later)" });
    }
    const answerHash = bcrypt.hashSync(securityAnswer.trim().toLowerCase(), 10);
    await pool.query(
      "UPDATE labs SET security_question = $1, security_answer_hash = $2 WHERE code = $3",
      [securityQuestion, answerHash, code]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// The fixed list of security questions, for the signup dropdown
app.get("/api/security-questions", (req, res) => {
  res.json(SECURITY_QUESTIONS);
});

// Login to an existing lab account — issues a session token.
// :identifier is the lab NAME now (not the internal code), since that's
// what people actually remember. Case-insensitive match.
app.post("/api/labs/:identifier/login", authLimiter, async (req, res, next) => {
  try {
    const identifier = req.params.identifier.trim();
    const { password } = req.body || {};
    const { rows } = await pool.query("SELECT * FROM labs WHERE LOWER(name) = LOWER($1)", [identifier]);
    const lab = rows[0];
    if (!lab) return res.status(404).json({ error: "No lab found with that name" });
    if (!password || !bcrypt.compareSync(password, lab.password_hash)) {
      return res.status(401).json({ error: "Incorrect password" });
    }
    const token = await createSession(lab.code);
    res.json({ code: lab.code, name: lab.name, city: lab.city, token, role: "admin", needsSecurityQuestion: !lab.security_question });
  } catch (err) {
    next(err);
  }
});

// Step 1 of password reset: fetch the security question for a lab (no
// answer, no password hash — safe to expose publicly). Looked up by name.
app.get("/api/labs/:identifier/security-question", authLimiter, async (req, res, next) => {
  try {
    const identifier = req.params.identifier.trim();
    const { rows } = await pool.query("SELECT security_question FROM labs WHERE LOWER(name) = LOWER($1)", [identifier]);
    const lab = rows[0];
    if (!lab || !lab.security_question) return res.status(404).json({ error: "No lab found with that name, or it hasn't set up a security question yet" });
    res.json({ question: lab.security_question });
  } catch (err) {
    next(err);
  }
});

// Step 2 of password reset: verify the answer and set a new password.
// Looked up by name.
app.post("/api/labs/:identifier/reset-password", authLimiter, async (req, res, next) => {
  try {
    const identifier = req.params.identifier.trim();
    const { answer, newPassword } = req.body || {};
    if (!isValidPassword(newPassword)) return res.status(400).json({ error: "New password must be 4-72 characters" });

    const { rows } = await pool.query("SELECT * FROM labs WHERE LOWER(name) = LOWER($1)", [identifier]);
    const lab = rows[0];
    if (!lab || !lab.security_answer_hash) return res.status(404).json({ error: "No lab found with that name" });

    const normalizedAnswer = (answer || "").trim().toLowerCase();
    if (!normalizedAnswer || !bcrypt.compareSync(normalizedAnswer, lab.security_answer_hash)) {
      return res.status(401).json({ error: "Incorrect answer" });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await pool.query("UPDATE labs SET password_hash = $1 WHERE code = $2", [newHash, lab.code]);

    // Log them straight in after a successful reset.
    const token = await createSession(lab.code);
    res.json({ code: lab.code, name: lab.name, city: lab.city, token, role: "admin" });
  } catch (err) {
    next(err);
  }
});

/* ---------- public routes (no session needed) ---------- */

app.get("/api/labs", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT code, name, city FROM labs ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Public view of one lab: name + tests only (no patient data)
app.get("/api/labs/:code/public", async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { rows } = await pool.query("SELECT code, name, city FROM labs WHERE code = $1", [code]);
    const lab = rows[0];
    if (!lab) return res.status(404).json({ error: "Lab not found" });
    res.json({ ...lab, tests: await getTests(code) });
  } catch (err) {
    next(err);
  }
});

/* ---------- admin routes (session token required) ---------- */

app.get("/api/labs/:code", requireSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { rows } = await pool.query("SELECT code, name, city FROM labs WHERE code = $1", [code]);
    const lab = rows[0];
    if (!lab) return res.status(404).json({ error: "Lab not found" });
    res.json({ ...lab, role: req.sessionRole, tests: await getTests(code), patients: await getPatients(code), doctors: await getDoctors(code) });
  } catch (err) {
    next(err);
  }
});

// Analytics for the Overview dashboard: revenue for each of the last 7 days,
// and the 5 most-booked tests overall.
app.get("/api/labs/:code/analytics", requireSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { rows: dailyRows } = await pool.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS date, COALESCE(SUM(amount), 0)::int AS revenue
       FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS day
       LEFT JOIN patients p ON p.lab_code = $1 AND p.created_at::date = day
       GROUP BY day
       ORDER BY day`,
      [code]
    );
    const { rows: topTests } = await pool.query(
      `SELECT t.name, COUNT(p.id)::int AS count
       FROM patients p
       JOIN tests t ON t.lab_code = p.lab_code AND t.code = p.test_code
       WHERE p.lab_code = $1
       GROUP BY t.name
       ORDER BY count DESC
       LIMIT 5`,
      [code]
    );
    res.json({ dailyRevenue: dailyRows, topTests });
  } catch (err) {
    next(err);
  }
});

// Change password (must already hold a valid session, and confirm the old password)
app.post("/api/labs/:code/change-password", requireSession, requireAdmin, authLimiter, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { currentPassword, newPassword } = req.body || {};
    if (!isValidPassword(newPassword)) return res.status(400).json({ error: "New password must be 4-72 characters" });

    const { rows } = await pool.query("SELECT password_hash FROM labs WHERE code = $1", [code]);
    const lab = rows[0];
    if (!lab) return res.status(404).json({ error: "Lab not found" });
    if (!currentPassword || !bcrypt.compareSync(currentPassword, lab.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await pool.query("UPDATE labs SET password_hash = $1 WHERE code = $2", [newHash, code]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Add a new test to a lab's Test Master list
app.post("/api/labs/:code/tests", requireSession, requireAdmin, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { code: testCode, name, price, tat, category } = req.body || {};
    if (!testCode || !testCode.trim()) return res.status(400).json({ error: "Test code is required" });
    if (!isValidName(name)) return res.status(400).json({ error: "Test name must be 2-80 characters" });
    if (!isValidPrice(price)) return res.status(400).json({ error: "Price must be a whole number, 0 or more" });

    const { rows: existing } = await pool.query(
      "SELECT 1 FROM tests WHERE lab_code = $1 AND code = $2",
      [code, testCode.trim()]
    );
    if (existing.length) return res.status(409).json({ error: "A test with this code already exists" });

    const cleanCategory = (category || "").trim().slice(0, 40) || "General";
    await pool.query(
      "INSERT INTO tests (lab_code, code, name, price, tat, category) VALUES ($1, $2, $3, $4, $5, $6)",
      [code, testCode.trim(), name.trim(), price, (tat || "").trim().slice(0, 40) || "Same day", cleanCategory]
    );
    res.json({ code: testCode.trim(), name: name.trim(), price, tat: (tat || "Same day"), category: cleanCategory });
  } catch (err) {
    next(err);
  }
});

// Edit an existing test (price / name / turnaround / category)
app.patch("/api/labs/:code/tests/:testCode", requireSession, requireAdmin, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const testCode = req.params.testCode;
    const { name, price, tat, category } = req.body || {};

    const { rows } = await pool.query("SELECT * FROM tests WHERE lab_code = $1 AND code = $2", [code, testCode]);
    const test = rows[0];
    if (!test) return res.status(404).json({ error: "Test not found" });

    const nextName = name !== undefined ? name : test.name;
    const nextPrice = price !== undefined ? price : test.price;
    const nextTat = tat !== undefined ? tat : test.tat;
    const nextCategory = category !== undefined ? category : test.category;
    if (!isValidName(nextName)) return res.status(400).json({ error: "Test name must be 2-80 characters" });
    if (!isValidPrice(nextPrice)) return res.status(400).json({ error: "Price must be a whole number, 0 or more" });

    await pool.query(
      "UPDATE tests SET name = $1, price = $2, tat = $3, category = $4 WHERE lab_code = $5 AND code = $6",
      [nextName.trim(), nextPrice, (nextTat || "").trim().slice(0, 40), (nextCategory || "General").trim().slice(0, 40) || "General", code, testCode]
    );
    res.json({ code: testCode, name: nextName.trim(), price: nextPrice, tat: nextTat, category: nextCategory });
  } catch (err) {
    next(err);
  }
});

// Add a referring doctor
app.post("/api/labs/:code/doctors", requireSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { name, phone, commissionPercent } = req.body || {};
    if (!isValidName(name)) return res.status(400).json({ error: "Doctor name must be 2-80 characters" });
    const commission = commissionPercent === undefined || commissionPercent === "" ? 0 : Number(commissionPercent);
    if (!isValidCommission(commission)) return res.status(400).json({ error: "Commission must be a whole number between 0 and 100" });

    const { rows } = await pool.query(
      "INSERT INTO doctors (lab_code, name, phone, commission_percent) VALUES ($1, $2, $3, $4) RETURNING id, name, phone, commission_percent",
      [code, name.trim(), (phone || "").trim().slice(0, 20), commission]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Referral report: per doctor, how many patients they sent, total revenue
// from those patients, and the commission owed at that doctor's rate.
app.get("/api/labs/:code/referrals", requireSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { rows } = await pool.query(
      `SELECT d.id, d.name, d.phone, d.commission_percent,
              COUNT(p.id)::int AS patient_count,
              COALESCE(SUM(p.amount), 0)::int AS total_revenue
       FROM doctors d
       LEFT JOIN patients p ON p.doctor_id = d.id
       WHERE d.lab_code = $1
       GROUP BY d.id
       ORDER BY d.name`,
      [code]
    );
    const withCommission = rows.map((r) => ({
      ...r,
      commission_amount: Math.round((r.total_revenue * r.commission_percent) / 100),
    }));
    res.json(withCommission);
  } catch (err) {
    next(err);
  }
});

/* ---------- staff accounts (receptionist-style logins, admin-only management) ---------- */

// List staff accounts (usernames only, no password data)
app.get("/api/labs/:code/staff", requireSession, requireAdmin, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { rows } = await pool.query("SELECT id, username, created_at FROM staff WHERE lab_code = $1 ORDER BY username", [code]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a staff account
app.post("/api/labs/:code/staff", requireSession, requireAdmin, authLimiter, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { username, password } = req.body || {};
    if (!username || username.trim().length < 3 || username.trim().length > 40) {
      return res.status(400).json({ error: "Username must be 3-40 characters" });
    }
    if (!isValidPassword(password)) return res.status(400).json({ error: "Password must be 4-72 characters" });

    const cleanUsername = username.trim().toLowerCase();
    const { rows: existing } = await pool.query("SELECT 1 FROM staff WHERE lab_code = $1 AND username = $2", [code, cleanUsername]);
    if (existing.length) return res.status(409).json({ error: "That username is already taken for this lab" });

    const passwordHash = bcrypt.hashSync(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO staff (lab_code, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username, created_at",
      [code, cleanUsername, passwordHash]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Remove a staff account
app.delete("/api/labs/:code/staff/:id", requireSession, requireAdmin, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    await pool.query("DELETE FROM staff WHERE id = $1 AND lab_code = $2", [req.params.id, code]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Staff login — separate from the owner login above, issues a 'staff' session.
// :identifier is the lab NAME, same as owner login.
app.post("/api/labs/:identifier/staff-login", authLimiter, async (req, res, next) => {
  try {
    const identifier = req.params.identifier.trim();
    const { username, password } = req.body || {};
    const { rows: labRows } = await pool.query("SELECT code, name, city FROM labs WHERE LOWER(name) = LOWER($1)", [identifier]);
    const lab = labRows[0];
    if (!lab) return res.status(404).json({ error: "No lab found with that name" });

    const cleanUsername = (username || "").trim().toLowerCase();
    const { rows } = await pool.query("SELECT * FROM staff WHERE lab_code = $1 AND username = $2", [lab.code, cleanUsername]);
    const staffAccount = rows[0];
    if (!staffAccount || !password || !bcrypt.compareSync(password, staffAccount.password_hash)) {
      return res.status(401).json({ error: "Incorrect username or password" });
    }

    const token = await createSession(lab.code, "staff", staffAccount.id);
    res.json({ code: lab.code, name: lab.name, city: lab.city, token, role: "staff" });
  } catch (err) {
    next(err);
  }
});

app.post("/api/labs/:code/patients", requireSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { name, age, phone, test, doctorId } = req.body || {};
    const exists = await labCodeExists(code);
    if (!exists) return res.status(404).json({ error: "Lab not found" });
    if (!isValidName(name)) return res.status(400).json({ error: "Patient name must be 2-80 characters" });
    if (!isValidPhone(phone)) return res.status(400).json({ error: "Phone must be a valid 10-digit number" });
    if (!test) return res.status(400).json({ error: "Test is required" });

    const { rows: testRows } = await pool.query(
      "SELECT * FROM tests WHERE lab_code = $1 AND code = $2",
      [code, test]
    );
    const testRow = testRows[0];
    if (!testRow) return res.status(400).json({ error: "Unknown test for this lab" });

    let doctorIdValue = null;
    if (doctorId) {
      const { rows: docRows } = await pool.query("SELECT id FROM doctors WHERE id = $1 AND lab_code = $2", [doctorId, code]);
      if (!docRows[0]) return res.status(400).json({ error: "Unknown referring doctor for this lab" });
      doctorIdValue = docRows[0].id;
    }

    const id = "P-" + Math.floor(1000 + Math.random() * 9000);
    const amount = testRow.price;

    await pool.query(
      `INSERT INTO patients (id, lab_code, name, age, phone, test_code, status, due, amount, doctor_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'Sample Collected', $7, $8, $9)`,
      [id, code, name.trim(), (age || "-").toString().slice(0, 10), phone.trim(), test, amount, amount, doctorIdValue]
    );

    res.json({ id, name: name.trim(), age: age || "-", phone: phone.trim(), test, status: "Sample Collected", due: amount, amount, doctorId: doctorIdValue });
  } catch (err) {
    next(err);
  }
});

// Update a patient — mark report ready and/or mark payment received
app.patch("/api/labs/:code/patients/:id", requireSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { id } = req.params;
    const { status, due, result } = req.body || {};

    const { rows } = await pool.query(
      "SELECT * FROM patients WHERE id = $1 AND lab_code = $2",
      [id, code]
    );
    const patient = rows[0];
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const allowedStatuses = ["Sample Collected", "Pending", "Report Ready"];
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }
    if (due !== undefined && !isValidPrice(due)) {
      return res.status(400).json({ error: "Due must be a whole number, 0 or more" });
    }
    if (result !== undefined && typeof result === "string" && result.length > 4000) {
      return res.status(400).json({ error: "Result notes are too long (max 4000 characters)" });
    }

    const nextStatus = status !== undefined ? status : patient.status;
    const nextDue = due !== undefined ? due : patient.due;
    const nextResult = result !== undefined ? result : patient.result;
    await pool.query(
      "UPDATE patients SET status = $1, due = $2, result = $3 WHERE id = $4 AND lab_code = $5",
      [nextStatus, nextDue, nextResult, id, code]
    );

    res.json({ ...patient, status: nextStatus, due: nextDue, result: nextResult, test: patient.test_code });
  } catch (err) {
    next(err);
  }
});

// Downloadable/printable PDF report for a patient whose report is ready
app.get("/api/labs/:code/patients/:id/report", requireSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { id } = req.params;

    const { rows: labRows } = await pool.query("SELECT name, city FROM labs WHERE code = $1", [code]);
    const lab = labRows[0];
    if (!lab) return res.status(404).json({ error: "Lab not found" });

    const { rows: patientRows } = await pool.query(
      `SELECT p.*, d.name AS doctor_name
       FROM patients p
       LEFT JOIN doctors d ON p.doctor_id = d.id
       WHERE p.id = $1 AND p.lab_code = $2`,
      [id, code]
    );
    const patient = patientRows[0];
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    if (patient.status !== "Report Ready") {
      return res.status(400).json({ error: "This report isn't marked ready yet" });
    }

    const { rows: testRows } = await pool.query("SELECT code, name FROM tests WHERE lab_code = $1 AND code = $2", [code, patient.test_code]);
    const test = testRows[0];

    streamPatientReport(res, { lab, patient, test, doctorName: patient.doctor_name });
  } catch (err) {
    next(err);
  }
});

// CSV export of the patients list (works for both the Patients and Billing
// views — the client just downloads whichever rows it already has).
app.get("/api/labs/:code/patients/export.csv", requireSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const patients = await getPatients(code);
    const tests = await getTests(code);
    const testName = (c) => tests.find((t) => t.code === c)?.name || c;

    const escape = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["Patient ID", "Name", "Age", "Phone", "Test", "Referring Doctor", "Status", "Amount", "Due", "Registered On"];
    const lines = [header.join(",")];
    for (const p of patients) {
      lines.push([
        p.id, p.name, p.age, p.phone, testName(p.test), p.doctor_name || "Walk-in",
        p.status, p.amount, p.due, new Date(p.created_at).toLocaleDateString("en-IN"),
      ].map(escape).join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="patients-${code}.csv"`);
    res.send(lines.join("\n"));
  } catch (err) {
    next(err);
  }
});

/* ---------- platform owner panel (hidden super-admin, not linked from the UI) ---------- */
// Set OWNER_PASSWORD as an environment variable on your host (Railway →
// Variables). This is separate from any lab's password.
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || null;
if (!OWNER_PASSWORD) {
  console.warn("WARNING: OWNER_PASSWORD is not set — the owner panel login will always fail until you set it.");
}

app.post("/api/owner/login", authLimiter, async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!OWNER_PASSWORD || !password || password !== OWNER_PASSWORD) {
      return res.status(401).json({ error: "Incorrect password" });
    }
    const token = await createOwnerSession();
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

// All labs, with a couple of at-a-glance counts — used for the owner's
// lab list and for account recovery (find a lab, then reset its password).
app.get("/api/owner/labs", requireOwnerSession, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.code, l.name, l.city, l.created_at, (l.security_question IS NOT NULL) AS has_security_question,
              (SELECT COUNT(*) FROM patients p WHERE p.lab_code = l.code)::int AS patient_count,
              (SELECT COUNT(*) FROM staff s WHERE s.lab_code = l.code)::int AS staff_count
       FROM labs l
       ORDER BY l.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Passwords are hashed (bcrypt), so the original can never be shown again —
// this sets a brand-new one instead, which the owner then shares with the
// lab. That's the real-world equivalent of "recovering" access.
app.post("/api/owner/labs/:code/reset-password", requireOwnerSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { newPassword } = req.body || {};
    if (!isValidPassword(newPassword)) return res.status(400).json({ error: "New password must be 4-72 characters" });
    const newHash = bcrypt.hashSync(newPassword, 10);
    const { rowCount } = await pool.query("UPDATE labs SET password_hash = $1 WHERE code = $2", [newHash, code]);
    if (!rowCount) return res.status(404).json({ error: "Lab not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Deletes a lab and everything under it (tests, patients, doctors, staff,
// sessions all cascade via their foreign keys). Irreversible.
app.delete("/api/owner/labs/:code", requireOwnerSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { rowCount } = await pool.query("DELETE FROM labs WHERE code = $1", [code]);
    if (!rowCount) return res.status(404).json({ error: "Lab not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Staff usernames for one lab, plus the ability to reset a staff member's
// password the same way as above.
app.get("/api/owner/labs/:code/staff", requireOwnerSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { rows } = await pool.query("SELECT id, username, created_at FROM staff WHERE lab_code = $1 ORDER BY username", [code]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.post("/api/owner/labs/:code/staff/:id/reset-password", requireOwnerSession, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toLowerCase();
    const { newPassword } = req.body || {};
    if (!isValidPassword(newPassword)) return res.status(400).json({ error: "New password must be 4-72 characters" });
    const newHash = bcrypt.hashSync(newPassword, 10);
    const { rowCount } = await pool.query(
      "UPDATE staff SET password_hash = $1 WHERE id = $2 AND lab_code = $3",
      [newHash, req.params.id, code]
    );
    if (!rowCount) return res.status(404).json({ error: "Staff account not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

/* ---------- serve the built frontend (single-service deploy) ---------- */
// If client/dist exists (produced by `npm run build` in client/), serve it
// from this same server. This lets you deploy just ONE Railway service
// instead of hosting the frontend separately.
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));
app.get(/^\/(?!api).*/, (req, res, next) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next(); // no build present (e.g. local dev) — fall through to 404
  });
});

// Basic error handler so a DB hiccup returns JSON, not an HTML stack trace
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`PathoERP API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database schema:", err);
    process.exit(1);
  });