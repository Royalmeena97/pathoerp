import pg from "pg";

const { Pool } = pg;

// Railway (and most hosts) inject DATABASE_URL automatically once you attach
// a Postgres service. Locally, set it in a .env file or your shell — see
// .env.example.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn(
    "WARNING: DATABASE_URL is not set. Falling back to localhost — this will fail unless you have a local Postgres running."
  );
}

export const pool = new Pool({
  connectionString: connectionString || "postgres://postgres:postgres@localhost:5432/pathoerp",
  // Most managed Postgres providers (Railway included) require SSL in
  // production but use a self-signed cert, so we relax verification there.
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
});

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS labs (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      password_hash TEXT NOT NULL,
      security_question TEXT,
      security_answer_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Safe to run repeatedly — adds the columns if this DB was created before
  // security questions existed, does nothing if they're already there.
  await pool.query(`ALTER TABLE labs ADD COLUMN IF NOT EXISTS security_question TEXT;`);
  await pool.query(`ALTER TABLE labs ADD COLUMN IF NOT EXISTS security_answer_hash TEXT;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      lab_code TEXT NOT NULL REFERENCES labs(code) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS staff_id INTEGER;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id SERIAL PRIMARY KEY,
      lab_code TEXT NOT NULL REFERENCES labs(code) ON DELETE CASCADE,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(lab_code, username)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tests (
      id SERIAL PRIMARY KEY,
      lab_code TEXT NOT NULL REFERENCES labs(code) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      tat TEXT,
      UNIQUE(lab_code, code)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      lab_code TEXT NOT NULL REFERENCES labs(code) ON DELETE CASCADE,
      name TEXT NOT NULL,
      age TEXT,
      phone TEXT,
      test_code TEXT,
      status TEXT NOT NULL DEFAULT 'Sample Collected',
      due INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id SERIAL PRIMARY KEY,
      lab_code TEXT NOT NULL REFERENCES labs(code) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      commission_percent INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Referral tracking: which doctor (if any) sent this patient, and the
  // original billed amount (kept separate from "due" so revenue reports
  // stay accurate even after a patient pays and due drops to 0).
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS amount INTEGER;`);
  // Best-effort backfill for rows created before the "amount" column existed —
  // for anyone who has already paid (due = 0) the original amount can't be
  // recovered, so those show as 0 in older reports. New patients are unaffected.
  await pool.query(`UPDATE patients SET amount = due WHERE amount IS NULL;`);

  // Free-text result notes, filled in when a report is marked ready — used
  // to generate the downloadable PDF report.
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS result TEXT;`);

  // Groups tests in the UI (e.g. "Blood Tests", "Urine Tests") once a lab's
  // test menu grows. Existing tests default to "General".
  await pool.query(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';`);
}

export const DEFAULT_TESTS = [
  { code: "CBC-01", name: "Complete Blood Count", price: 250, tat: "Same day", category: "Blood Tests" },
  { code: "LFT-02", name: "Liver Function Test", price: 600, tat: "Same day", category: "Blood Tests" },
  { code: "TSH-03", name: "Thyroid Profile (TSH)", price: 350, tat: "Next day", category: "Hormone Tests" },
  { code: "LIP-04", name: "Lipid Profile", price: 500, tat: "Same day", category: "Blood Tests" },
];

// Fixed list so both the signup dropdown and the reset flow stay in sync.
export const SECURITY_QUESTIONS = [
  "What city were you born in?",
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
];
