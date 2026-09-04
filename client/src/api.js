// In production (separate frontend/backend hosting), set VITE_API_URL to
// your backend's full URL, e.g. https://apna-backend.up.railway.app/api
// If unset, falls back to a relative "/api" — this works automatically
// when the frontend is served by the same Express server (see server's
// static-file serving) or via the Vite dev proxy during local development.
const BASE = import.meta.env.VITE_API_URL || "/api";

// Session token lives in a module-level var, mirrored into sessionStorage so
// an accidental page refresh doesn't immediately log the admin out. It is
// set once on login/signup and cleared on logout.
let sessionToken = sessionStorage.getItem("pathoerp_token") || null;

function setToken(token) {
  sessionToken = token;
  if (token) sessionStorage.setItem("pathoerp_token", token);
  else sessionStorage.removeItem("pathoerp_token");
}

export function clearSession() {
  setToken(null);
}

function authHeaders() {
  return sessionToken ? { "x-session-token": sessionToken } : {};
}

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// Signup no longer collects a security question up front — that's a short
// follow-up step right after the account is created (see
// setSecurityQuestion below). The server tells us via needsSecurityQuestion.
export function createLab({ name, city, password }) {
  return fetch(`${BASE}/labs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, city, password }),
  })
    .then(handle)
    .then((lab) => {
      setToken(lab.token);
      return lab;
    });
}

// Sets (or updates) the security question used for password recovery.
// Called right after signup, or any time later from lab settings.
export function setSecurityQuestion(code, securityQuestion, securityAnswer) {
  return fetch(`${BASE}/labs/${encodeURIComponent(code)}/security-question-setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ securityQuestion, securityAnswer }),
  }).then(handle);
}

export function getSecurityQuestions() {
  return fetch(`${BASE}/security-questions`).then(handle);
}

// name is the lab's name now, not an internal code — people never forget
// their own lab's name the way they forget a random generated code.
export function getSecurityQuestion(name) {
  return fetch(`${BASE}/labs/${encodeURIComponent(name)}/security-question`).then(handle);
}

export function resetPassword(name, answer, newPassword) {
  return fetch(`${BASE}/labs/${encodeURIComponent(name)}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer, newPassword }),
  })
    .then(handle)
    .then((lab) => {
      setToken(lab.token);
      return lab;
    });
}

export function loginLab(name, password) {
  return fetch(`${BASE}/labs/${encodeURIComponent(name)}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  })
    .then(handle)
    .then((lab) => {
      setToken(lab.token);
      return lab;
    });
}

export function staffLogin(name, username, password) {
  return fetch(`${BASE}/labs/${encodeURIComponent(name)}/staff-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then(handle)
    .then((lab) => {
      setToken(lab.token);
      return lab;
    });
}

export function listLabs() {
  return fetch(`${BASE}/labs`).then(handle);
}

export function getLabPublic(code) {
  return fetch(`${BASE}/labs/${code}/public`).then(handle);
}

// --- Admin (session-protected) calls below send the x-session-token header ---

export function getLabFull(code) {
  return fetch(`${BASE}/labs/${code}`, { headers: { ...authHeaders() } }).then(handle);
}

export function changePassword(code, currentPassword, newPassword) {
  return fetch(`${BASE}/labs/${code}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ currentPassword, newPassword }),
  }).then(handle);
}

export function addTest(code, payload) {
  return fetch(`${BASE}/labs/${code}/tests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function updateTest(code, testCode, payload) {
  return fetch(`${BASE}/labs/${code}/tests/${testCode}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function addDoctor(code, payload) {
  return fetch(`${BASE}/labs/${code}/doctors`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function getReferrals(code) {
  return fetch(`${BASE}/labs/${code}/referrals`, { headers: { ...authHeaders() } }).then(handle);
}

export function addPatient(code, payload) {
  return fetch(`${BASE}/labs/${code}/patients`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function updatePatient(code, id, payload) {
  return fetch(`${BASE}/labs/${code}/patients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function getAnalytics(code) {
  return fetch(`${BASE}/labs/${code}/analytics`, { headers: { ...authHeaders() } }).then(handle);
}

export function getStaffList(code) {
  return fetch(`${BASE}/labs/${code}/staff`, { headers: { ...authHeaders() } }).then(handle);
}

export function addStaff(code, payload) {
  return fetch(`${BASE}/labs/${code}/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(handle);
}

export function removeStaff(code, id) {
  return fetch(`${BASE}/labs/${code}/staff/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  }).then(handle);
}

// Downloads the PDF report and triggers a browser save/open — not JSON, so
// it doesn't go through handle().
export async function downloadReport(code, patientId) {
  const res = await fetch(`${BASE}/labs/${code}/patients/${patientId}/report`, { headers: { ...authHeaders() } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not generate the report");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// Downloads the patients CSV export and triggers a browser save.
export async function downloadPatientsCsv(code) {
  const res = await fetch(`${BASE}/labs/${code}/patients/export.csv`, { headers: { ...authHeaders() } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not export the patient list");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `patients-${code}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* ---------- platform owner panel — a separate token from the lab session above ---------- */

let ownerToken = sessionStorage.getItem("pathoerp_owner_token") || null;

function setOwnerToken(token) {
  ownerToken = token;
  if (token) sessionStorage.setItem("pathoerp_owner_token", token);
  else sessionStorage.removeItem("pathoerp_owner_token");
}

export function clearOwnerSession() {
  setOwnerToken(null);
}

export function hasOwnerSession() {
  return !!ownerToken;
}

function ownerHeaders() {
  return ownerToken ? { "x-owner-token": ownerToken } : {};
}

export function ownerLogin(password) {
  return fetch(`${BASE}/owner/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  })
    .then(handle)
    .then((res) => {
      setOwnerToken(res.token);
      return res;
    });
}

export function ownerListLabs() {
  return fetch(`${BASE}/owner/labs`, { headers: { ...ownerHeaders() } }).then(handle);
}

export function ownerResetLabPassword(code, newPassword) {
  return fetch(`${BASE}/owner/labs/${code}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ownerHeaders() },
    body: JSON.stringify({ newPassword }),
  }).then(handle);
}

export function ownerDeleteLab(code) {
  return fetch(`${BASE}/owner/labs/${code}`, {
    method: "DELETE",
    headers: { ...ownerHeaders() },
  }).then(handle);
}

export function ownerListStaff(code) {
  return fetch(`${BASE}/owner/labs/${code}/staff`, { headers: { ...ownerHeaders() } }).then(handle);
}

export function ownerResetStaffPassword(code, staffId, newPassword) {
  return fetch(`${BASE}/owner/labs/${code}/staff/${staffId}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ownerHeaders() },
    body: JSON.stringify({ newPassword }),
  }).then(handle);
}