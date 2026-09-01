# NirikshanLab — Pathology Lab ERP

Ye ek full website hai — real backend + real database (PostgreSQL) + session-based
login ke saath. Har lab, test, patient aur login-session ab database aur server
memory me track hota hai, browser-only storage nahi.

## Kya hai isme

- `server/` — Node.js + Express backend, **PostgreSQL** database (`pg` package)
- `client/` — React frontend (Vite), same design jo prototype me tha

Do cheezein hain: lab admin dashboard (registration, patients, billing) aur ek
patient-facing booking page.

## Login / session kaise kaam karta hai

Login (ya naya lab signup) karne par server ek random **session token** banata
hai aur usko lab code se link karke apni memory me rakhta hai. Ye token client
ko wapas milta hai, jo usse `x-session-token` header me har admin-wale request
(patients dekhna/add karna, report ready/paid karna) ke saath bhejta hai. Token
ke bina ya galat token ke saath in routes pe 401 milega. Public routes (labs
ki list, ek lab ke tests dikhana patient booking ke liye) ko token nahi
chahiye.

Note: sessions abhi server ki memory me hain (ek simple Map), disk/DB me nahi.
Iska matlab agar server restart ho ya aap multiple server instances chalao
(load balancing), to sessions sab instances me share nahi hongi — user ko
dobara login karna padega. Agar aage chal ke multi-instance deploy karna ho,
to isi shape (`labCode`, `token`, `createdAt`) ka ek `sessions` table Postgres
me bana kar `server/src/sessions.js` ke Map ko replace kar sakte ho.

## Setup — pehli baar

Node.js (v18 ya usse upar) aur ek PostgreSQL database chahiye (local ya
managed jaise Railway).

### 1. Database connection set karo

```bash
cd server
cp .env.example .env
```

`.env` file kholo aur `DATABASE_URL` ko apne Postgres ke connection string se
replace karo, jaise:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pathoerp
```

Local Postgres use kar rahe ho to database pehle bana lo:

```bash
psql -U postgres -c "CREATE DATABASE pathoerp;"
```

### 2. Backend chalao

```bash
npm start
```

Ye `http://localhost:4000` pe API chalu kar dega. Pehli baar chalane par
zaroori tables (`labs`, `tests`, `patients`) khud ban jayenge — koi manual
schema setup nahi chahiye.

### 3. Frontend chalao (naya terminal me)

```bash
cd client
npm install
npm run dev
```

Ye `http://localhost:5173` pe website khol dega. Browser me isi link ko kholo.

Dev mode me frontend API calls `/api/...` ko automatically backend
(`localhost:4000`) tak proxy kar deta hai — koi extra config nahi chahiye.

## Kaise use karein

1. **Naya lab banao** — "Start a new lab" pe lab name, city aur ek password daalo.
   Ek unique code milega (jaise `ashirw482`) — ye code hi lab ki login ID hai.
2. **Wapas login karna ho** to "I already have a lab" me code + password daalo.
3. Admin dashboard me patient register karo, reports "Mark ready" karo, dues
   "Mark paid" karo — sab kuch database me save hota hai.
4. **Patient booking** — landing page pe "Book a test as patient" button se
   koi bhi lab choose karke test book kar sakta hai. Ye booking seedha us lab
   ke patient list me aa jaati hai.
5. **Test Master** tab se naye test add kar sakte ho ya kisi test ka price
   edit kar sakte ho.
6. **Settings** tab se password change kar sakte ho (current password
   confirm karna padega).
7. **Patients** tab me search box se naam, ID ya phone se dhoondh sakte ho.

## Security jo already lagi hui hai

- Passwords `bcrypt` se hash hote hain, plain text kabhi save nahi hota.
- Login/signup/change-password pe rate limiting hai (15 min me 20 attempts) —
  brute-force se bachne ke liye.
- `helmet` se basic security headers lagti hain.
- Server-side input validation — galat phone number, khaali naam, negative
  price, jaisi cheezein 400 error ke saath reject ho jaati hain.
- CORS ko `ALLOWED_ORIGINS` env var se lock kar sakte ho (neeche dekho) —
  bina isके koi bhi website tumhare API ko call kar sakti hai.

## Production ke liye deploy karna ho to (jaise Railway)

### Option A — ek hi Railway service (sabse simple)

Server ab `client/dist` (agar mojood ho) khud serve kar deta hai, isliye
backend aur frontend ek hi service me deploy ho sakte hain:

1. Railway pe ek Postgres plugin attach karo — Railway khud `DATABASE_URL`
   environment variable set kar dega.
2. Deploy se pehle `cd client && npm run build` chalao taaki `client/dist`
   ban jaaye (ya Railway build command me `npm install && npm run build`
   client folder ke liye, phir server folder se `npm start` chalao).
3. `ALLOWED_ORIGINS` set karne ki zarurat nahi padegi is setup me kyunki
   frontend aur backend same origin se serve honge.

### Option B — frontend aur backend alag-alag hosting pe

1. Backend Railway pe deploy karo (Postgres plugin attach karke), same
   jaise upar.
2. Frontend ko `npm run build` karke Netlify/Vercel/kisi static host pe
   daalo. Build se pehle `client/.env` me `VITE_API_URL` set karo apne
   live backend URL se (jaise `https://apna-backend.up.railway.app/api`).
3. **Zaroori:** Backend pe `ALLOWED_ORIGINS` set karo apne frontend ke asli
   URL se (jaise `ALLOWED_ORIGINS=https://mypathoerp.netlify.app`), warna ya
   to browser requests block ho jaayengi, ya (agar unset chhoda) koi bhi
   origin allow ho jaayega — dono me se koi bhi production ke liye theek
   nahi hai.

### Dono options ke liye common

- HTTPS zaroor use karo (Railway/Netlify/Vercel default me deta hai) taaki
  password aur session token network pe plain text me na jaayein.

## Aage kya improve kar sakte ho (agar chaho to)

- Sessions ko Postgres `sessions` table me move karna (abhi ek in-memory Map
  hai) — tabhi zaroori hoga jab multiple server instances chalane lage
  (single instance ke liye abhi theek hai). Shape: `labCode`, `token`,
  `createdAt` — `server/src/sessions.js` isi shape ko follow karta hai.
- Patient list ke liye pagination, jab list bahut badi ho jaaye.
- SMS/email notification jab report ready ho jaye.
- "Forgot password" flow (email verification ke saath) — abhi sirf
  logged-in state me password change ho sakta hai, agar bhool jaao to
  koi recovery nahi hai.
