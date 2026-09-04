import React, { useState, useEffect } from "react";
import { createLab, loginLab, staffLogin, listLabs, getLabPublic, getLabFull, addPatient, updatePatient, addTest, updateTest, addDoctor, getReferrals, changePassword, getSecurityQuestion, resetPassword, getAnalytics, getStaffList, addStaff, removeStaff, downloadReport, downloadPatientsCsv, clearSession } from "./api.js";

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
  bg: "#F3F8F7",
  ink: "#0F2A2C",
  sub: "#5C7370",
  line: "#DCE8E5",
  card: "#FFFFFF",
  teal: "#0F766E",
  tealDark: "#0B5D57",
  amber: "#DB8A2B",
  green: "#3F9142",
  red: "#C1473C",
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
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || "General";
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

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
   Hero illustration — hand-built SVG, no external images,
   so it always renders and matches the theme colors exactly.
--------------------------------------------------------- */
function LabIllustration() {
  return (
    <svg viewBox="0 0 420 420" style={{ width: "100%", maxWidth: 340, display: "block", margin: "0 auto" }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor={T.teal} stopOpacity="0.16" />
          <stop offset="100%" stopColor={T.teal} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="coatGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#EAF3F1" />
        </linearGradient>
        <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6CDA3" />
          <stop offset="100%" stopColor="#EFB989" />
        </linearGradient>
        <linearGradient id="tealGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={T.teal} />
          <stop offset="100%" stopColor={T.tealDark} />
        </linearGradient>
        <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0F2A2C" floodOpacity="0.16" />
        </filter>
        <filter id="cardShadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0F2A2C" floodOpacity="0.14" />
        </filter>
      </defs>

      <circle cx="210" cy="205" r="185" fill="url(#bgGlow)" />
      <circle cx="210" cy="205" r="148" fill="none" stroke={T.teal} strokeOpacity="0.12" strokeWidth="1.5" strokeDasharray="3 7" />
      <circle cx="66" cy="86" r="14" fill={T.amber} opacity="0.3" />
      <circle cx="362" cy="322" r="20" fill={T.amber} opacity="0.2" />
      <circle cx="350" cy="66" r="8" fill={T.teal} opacity="0.28" />

      {/* floating medical cross badges */}
      <g filter="url(#cardShadow)">
        <rect x="26" y="224" width="32" height="32" rx="9" fill={T.card} />
        <rect x="39" y="232" width="6" height="16" rx="2" fill={T.red} />
        <rect x="33" y="238" width="18" height="6" rx="2" fill={T.red} />
      </g>
      <g filter="url(#cardShadow)">
        <rect x="354" y="146" width="28" height="28" rx="8" fill={T.card} />
        <rect x="364" y="154" width="6" height="12" rx="2" fill={T.teal} />
        <rect x="359" y="159" width="16" height="6" rx="2" fill={T.teal} />
      </g>

      {/* doctor */}
      <g filter="url(#softShadow)">
        {/* coat body */}
        <path d="M118 402 C118 296 150 254 210 254 C270 254 302 296 302 402 Z" fill="url(#coatGrad)" stroke={T.line} strokeWidth="1.5" />
        {/* coat lapels */}
        <path d="M193 262 L210 328 L227 262" fill="none" stroke={T.line} strokeWidth="1.5" />
        {/* undershirt */}
        <path d="M198 260 C204 276 216 276 222 260 L214 298 L206 298 Z" fill="url(#tealGrad)" />
        {/* neck */}
        <rect x="195" y="232" width="30" height="32" rx="11" fill="url(#skinGrad)" />
        {/* head */}
        <circle cx="210" cy="197" r="44" fill="url(#skinGrad)" />
        {/* ears */}
        <circle cx="167" cy="198" r="6" fill="#EFB989" />
        <circle cx="253" cy="198" r="6" fill="#EFB989" />
        {/* hair */}
        <path d="M164 194 C158 150 178 126 210 126 C242 126 262 150 256 194 C248 172 230 160 210 160 C190 160 172 172 164 194 Z" fill="#3B2A20" />
        {/* simple face */}
        <circle cx="196" cy="198" r="2.6" fill="#3B2A20" />
        <circle cx="224" cy="198" r="2.6" fill="#3B2A20" />
        <path d="M199 214 Q210 222 221 214" fill="none" stroke="#8A5A38" strokeWidth="2.4" strokeLinecap="round" />
        {/* stethoscope around neck */}
        <path d="M180 246 C180 274 167 285 156 277 C147 271 150 254 163 254" fill="none" stroke={T.tealDark} strokeWidth="5" strokeLinecap="round" />
        <path d="M240 246 C240 274 253 285 264 277 C273 271 270 254 257 254" fill="none" stroke={T.tealDark} strokeWidth="5" strokeLinecap="round" />
        <circle cx="156" cy="279" r="7.5" fill="url(#tealGrad)" />
        {/* pocket + badge */}
        <rect x="226" y="314" width="36" height="26" rx="4" fill="none" stroke={T.line} strokeWidth="1.5" />
        <circle cx="174" cy="296" r="9" fill={T.amber} />
        <rect x="169" y="292" width="10" height="2.4" rx="1" fill="#FFFFFF" opacity="0.85" />
        <rect x="173" y="288" width="2.4" height="10" rx="1" fill="#FFFFFF" opacity="0.85" />

        {/* clipboard in hand */}
        <g transform="translate(278 296) rotate(8)" filter="url(#cardShadow)">
          <rect x="0" y="0" width="58" height="74" rx="7" fill="#FFFFFF" />
          <rect x="19" y="-6" width="20" height="12" rx="3" fill={T.sub} />
          <rect x="10" y="17" width="38" height="5" rx="2" fill={T.line} />
          <rect x="10" y="29" width="38" height="5" rx="2" fill={T.line} />
          <rect x="10" y="41" width="26" height="5" rx="2" fill={T.line} />
          <path d="M12 56 L21 64 L36 47" fill="none" stroke={T.green} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* left hand + test tube */}
        <g transform="translate(116 296) rotate(-6)" filter="url(#cardShadow)">
          <rect x="8" y="0" width="16" height="48" rx="8" fill="#FFFFFF" />
          <path d="M8 8 C8 23 24 23 24 8" fill="url(#tealGrad)" opacity="0.85" />
          <rect x="6" y="-11" width="20" height="10" rx="3" fill={T.sub} />
        </g>
      </g>

      {/* table + microscope */}
      <rect x="34" y="356" width="352" height="10" rx="5" fill={T.line} filter="url(#cardShadow)" />
      <g transform="translate(52 298)" filter="url(#cardShadow)">
        <rect x="0" y="42" width="48" height="9" rx="3" fill={T.sub} opacity="0.45" />
        <rect x="19" y="10" width="10" height="36" rx="3" fill={T.sub} />
        <circle cx="24" cy="8" r="11" fill="url(#tealGrad)" />
        <rect x="8" y="-2" width="13" height="9" rx="2" fill="url(#tealGrad)" transform="rotate(-25 14 4)" />
        <circle cx="24" cy="8" r="4" fill="#FFFFFF" opacity="0.5" />
      </g>
    </svg>
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
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 40px", borderBottom: `1px solid ${T.line}`, background: T.card, boxShadow: "0 1px 0 rgba(15,42,44,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg, ${T.teal}, ${T.tealDark})`,
            position: "relative", boxShadow: "0 6px 14px -6px rgba(15,118,110,0.6)", flexShrink: 0,
          }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", width: 3, height: 14, background: "#fff", borderRadius: 2, transform: "translate(-50%, -50%)" }} />
            <div style={{ position: "absolute", top: "50%", left: "50%", width: 14, height: 3, background: "#fff", borderRadius: 2, transform: "translate(-50%, -50%)" }} />
          </div>
          <div style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 700, fontSize: 19 }}>
            Nirikshan<span style={{ color: T.teal }}>Lab</span>
          </div>
        </div>
        <button onClick={onPatientMode} className="btn-primary" style={{ background: T.teal, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          Book a test as patient
        </button>
      </header>

      <section style={{
        display: "flex", gap: 40, padding: "68px 40px 76px", flexWrap: "wrap", alignItems: "center",
        background: `linear-gradient(180deg, ${T.teal}12 0%, ${T.bg} 60%)`,
      }}>
        <div className="hero-fade" style={{ flex: "1 1 380px", minWidth: 280 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${T.amber}1c`, color: "#9C5E12", fontWeight: 700, fontSize: 12, padding: "6px 13px", borderRadius: 999, marginBottom: 18 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.amber, display: "inline-block" }} />
            For pathology labs & diagnostic centres
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontSize: 42, lineHeight: 1.14, fontWeight: 600, letterSpacing: -0.8, margin: 0, color: T.ink }}>
            Run your pathology lab without the paper trail.
          </h1>
          <p style={{ fontSize: 16, color: T.sub, marginTop: 18, lineHeight: 1.65, maxWidth: 440 }}>
            Registration, sample tracking, billing, doctor referrals and a patient booking page — one
            account per lab, data saved to a real database on the server.
          </p>
          <div style={{ display: "flex", gap: 26, marginTop: 32, flexWrap: "wrap" }}>
            {["Free to try", "Password protected", "Multi-lab ready"].map((t) => {
              const [b, rest] = [t.split(" ")[0], t.split(" ").slice(1).join(" ")];
              return (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: T.sub }}>
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill={T.teal} opacity="0.14" /><path d="M6 10.5l2.5 2.5L14 7.5" stroke={T.tealDark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span><b style={{ color: T.ink }}>{b}</b> {rest}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hero-fade-delay" style={{ flex: "1 1 260px", minWidth: 220, maxWidth: 320 }}>
          <LabIllustration />
        </div>

        <div className="auth-card hero-fade-delay" style={{ flex: "1 1 340px", minWidth: 300, maxWidth: 380, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 26 }}>
          {mode !== "forgot" && mode !== "staff" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 18, background: T.bg, padding: 4, borderRadius: 10, border: `1px solid ${T.line}` }}>
              {[["new", "Start a new lab"], ["existing", "I already have a lab"]].map(([k, l]) => (
                <button key={k} onClick={() => switchMode(k)} style={{
                  flex: 1, padding: "8px 6px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  border: "none", background: mode === k ? T.teal : "transparent", color: mode === k ? "#fff" : T.sub,
                  boxShadow: mode === k ? "0 6px 14px -6px rgba(15,118,110,0.55)" : "none", transition: "all .15s ease",
                }}>{l}</button>
              ))}
            </div>
          )}

          {mode === "new" && (
            <form onSubmit={createLabHandler} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Lab name
                <input className="field" style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ashirwad Diagnostics" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                City
                <input className="field" style={inp} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Ghaziabad" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Password
                <input className="field" style={inp} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 4 characters" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Security question <span style={{ fontWeight: 400, color: T.sub }}>(used if you forget your password)</span>
                <select className="field" style={inp} value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)}>
                  {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Your answer
                <input className="field" style={inp} value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} placeholder="Remember this answer!" />
              </label>
              <button disabled={busy} type="submit" className="btn-primary" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
                {busy ? "Creating..." : "Create lab account"}
              </button>
            </form>
          )}

          {mode === "existing" && (
            <form onSubmit={loginLabHandler} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Lab code
                <input className="field" style={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ashirw482" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Password
                <input className="field" style={inp} type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Your lab password" />
              </label>
              <button disabled={busy} type="submit" className="btn-primary" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
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
                <input className="field" style={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ashirw482" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Username
                <input className="field" style={inp} value={staffUsername} onChange={(e) => setStaffUsername(e.target.value)} placeholder="Given to you by the lab owner" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Password
                <input className="field" style={inp} type="password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} />
              </label>
              <button disabled={busy} type="submit" className="btn-primary" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
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
                <input className="field" style={inp} value={forgotCode} onChange={(e) => setForgotCode(e.target.value)} placeholder="e.g. ashirw482" />
              </label>
              <button disabled={busy} type="submit" className="btn-primary" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
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
                <input className="field" style={inp} value={forgotAnswer} onChange={(e) => setForgotAnswer(e.target.value)} placeholder="Your answer" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                New password
                <input className="field" style={inp} type="password" value={forgotNewPassword} onChange={(e) => setForgotNewPassword(e.target.value)} placeholder="At least 4 characters" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
                Confirm new password
                <input className="field" style={inp} type="password" value={forgotConfirm} onChange={(e) => setForgotConfirm(e.target.value)} />
              </label>
              <button disabled={busy} type="submit" className="btn-primary" style={{ marginTop: 4, background: T.teal, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
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
  const [dateFilter, setDateFilter] = useState("all");
  const [patientPage, setPatientPage] = useState(0);
  const [testForm, setTestForm] = useState({ code: "", name: "", price: "", tat: "Same day", category: "General" });
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
        category: testForm.category.trim() || "General",
      });
      await refresh();
      setTestForm({ code: "", name: "", price: "", tat: "Same day", category: "General" });
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
                <input className="field" style={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, flex: 1 }}>Age
                  <input className="field" style={inp} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="e.g. 34" />
                </label>
                <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, flex: 1 }}>Phone
                  <input className="field" style={inp} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />
                </label>
              </div>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Test
                <select className="field" style={inp} value={form.test} onChange={(e) => setForm({ ...form, test: e.target.value })}>
                  {Object.entries(groupBy(lab.tests, "category")).map(([cat, ts]) => (
                    <optgroup key={cat} label={cat}>
                      {ts.map((t) => <option key={t.code} value={t.code}>{t.name} — ₹{t.price}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Referring doctor <span style={{ fontWeight: 400 }}>(optional)</span>
                <select className="field" style={inp} value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: 0 }}>Patients</h2>
              <button onClick={() => downloadPatientsCsv(labCode)} style={{ fontSize: 12.5, border: `1px solid ${T.line}`, background: "transparent", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                Export CSV
              </button>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <input
                style={{ ...inp, maxWidth: 260, marginTop: 0 }}
                value={patientSearch}
                onChange={(e) => { setPatientSearch(e.target.value); setPatientPage(0); }}
                placeholder="Search by name, ID or phone..."
              />
              <div style={{ display: "flex", gap: 6 }}>
                {[["all", "All time"], ["today", "Today"], ["week", "This week"], ["month", "This month"]].map(([k, l]) => (
                  <button key={k} onClick={() => { setDateFilter(k); setPatientPage(0); }} style={{
                    fontSize: 12, padding: "6px 11px", borderRadius: 6, cursor: "pointer",
                    border: `1px solid ${T.line}`, background: dateFilter === k ? T.teal : "transparent", color: dateFilter === k ? "#fff" : T.ink,
                  }}>{l}</button>
                ))}
              </div>
            </div>
            {(() => {
              const now = new Date();
              const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
              const cutoffs = { today: startOfToday, week: startOfWeek, month: startOfMonth };

              const filtered = lab.patients.filter((p) => {
                const q = patientSearch.trim().toLowerCase();
                const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || (p.phone || "").includes(q);
                const matchesDate = dateFilter === "all" || new Date(p.created_at) >= cutoffs[dateFilter];
                return matchesSearch && matchesDate;
              });

              const pageSize = 15;
              const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
              const page = Math.min(patientPage, pageCount - 1);
              const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

              return (
                <>
                  <Table
                    cols={["ID", "Name", "Test", "Doctor", "Status", "Due", ""]}
                    rows={pageRows.map((p) => [
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
                  {filtered.length > pageSize && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12.5, color: T.sub }}>
                      <span>Showing {page * pageSize + 1}-{Math.min(filtered.length, (page + 1) * pageSize)} of {filtered.length}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button disabled={page === 0} onClick={() => setPatientPage(page - 1)} style={{ fontSize: 12, border: `1px solid ${T.line}`, background: "transparent", padding: "5px 12px", borderRadius: 6, cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.4 : 1 }}>← Prev</button>
                        <button disabled={page >= pageCount - 1} onClick={() => setPatientPage(page + 1)} style={{ fontSize: 12, border: `1px solid ${T.line}`, background: "transparent", padding: "5px 12px", borderRadius: 6, cursor: page >= pageCount - 1 ? "default" : "pointer", opacity: page >= pageCount - 1 ? 0.4 : 1 }}>Next →</button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {tab === "tests" && (
          <>
            <h2 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "0 0 18px" }}>Test Master</h2>
            {Object.entries(groupBy(lab.tests, "category")).map(([cat, ts]) => (
              <div key={cat} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.sub, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>{cat}</div>
                <Table cols={isAdmin ? ["Code", "Test name", "Price", "Turnaround", ""] : ["Code", "Test name", "Price", "Turnaround"]} rows={ts.map((t) => {
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
              </div>
            ))}

            {isAdmin && (
            <>
            <h3 style={{ fontFamily: "'Space Grotesk', ui-sans-serif", fontWeight: 600, margin: "26px 0 12px", fontSize: 16 }}>Add a new test</h3>
            <form onSubmit={addTestHandler} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 20, maxWidth: 460, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, flex: 1 }}>Test code
                  <input className="field" style={inp} value={testForm.code} onChange={(e) => setTestForm({ ...testForm, code: e.target.value })} placeholder="e.g. HBA1C-05" />
                </label>
                <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, flex: 1 }}>Price (₹)
                  <input className="field" style={inp} type="number" min="0" value={testForm.price} onChange={(e) => setTestForm({ ...testForm, price: e.target.value })} placeholder="e.g. 400" />
                </label>
              </div>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Test name
                <input className="field" style={inp} value={testForm.name} onChange={(e) => setTestForm({ ...testForm, name: e.target.value })} placeholder="e.g. HbA1c (Diabetes)" />
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, flex: 1 }}>Category
                  <input className="field" style={inp} list="category-options" value={testForm.category} onChange={(e) => setTestForm({ ...testForm, category: e.target.value })} placeholder="e.g. Blood Tests" />
                  <datalist id="category-options">
                    {Object.keys(groupBy(lab.tests, "category")).map((c) => <option key={c} value={c} />)}
                  </datalist>
                </label>
                <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, flex: 1 }}>Turnaround time
                  <select className="field" style={inp} value={testForm.tat} onChange={(e) => setTestForm({ ...testForm, tat: e.target.value })}>
                    <option>Same day</option>
                    <option>Next day</option>
                    <option>2-3 days</option>
                  </select>
                </label>
              </div>
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
                <input className="field" style={inp} type="password" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>New password
                <input className="field" style={inp} type="password" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} placeholder="At least 4 characters" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Confirm new password
                <input className="field" style={inp} type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
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
                <input className="field" style={inp} value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })} placeholder="e.g. reception1" />
              </label>
              <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Password
                <input className="field" style={inp} type="password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} placeholder="At least 4 characters" />
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
              <input className="field" style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </label>
            <label style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>Phone
              <input className="field" style={inp} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
            </label>
            <button disabled={busy} type="submit" className="btn-primary" style={{ marginTop: 8, background: T.teal, color: "#fff", border: "none", padding: "12px 18px", borderRadius: 7, fontWeight: 600, cursor: "pointer" }}>
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