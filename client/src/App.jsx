import React, { useState, useEffect } from "react";
import { createLab, loginLab, listLabs, getLabPublic, getLabFull, addPatient, updatePatient, addTest, updateTest, changePassword, getSecurityQuestion, resetPassword, clearSession } from "./api.js";

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
  const [mode, setMode] = useState("new"); // new | existing | forgot
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [code, setCode] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
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
      onLabReady(lab.code);
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
      onLabReady(lab.code);
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
      onLabReady(lab.code);
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
          {mode !== "forgot" && (
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
              <button type="button" onClick={() => switchMode("forgot")} style={{ background: "none", border: "none", color: T.teal, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, textAlign: "left", marginTop: 2 }}>
                Forgot password?
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
function LabAdmin({ labCode, back }) {
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState({ name: "", age: "", phone: "", test: "" });
  const [saving, setSaving] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [testForm, setTestForm] = useState({ code: "", name: "", price: "", tat: "Same day" });
  const [testFormErr, setTestFormErr] = useState("");
  const [editingTest, setEditingTest] = useState(null); // test code being price-edited
  const [editPrice, setEditPrice] = useState("");
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  async function refresh() {
    const d = await getLabFull(labCode);
    setLab(d);
    setForm((f) => ({ ...f, test: d && d.tests[0] ? d.tests[0].code : f.test }));
    return d;
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
    return () => { alive = false; };
  }, [labCode]);

  async function addPatientHandler(e) {
    e.preventDefault();
    if (!form.name || !form.phone || !lab) return;
    setSaving(true);
    await addPatient(labCode, { name: form.name, age: form.age, phone: form.phone, test: form.test });
    await refresh();
    setSaving(false);
    setForm({ name: "", age: "", phone: "", test: lab.tests[0]?.code || "" });
    setTab("patients");
  }

  async function markReady(id) {
    setSaving(true);
    await updatePatient(labCode, id, { status: "Report Ready" });
    await refresh();
    setSaving(false);
  }

  async function markPaid(id) {
    setSaving(true);
    await updatePatient(labCode, id, { due: 0 });
    await refresh();
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
    ["settings", "Settings"],
  ];

  return (
    <div style={{ display: "flex", minHeight: "100%", background: T.bg, color: T.ink, fontFamily: "ui-sans-serif, system-ui" }}>
      <aside style={{ width: 210, borderRight: `1px solid ${T.line}`, padding: "20px 14px", flexShrink: 0 }}>
        <button onClick={back} style={{ background: "none", border: "none", color: T.sub, fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 14 }}>← Back</button>
        <div style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 700 }}>{lab.name}</div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: T.sub, marginBottom: 6 }}>Code: {labCode}</div>
        <div style={{ fontSize: 11, color: T.sub, marginBottom: 16 }}>{saving ? "Saving..." : "Saved"}</div>
        {nav.map(([k, label]) => (
          <div key={k} onClick={() => setTab(k)} style={{ padding: "9px 12px", borderRadius: 7, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 3, background: tab === k ? T.teal : "transparent", color: tab === k ? "#fff" : T.ink }}>
            {label}
          </div>
        ))}
        <div style={{ marginTop: 20, padding: 10, background: T.card, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 11.5, color: T.sub }}>
          Share code <b style={{ color: T.ink }}>{labCode}</b> with staff, or give patients your booking link so they can find this lab.
        </div>
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
              cols={["ID", "Name", "Test", "Status", "Due", ""]}
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
                <StatusPill status={p.status} />,
                p.due ? "₹" + p.due : "—",
                p.status !== "Report Ready" ? (
                  <button onClick={() => markReady(p.id)} style={{ fontSize: 12, border: `1px solid ${T.line}`, background: "transparent", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>Mark ready</button>
                ) : "",
              ])}
            />
          </>
        )}

        {tab === "tests" && (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 18px" }}>Test Master</h2>
            <Table cols={["Code", "Test name", "Price", "Turnaround", ""]} rows={lab.tests.map((t) => [
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
              editingTest === t.code ? (
                <button onClick={() => saveTestPrice(t.code)} style={{ fontSize: 12, border: `1px solid ${T.line}`, background: T.teal, color: "#fff", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>Save</button>
              ) : (
                <button onClick={() => { setEditingTest(t.code); setEditPrice(String(t.price)); }} style={{ fontSize: 12, border: `1px solid ${T.line}`, background: "transparent", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>Edit price</button>
              ),
            ])} />

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

  return (
    <div style={{ minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, -apple-system" }}>
      {view === "landing" && (
        <Landing
          onLabReady={(code) => { setLabCode(code); setView("admin"); }}
          onPatientMode={() => setView("patient")}
        />
      )}
      {view === "admin" && <LabAdmin labCode={labCode} back={() => { clearSession(); setView("landing"); }} />}
      {view === "patient" && <PatientPortal back={() => setView("landing")} />}
    </div>
  );
}
