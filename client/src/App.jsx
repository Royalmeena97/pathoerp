import React, { useState, useEffect } from "react";
import { createLab, loginLab, staffLogin, listLabs, getLabPublic, getLabFull, addPatient, updatePatient, addTest, updateTest, addDoctor, getReferrals, changePassword, getSecurityQuestion, resetPassword, getAnalytics, getStaffList, addStaff, removeStaff, downloadReport, clearSession } from "./api.js";

// Must match server/src/db.js SECURITY_QUESTIONS exactly.
const SECURITY_QUESTIONS = [
  "What city were you born in?",
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
];

/* ---------------------------------------------------------
   Design tokens
--------------------------------------------------------- */
const T = {
  bg: "#F5F3EC",
  ink: "#1C2321",
  sub: "#5C6A63",
  line: "#DFDBCD",
  card: "#FFFFFF",
  teal: "#1F4B4A",
  amber: "#C98A3C",
  green: "#4E7C59",
  red: "#B5493F",
};

const inp = {
  display: "block",
  width: "100%",
  marginTop: 5,
  padding: "9px 10px",
  border: `1px solid ${T.line}`,
  borderRadius: 6,
  fontSize: 13.5,
  color: T.ink,
  boxSizing: "border-box",
};

/* ---------------------------------------------------------
   Shared bits
--------------------------------------------------------- */
function StatusPill({ status }) {
  const map = { "Report Ready": T.green, Pending: T.amber, "Sample Collected": T.teal };
  const c = map[status] || T.sub;
  return (
    <span style={{ color: c, border: `1px solid ${c}55`, background: `${c}14`, padding: "3px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}
function Card({ label, value, accent }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: "18px 20px", flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontSize: 30, color: accent || T.ink, marginTop: 6, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
function Table({ cols, rows }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr style={{ background: T.bg }}>
            {cols.map((c) => <th key={c} style={{ textAlign: "left", padding: "10px 16px", color: T.sub, fontWeight: 600, fontSize: 12, borderBottom: `1px solid ${T.line}` }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} style={{ padding: 16, color: T.sub, fontSize: 13 }}>Nothing here yet.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.line}` : "none" }}>
              {r.map((cell, j) => <td key={j} style={{ padding: "11px 16px" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------
   Landing / onboarding
--------------------------------------------------------- */
function Landing({ onLabReady, onPatientMode }) {
  const [mode, setMode] = useState("new"); // new | existing | staff | forgot
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [code, setCode] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [staffUsername, setStaffUsername] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Forgot-password flow: step 1 asks for the code, step 2 shows the
  // question and collects the answer + new password.
  const [forgotCode, setForgotCode] = useState("");
  const [forgotQuestion, setForgotQuestion] = useState(null);
  const [forgotAnswer, setForgotAnswer] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");

  async function createLabHandler(e) {
    e.preventDefault();
    if (!name.trim() || !password.trim() || !securityAnswer.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const lab = await createLab({ name, city, password, securityQuestion, securityAnswer });
      onLabReady(lab.code, lab.role);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function loginLabHandler(e) {
    e.preventDefault();
    if (!code.trim() || !loginPassword.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const lab = await loginLab(code.trim().toLowerCase(), loginPassword);
      onLabReady(lab.code, lab.role);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function staffLoginHandler(e) {
    e.preventDefault();
    if (!code.trim() || !staffUsername.trim() || !staffPassword.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const lab = await staffLogin(code.trim().toLowerCase(), staffUsername, staffPassword);
      onLabReady(lab.code, lab.role);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function fetchQuestionHandler(e) {
    e.preventDefault();
    if (!forgotCode.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const { question } = await getSecurityQuestion(forgotCode.trim().toLowerCase());
      setForgotQuestion(question);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPasswordHandler(e) {
    e.preventDefault();
    if (!forgotAnswer.trim() || !forgotNewPassword.trim()) return;
    if (forgotNewPassword !== forgotConfirm) {
      setErr("New passwords don't match");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const lab = await resetPassword(forgotCode.trim().toLowerCase(), forgotAnswer, forgotNewPassword);
      onLabReady(lab.code, lab.role);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(k) {
    setMode(k);
    setErr("");
    setForgotQuestion(null);
    setForgotCode("");
    setForgotAnswer("");
    setForgotNewPassword("");
    setForgotConfirm("");
    setStaffUsername("");
    setStaffPassword("");
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", color: T.ink }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 40px", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 700, fontSize: 19 }}>
          Nirikshan<span style={{ color: T.teal }}>Lab</span>
        </div>
        <button onClick={onPatientMode} style={{ background: T.teal, color: "#fff", border: "none", padding: "9px 18px", borderRadius: 7, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          Book a test as patient
        </button>
      </header>

      <section style={{ display: "flex", gap: 50, padding: "60px 40px", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 380px", minWidth: 300 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontSize: 38, lineHeight: 1.15, fontWeight: 600, letterSpacing: -0.5, margin: 0 }}>
            Run your pathology lab without the paper trail.
          </h1>
          <p style={{ fontSize: 15.5, color: T.sub, marginTop: 16, lineHeight: 1.6, maxWidth: 460 }}>
            Registration, sample tracking, billing and a patient booking page — one account per lab,
            data saved to a real database on the server.
          </p>
          <div style={{ display: "flex", gap: 28, marginTop: 30, color: T.sub, fontSize: 13.5 }}>
            <div><b style={{ color: T.ink }}>Free</b> to try</div>
            <div><b style={{ color: T.ink }}>Password</b> protected</div>
            <div><b style={{ color: T.ink }}>Multi-lab</b> ready</div>
          </div>
        </div>

        <div style={{ flex: "1 1 340px", minWidth: 300, maxWidth: 380, background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 24 }}>
          {mode !== "forgot" && mode !== "staff" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[["new", "Start a new lab"], ["existing", "I already have a lab"]].map(([k, l]) => (
                <button key={k} onClick={() => switchMode(k)} style={{
                  flex: 1, padding: "8px 6px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${T.line}`, background: mode === k ? T.teal : "transparent", color: mode === k ? "#fff" : T.ink,
                }}>{l}</button>
              ))}
            </div>
          )}

          {mode === "new" && (
            <form onSubmit={createLabHandler} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Lab name
                <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ashirwad Diagnostics" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                City
                <input style={inp} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Ghaziabad" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Password
                <input style={inp} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 4 characters" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Security question <span style={{ fontWeight: 400, color: T.sub }}>(used if you forget your password)</span>
                <select style={inp} value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)}>
                  {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Your answer
                <input style={inp} value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} placeholder="Remember this answer!" />
              </label>
              <button disabled={busy} type="submit" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
                {busy ? "Creating..." : "Create lab account"}
              </button>
            </form>
          )}

          {mode === "existing" && (
            <form onSubmit={loginLabHandler} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Lab code
                <input style={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ashirw482" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Password
                <input style={inp} type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Your lab password" />
              </label>
              <button disabled={busy} type="submit" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
                {busy ? "Checking..." : "Continue"}
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <button type="button" onClick={() => switchMode("forgot")} style={{ background: "none", border: "none", color: T.teal, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  Forgot password?
                </button>
                <button type="button" onClick={() => switchMode("staff")} style={{ background: "none", border: "none", color: T.sub, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  Staff login →
                </button>
              </div>
            </form>
          )}

          {mode === "staff" && (
            <form onSubmit={staffLoginHandler} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Staff login</div>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Lab code
                <input style={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ashirw482" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Username
                <input style={inp} value={staffUsername} onChange={(e) => setStaffUsername(e.target.value)} placeholder="Given to you by the lab owner" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Password
                <input style={inp} type="password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} />
              </label>
              <button disabled={busy} type="submit" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
                {busy ? "Checking..." : "Continue"}
              </button>
              <button type="button" onClick={() => switchMode("existing")} style={{ background: "none", border: "none", color: T.sub, fontSize: 12.5, cursor: "pointer", padding: 0, textAlign: "left", marginTop: 2 }}>
                ← Back to owner login
              </button>
            </form>
          )}

          {mode === "forgot" && !forgotQuestion && (
            <form onSubmit={fetchQuestionHandler} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Reset password</div>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Lab code
                <input style={inp} value={forgotCode} onChange={(e) => setForgotCode(e.target.value)} placeholder="e.g. ashirw482" />
              </label>
              <button disabled={busy} type="submit" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
                {busy ? "Checking..." : "Continue"}
              </button>
              <button type="button" onClick={() => switchMode("existing")} style={{ background: "none", border: "none", color: T.sub, fontSize: 12.5, cursor: "pointer", padding: 0, textAlign: "left", marginTop: 2 }}>
                ← Back to login
              </button>
            </form>
          )}

          {mode === "forgot" && forgotQuestion && (
            <form onSubmit={resetPasswordHandler} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Reset password</div>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                {forgotQuestion}
                <input style={inp} value={forgotAnswer} onChange={(e) => setForgotAnswer(e.target.value)} placeholder="Your answer" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                New password
                <input style={inp} type="password" value={forgotNewPassword} onChange={(e) => setForgotNewPassword(e.target.value)} placeholder="At least 4 characters" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Confirm new password
                <input style={inp} type="password" value={forgotConfirm} onChange={(e) => setForgotConfirm(e.target.value)} />
              </label>
              <button disabled={busy} type="submit" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
                {busy ? "Resetting..." : "Reset password & log in"}
              </button>
            </form>
          )}

          {err && <div style={{ color: T.red, fontSize: 12.5, marginTop: 8 }}>{err}</div>}
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------
   Lab Admin dashboard — backed by the API / database
--------------------------------------------------------- */
function LabAdmin({ labCode, role, back }) {
  const isAdmin = role === "admin";
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState({ name: "", age: "", phone: "", test: "", doctorId: "" });
  const [saving, setSaving] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [testForm, setTestForm] = useState({ code: "", name: "", price: "", tat: "Same day" });
  const [testFormErr, setTestFormErr] = useState("");
  const [editingTest, setEditingTest] = useState(null); // test code being price-edited
  const [editPrice, setEditPrice] = useState("");
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [doctorForm, setDoctorForm] = useState({ name: "", phone: "", commissionPercent: "10" });
  const [doctorFormErr, setDoctorFormErr] = useState("");
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [resultDrafts, setResultDrafts] = useState({}); // patientId -> draft result text
  const [staffList, setStaffList] = useState([]);
  const [staffForm, setStaffForm] = useState({ username: "", password: "" });
  const [staffFormErr, setStaffFormErr] = useState("");
  const [analytics, setAnalytics] = useState(null);

  async function refresh() {
    const d = await getLabFull(labCode);
    setLab(d);
    setForm((f) => ({ ...f, test: d && d.tests[0] ? d.tests[0].code : f.test }));
    return d;
  }

  const [referrals, setReferrals] = useState([]);
  async function refreshReferrals() {
    const r = await getReferrals(labCode);
    setReferrals(r);
    return r;
  }

  async function addDoctorHandler(e) {
    e.preventDefault();
    setDoctorFormErr("");
    if (!doctorForm.name.trim()) return;
    setSaving(true);
    try {
      const doc = await addDoctor(labCode, {
        name: doctorForm.name.trim(),
        phone: doctorForm.phone.trim(),
        commissionPercent: Number(doctorForm.commissionPercent || 0),
      });
      const d = await refresh();
      setForm((f) => ({ ...f, doctorId: String(doc.id) }));
      setDoctorForm({ name: "", phone: "", commissionPercent: "10" });
      setShowAddDoctor(false);
    } catch (e2) {
      setDoctorFormErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getLabFull(labCode).then((d) => {
      if (!alive) return;
      setLab(d);
      setForm((f) => ({ ...f, test: d && d.tests[0] ? d.tests[0].code : "" }));
      setLoading(false);
    }).catch(() => setLoading(false));
    getAnalytics(labCode).then((a) => { if (alive) setAnalytics(a); }).catch(() => {});
    return () => { alive = false; };
  }, [labCode]);

  useEffect(() => {
    if (tab === "referrals") refreshReferrals().catch(() => {});
    if (tab === "settings" && isAdmin) getStaffList(labCode).then(setStaffList).catch(() => {});
  }, [tab, labCode]);

  async function addPatientHandler(e) {
    e.preventDefault();
    if (!form.name || !form.phone || !lab) return;
    setSaving(true);
    await addPatient(labCode, { name: form.name, age: form.age, phone: form.phone, test: form.test, doctorId: form.doctorId || undefined });
    await refresh();
    setSaving(false);
    setForm({ name: "", age: "", phone: "", test: lab.tests[0]?.code || "", doctorId: "" });
    setTab("patients");
  }

  async function markReady(id) {
    setSaving(true);
    await updatePatient(labCode, id, { status: "Report Ready", result: resultDrafts[id] || "" });
    await refresh();
    setSaving(false);
  }

  async function markPaid(id) {
    setSaving(true);
    await updatePatient(labCode, id, { due: 0 });
    await refresh();
    setSaving(false);
  }

  async function downloadReportHandler(id) {
    try {
      await downloadReport(labCode, id);
    } catch (e2) {
      alert(e2.message);
    }
  }

  async function addStaffHandler(e) {
    e.preventDefault();
    setStaffFormErr("");
    if (!staffForm.username.trim() || !staffForm.password.trim()) return;
    setSaving(true);
    try {
      await addStaff(labCode, { username: staffForm.username.trim(), password: staffForm.password });
      const list = await getStaffList(labCode);
      setStaffList(list);
      setStaffForm({ username: "", password: "" });
    } catch (e2) {
      setStaffFormErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeStaffHandler(id) {
    setSaving(true);
    await removeStaff(labCode, id);
    const list = await getStaffList(labCode);
    setStaffList(list);
    setSaving(false);
  }

  async function addTestHandler(e) {
    e.preventDefault();
    setTestFormErr("");
    if (!testForm.code.trim() || !testForm.name.trim() || testForm.price === "") return;
    setSaving(true);
    try {
      await addTest(labCode, {
        code: testForm.code.trim(),
        name: testForm.name.trim(),
        price: Number(testForm.price),
        tat: testForm.tat,
      });
      await refresh();
      setTestForm({ code: "", name: "", price: "", tat: "Same day" });
    } catch (e2) {
      setTestFormErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveTestPrice(code) {
    if (editPrice === "") return;
    setSaving(true);
    await updateTest(labCode, code, { price: Number(editPrice) });
    await refresh();
    setEditingTest(null);
    setSaving(false);
  }

  async function changePasswordHandler(e) {
    e.preventDefault();
    setPwErr("");
    setPwMsg("");
    if (!pwForm.current || !pwForm.next) return;
    if (pwForm.next !== pwForm.confirm) {
      setPwErr("New passwords don't match");
      return;
    }
    setSaving(true);
    try {
      await changePassword(labCode, pwForm.current, pwForm.next);
      setPwMsg("Password updated.");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (e2) {
      setPwErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 40, color: T.sub }}>Loading lab...</div>;
  if (!lab) return <div style={{ padding: 40, color: T.red }}>Lab not found. <button onClick={back} style={{ cursor: "pointer" }}>Go back</button></div>;

  const totalDue = lab.patients.reduce((a, p) => a + p.due, 0);
  const pendingCount = lab.patients.filter((p) => p.status !== "Report Ready").length;

  const nav = [
    ["overview", "Overview"],
    ["register", "New Registration"],
    ["patients", "Patients"],
    ["tests", "Test Master"],
    ["billing", "Billing / Dues"],
    ["referrals", "Doctor Referrals"],
    ...(isAdmin ? [["settings", "Settings"]] : []),
  ];

  return (
    <div style={{ display: "flex", minHeight: "100%", background: T.bg, color: T.ink, fontFamily: "ui-sans-serif, system-ui" }}>
      <aside style={{ width: 210, borderRight: `1px solid ${T.line}`, padding: "20px 14px", flexShrink: 0 }}>
        <button onClick={back} style={{ background: "none", border: "none", color: T.sub, fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 14 }}>← Back</button>
        <div style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 700 }}>{lab.name}</div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: T.sub, marginBottom: 4 }}>Code: {labCode}</div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: isAdmin ? T.teal : T.amber, marginBottom: 6 }}>{isAdmin ? "OWNER" : "STAFF"}</div>
        <div style={{ fontSize: 11, color: T.sub, marginBottom: 16 }}>{saving ? "Saving..." : "Saved"}</div>
        {nav.map(([k, label]) => (
          <div key={k} onClick={() => setTab(k)} style={{ padding: "9px 12px", borderRadius: 7, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 3, background: tab === k ? T.teal : "transparent", color: tab === k ? "#fff" : T.ink }}>
            {label}
          </div>
        ))}
        {isAdmin && (
        <div style={{ marginTop: 20, padding: 10, background: T.card, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 11.5, color: T.sub }}>
          Share code <b style={{ color: T.ink }}>{labCode}</b> with staff, or give patients your booking link so they can find this lab.
        </div>
        )}
      </aside>

      <main style={{ flex: 1, padding: "26px 34px", overflow: "auto" }}>
        {tab === "overview" && (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 18px" }}>Overview</h2>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Card label="Total patients" value={lab.patients.length} />
              <Card label="Pending results" value={pendingCount} accent={T.amber} />
              <Card label="Dues outstanding" value={"₹" + totalDue} accent={T.red} />
              <Card label="Reports released" value={lab.patients.length - pendingCount} accent={T.green} />
            </div>

            {analytics && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 20 }}>
                <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, flex: "2 1 380px", minWidth: 300 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Revenue — last 7 days</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
                    {analytics.dailyRevenue.map((d) => {
                      const max = Math.max(1, ...analytics.dailyRevenue.map((x) => x.revenue));
                      const h = Math.round((d.revenue / max) * 100);
                      return (
                        <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <div style={{ fontSize: 10.5, color: T.sub, fontWeight: 700 }}>{d.revenue ? "₹" + d.revenue : ""}</div>
                          <div style={{ width: "70%", height: Math.max(3, h), background: T.teal, borderRadius: "3px 3px 0 0" }} />
                          <div style={{ fontSize: 10, color: T.sub }}>{d.date.slice(5)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, flex: "1 1 220px", minWidth: 220 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Top tests</div>
                  {analytics.topTests.length === 0 && <div style={{ color: T.sub, fontSize: 12.5 }}>No patients yet.</div>}
                  {analytics.topTests.map((t) => (
                    <div key={t.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
                      <span>{t.name}</span>
                      <span style={{ fontWeight: 700, color: T.teal }}>{t.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "register" && (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 18px" }}>New Registration</h2>
            <form onSubmit={addPatientHandler} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 22, maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Patient name
                <input style={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, flex: 1 }}>Age
                  <input style={inp} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="e.g. 34" />
                </label>
                <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, flex: 1 }}>Phone
                  <input style={inp} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />
                </label>
              </div>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Test
                <select style={inp} value={form.test} onChange={(e) => setForm({ ...form, test: e.target.value })}>
                  {lab.tests.map((t) => <option key={t.code} value={t.code}>{t.name} — ₹{t.price}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Referring doctor <span style={{ fontWeight: 400 }}>(optional)</span>
                <select style={inp} value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                  <option value="">Walk-in (no referral)</option>
                  {lab.doctors.map((d) => <option key={d.id} value={d.id}>{d.name}{d.commission_percent ? ` — ${d.commission_percent}% commission` : ""}</option>)}
                </select>
              </label>
              {!showAddDoctor ? (
                <button type="button" onClick={() => setShowAddDoctor(true)} style={{ background: "none", border: "none", color: T.teal, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, textAlign: "left" }}>
                  + Add a new referring doctor
                </button>
              ) : (
                <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input style={{ ...inp, marginTop: 0, flex: 2 }} value={doctorForm.name} onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })} placeholder="Doctor's name" />
                    <input style={{ ...inp, marginTop: 0, flex: 1 }} type="number" min="0" max="100" value={doctorForm.commissionPercent} onChange={(e) => setDoctorForm({ ...doctorForm, commissionPercent: e.target.value })} placeholder="% commission" />
                  </div>
                  <input style={{ ...inp, marginTop: 0 }} value={doctorForm.phone} onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })} placeholder="Phone (optional)" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={addDoctorHandler} style={{ background: T.teal, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Save doctor</button>
                    <button type="button" onClick={() => { setShowAddDoctor(false); setDoctorFormErr(""); }} style={{ background: "transparent", border: `1px solid ${T.line}`, padding: "8px 14px", borderRadius: 6, fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
                  </div>
                  {doctorFormErr && <div style={{ color: T.red, fontSize: 12 }}>{doctorFormErr}</div>}
                </div>
              )}
              <button type="submit" style={{ marginTop: 6, background: T.teal, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
                Register &amp; collect sample
              </button>
            </form>
          </>
        )}

        {tab === "patients" && (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 12px" }}>Patients</h2>
            <input
              style={{ ...inp, maxWidth: 280, marginBottom: 14 }}
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search by name, ID or phone..."
            />
            <Table
              cols={["ID", "Name", "Test", "Doctor", "Status", "Due", ""]}
              rows={lab.patients
                .filter((p) => {
                  const q = patientSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    p.name.toLowerCase().includes(q) ||
                    p.id.toLowerCase().includes(q) ||
                    (p.phone || "").includes(q)
                  );
                })
                .map((p) => [
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{p.id}</span>,
                p.name,
                lab.tests.find((t) => t.code === p.test)?.name || p.test,
                p.doctor_name || <span style={{ color: T.sub }}>Walk-in</span>,
                <StatusPill status={p.status} />,
                p.due ? "₹" + p.due : "—",
                p.status !== "Report Ready" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 160 }}>
                    <input
                      style={{ ...inp, marginTop: 0, fontSize: 12 }}
                      placeholder="Result notes (optional)"
                      value={resultDrafts[p.id] || ""}
                      onChange={(e) => setResultDrafts({ ...resultDrafts, [p.id]: e.target.value })}
                    />
                    <button onClick={() => markReady(p.id)} style={{ fontSize: 12, border: `1px solid ${T.line}`, background: "transparent", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>Mark ready</button>
                  </div>
                ) : (
                  <button onClick={() => downloadReportHandler(p.id)} style={{ fontSize: 12, border: `1px solid ${T.teal}`, color: T.teal, background: "transparent", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Download report</button>
                ),
              ])}
            />
          </>
        )}

        {tab === "tests" && (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 18px" }}>Test Master</h2>
            <Table cols={isAdmin ? ["Code", "Test name", "Price", "Turnaround", ""] : ["Code", "Test name", "Price", "Turnaround"]} rows={lab.tests.map((t) => {
              const row = [
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{t.code}</span>,
                t.name,
                editingTest === t.code ? (
                  <input
                    autoFocus
                    style={{ ...inp, marginTop: 0, width: 90, display: "inline-block" }}
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveTestPrice(t.code)}
                  />
                ) : ("₹" + t.price),
                t.tat,
              ];
              if (isAdmin) {
                row.push(editingTest === t.code ? (
                  <button onClick={() => saveTestPrice(t.code)} style={{ fontSize: 12, border: `1px solid ${T.line}`, background: T.teal, color: "#fff", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>Save</button>
                ) : (
                  <button onClick={() => { setEditingTest(t.code); setEditPrice(String(t.price)); }} style={{ fontSize: 12, border: `1px solid ${T.line}`, background: "transparent", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>Edit price</button>
                ));
              }
              return row;
            })} />

            {isAdmin && (
            <>
            <h3 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "26px 0 12px", fontSize: 16 }}>Add a new test</h3>
            <form onSubmit={addTestHandler} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 460, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, flex: 1 }}>Test code
                  <input style={inp} value={testForm.code} onChange={(e) => setTestForm({ ...testForm, code: e.target.value })} placeholder="e.g. HBA1C-05" />
                </label>
                <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, flex: 1 }}>Price (₹)
                  <input style={inp} type="number" min="0" value={testForm.price} onChange={(e) => setTestForm({ ...testForm, price: e.target.value })} placeholder="e.g. 400" />
                </label>
              </div>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Test name
                <input style={inp} value={testForm.name} onChange={(e) => setTestForm({ ...testForm, name: e.target.value })} placeholder="e.g. HbA1c (Diabetes)" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Turnaround time
                <select style={inp} value={testForm.tat} onChange={(e) => setTestForm({ ...testForm, tat: e.target.value })}>
                  <option>Same day</option>
                  <option>Next day</option>
                  <option>2-3 days</option>
                </select>
              </label>
              <button type="submit" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
                Add test
              </button>
              {testFormErr && <div style={{ color: T.red, fontSize: 12.5 }}>{testFormErr}</div>}
            </form>
            </>
            )}
          </>
        )}

        {tab === "billing" && (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 18px" }}>Billing / Dues List</h2>
            <Table
              cols={["ID", "Name", "Test", "Due", ""]}
              rows={lab.patients.filter((p) => p.due > 0).map((p) => [
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{p.id}</span>,
                p.name,
                lab.tests.find((t) => t.code === p.test)?.name || p.test,
                <span style={{ color: T.red, fontWeight: 700 }}>₹{p.due}</span>,
                <button onClick={() => markPaid(p.id)} style={{ fontSize: 12, border: `1px solid ${T.line}`, background: "transparent", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>Mark paid</button>,
              ])}
            />
          </>
        )}

        {tab === "referrals" && (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 6px" }}>Doctor Referrals</h2>
            <p style={{ color: T.sub, fontSize: 13.5, margin: "0 0 20px", maxWidth: 520 }}>
              Track which doctors are sending you patients, and what commission you owe each of them.
            </p>

            {referrals.length === 0 ? (
              <div style={{ background: T.card, border: `1px dashed ${T.line}`, borderRadius: 10, padding: 28, textAlign: "center", color: T.sub, fontSize: 13.5, maxWidth: 480 }}>
                No referring doctors yet. Add one from the <b style={{ color: T.ink }}>New Registration</b> tab
                the next time you register a patient who was sent by a doctor.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                {referrals.map((r) => (
                  <div key={r.id} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 20, minWidth: 240, flex: "1 1 240px", maxWidth: 300 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 700, fontSize: 16 }}>{r.name}</div>
                        {r.phone && <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{r.phone}</div>}
                      </div>
                      <span style={{ background: `${T.amber}18`, color: T.amber, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
                        {r.commission_percent}% rate
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 18, marginTop: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: T.sub, fontWeight: 600 }}>PATIENTS SENT</div>
                        <div style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontSize: 22, fontWeight: 600, marginTop: 2 }}>{r.patient_count}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: T.sub, fontWeight: 600 }}>REVENUE</div>
                        <div style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontSize: 22, fontWeight: 600, marginTop: 2 }}>₹{r.total_revenue}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Commission owed</span>
                      <span style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontSize: 18, fontWeight: 700, color: T.green }}>₹{r.commission_amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "settings" && (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 18px" }}>Settings</h2>
            <h3 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 12px", fontSize: 15 }}>Change password</h3>
            <form onSubmit={changePasswordHandler} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 22, maxWidth: 380, display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Current password
                <input style={inp} type="password" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>New password
                <input style={inp} type="password" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} placeholder="At least 4 characters" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Confirm new password
                <input style={inp} type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
              </label>
              <button type="submit" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
                Update password
              </button>
              {pwErr && <div style={{ color: T.red, fontSize: 12.5 }}>{pwErr}</div>}
              {pwMsg && <div style={{ color: T.green, fontSize: 12.5 }}>{pwMsg}</div>}
            </form>

            <h3 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "28px 0 12px", fontSize: 15 }}>Staff accounts</h3>
            <p style={{ color: T.sub, fontSize: 12.5, margin: "0 0 12px", maxWidth: 420 }}>
              Give receptionists their own login so they can register patients and update reports
              without seeing Settings, Test Master pricing, or your account password.
            </p>
            {staffList.length > 0 && (
              <Table cols={["Username", ""]} rows={staffList.map((s) => [
                s.username,
                <button onClick={() => removeStaffHandler(s.id)} style={{ fontSize: 12, border: `1px solid ${T.red}55`, color: T.red, background: "transparent", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>Remove</button>,
              ])} />
            )}
            <form onSubmit={addStaffHandler} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 380, display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Username
                <input style={inp} value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })} placeholder="e.g. reception1" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Password
                <input style={inp} type="password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} placeholder="At least 4 characters" />
              </label>
              <button type="submit" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
                Add staff account
              </button>
              {staffFormErr && <div style={{ color: T.red, fontSize: 12.5 }}>{staffFormErr}</div>}
            </form>
          </>
        )}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------
   Patient booking portal — pick a lab, then book
--------------------------------------------------------- */
function PatientPortal({ back }) {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState(null);
  const [labData, setLabData] = useState(null);
  const [sel, setSel] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [booked, setBooked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { listLabs().then((l) => { setLabs(l); setLoading(false); }); }, []);

  async function openLab(code) {
    setChosen(code);
    const d = await getLabPublic(code);
    setLabData(d);
    setSel(d?.tests[0]?.code || "");
  }

  async function confirmBooking(e) {
    e.preventDefault();
    if (!name || !phone || !labData) return;
    setBusy(true);
    try {
      await addPatient(chosen, { name, age: "-", phone, test: sel });
      setBooked(true);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div style={{ padding: 40, color: T.sub }}>Loading labs...</div>;

  return (
    <div style={{ background: T.bg, minHeight: "100%", color: T.ink, padding: "26px 34px", maxWidth: 560 }}>
      <button onClick={back} style={{ background: "none", border: "none", color: T.sub, fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 18 }}>← Back to site</button>

      {!chosen ? (
        <>
          <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 14px" }}>Choose a lab</h2>
          {labs.length === 0 && <div style={{ color: T.sub, fontSize: 13.5 }}>No labs have signed up yet — create one from the lab side first.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {labs.map((l) => (
              <div key={l.code} onClick={() => openLab(l.code)} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, cursor: "pointer" }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{l.name}</div>
                <div style={{ fontSize: 12.5, color: T.sub }}>{l.city || "—"}</div>
              </div>
            ))}
          </div>
        </>
      ) : !booked ? (
        <>
          <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 4px" }}>{labData?.name}</h2>
          <div style={{ color: T.sub, fontSize: 13.5, marginBottom: 16 }}>Book a test</div>
          <form onSubmit={confirmBooking} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {labData?.tests.map((t) => (
              <label key={t.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 4px", borderBottom: `1px solid ${T.line}`, cursor: "pointer" }}>
                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="radio" name="test" checked={sel === t.code} onChange={() => setSel(t.code)} />
                  <span>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: T.sub }}>Report in {t.tat.toLowerCase()}</div>
                  </span>
                </span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, color: T.teal }}>₹{t.price}</span>
              </label>
            ))}
            <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, marginTop: 8 }}>Your name
              <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </label>
            <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Phone
              <input style={inp} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
            </label>
            <button disabled={busy} type="submit" style={{ marginTop: 8, background: T.teal, color: "#fff", border: "none", padding: "12px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
              {busy ? "Booking..." : "Confirm booking"}
            </button>
          </form>
        </>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.green}55`, borderRadius: 10, padding: 22 }}>
          <div style={{ color: T.green, fontWeight: 700, fontSize: 14.5, marginBottom: 6 }}>Booking confirmed</div>
          <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6 }}>
            {name}, your booking at {labData?.name} is saved. The lab will see it on their patient list.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Root
--------------------------------------------------------- */
export default function App() {
  const [view, setView] = useState("landing");
  const [labCode, setLabCode] = useState(null);
  const [role, setRole] = useState("admin");

  return (
    <div style={{ minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, -apple-system" }}>
      {view === "landing" && (
        <Landing
          onLabReady={(code, r) => { setLabCode(code); setRole(r || "admin"); setView("admin"); }}
          onPatientMode={() => setView("patient")}
        />
      )}
      {view === "admin" && <LabAdmin labCode={labCode} role={role} back={() => { clearSession(); setView("landing"); }} />}
      {view === "patient" && <PatientPortal back={() => setView("landing")} />}
    </div>
  );
}
