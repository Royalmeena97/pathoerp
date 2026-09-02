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

  // Referring doctors — each lab keeps its own list, with a commission %
  // that gets applied whenever that doctor refers a patient.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id SERIAL PRIMARY KEY,
      lab_code TEXT NOT NULL REFERENCES labs(code) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      clinic TEXT,
      commission_percent INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

  // Referral tracking columns — safe to run repeatedly, same pattern as the
  // security-question columns above. commission is a snapshot (computed
  // from the doctor's rate at booking time) so later rate changes don't
  // silently rewrite past payouts.
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES doctors(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS commission INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS commission_paid BOOLEAN NOT NULL DEFAULT false;`);
}

export const DEFAULT_TESTS = [
  { code: "CBC-01", name: "Complete Blood Count", price: 250, tat: "Same day" },
  { code: "LFT-02", name: "Liver Function Test", price: 600, tat: "Same day" },
  { code: "TSH-03", name: "Thyroid Profile (TSH)", price: 350, tat: "Next day" },
  { code: "LIP-04", name: "Lipid Profile", price: 500, tat: "Same day" },
];

// Fixed list so both the signup dropdown and the reset flow stay in sync.
export const SECURITY_QUESTIONS = [
  "What city were you born in?",
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
];
