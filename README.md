# Adweso Zonal Council — Temporal Structures Fee Register

Official fee register for temporal structures (kiosks, containers, stalls)
under the **Adweso Zonal Council**, New Juaben South Municipal Assembly.

## Logins

| Role | Username | Password | Access |
|---|---|---|---|
| Administrator | `admin` | *Set via ADMIN_PASSWORD env at seed time — ask the council administrator* | Everything |

*(Additional staff accounts are created by the admin inside the system.
Never commit real passwords to this repository.)*

## What it does

- Registers fee payers with automatic serial numbers per Electoral Area
- Tracks fees (GH₵), cash payments, balances — all math computed by the system
- Marks records PAID → Balance and Total both read GH₵ 0.00
- Filters by area/status/search; per-area summaries; **grand totals on every view**
- Exports CSV (Excel) and prints cleanly (A4)
- Immutable audit trail: every create, payment, and status change is logged

## Serial numbers (confirmed by the Council)

| Electoral Area | Format | Example |
|---|---|---|
| Adweso Estate | ADW. E/ NN | ADW. E/ 01 |
| Adweso Town | ADW. T/ NN | ADW. T/ 01 |
| Two Streams | T. S/ NN | T. S/ 01 |
| Nyerede North | NYE. N/ NN | NYE. N/ 01 |
| Nyerede South | NYE. S/ NN | NYE. S/ 01 |
| Osabene Mile 50 | OSA. M/ NN | OSA. M/ 01 |

Each area counts independently. Numbers are never reused — deleting a record
does not free its serial (council-registers integrity).

## Walkthrough (end to end)

1. Open the site → login page appears → sign in with the admin credentials
   issued by the council administrator
2. You land on the **Register** — the official list with grand totals at the bottom
3. Click **New Record**:
   - Serial Number box reads "Select an Electoral Area to generate"
   - Fill Name, Business Name, Telephone (10 digits, starts 0)
   - **Select Electoral Area** → the serial appears instantly (e.g. "ADW. T/ 05")
   - Fill Street Name, Fee (GH₵) → **Save Record**
   - Green confirmation shows the serial assigned
4. The record appears in the table, UNPAID, Balance = Fee
5. **Two ways to settle:**
   - **Pay** (partial or full cash): enter the amount received → Balance drops.
     Paying the remainder automatically flips it to PAID.
   - **Mark Paid** (full settlement in one click): system records the remaining
     balance as cash received → Balance AND Total both show **GH₵ 0.00**
6. **Reports:** filter by Electoral Area / status / search; grand totals update
   live; per-area summary cards show counts, billed, collected, outstanding
7. **Export CSV** for Excel, or **Print** for council meetings (clean A4 layout)
8. **Log out** (top right) — session expires after 8 hours automatically

## Architecture

```
Browser (Next.js UI, server-guarded pages)
   → API routes (/api/records, /api/records/[id], /api/auth/*)
     → Engine (transactional serial allocation, DECIMAL money math,
       auto-settlement, audit writer)
       → PostgreSQL (Neon, isolated `adweso_register` database)
```

- Money stored as DECIMAL(12,2) — never floating point
- Serial allocation is transaction-locked — two staff saving at the same
  moment can never receive the same number
- All money columns are computed (SUM of fee rows − SUM of payment rows);
  staff never type a balance
- Sessions: bcrypt password + httpOnly cookie, 8h expiry
- Every mutation writes to an append-only audit log (user, action,
  before/after, timestamp)

## Verification (completed)

- Engine steel thread: 12/12 (counters independent per area, money math,
  mark-paid zeroing, ledger consistency)
- HTTP end-to-end: 9/9 behaviors (serial preview, incremental serials,
  partial payment, overpayment rejection, mark paid → 0.00, bad input
  rejection, unauthenticated access blocked)
- Production build: clean, 11 routes, zero TS errors
- Test data removed; counters deliberately left advanced (never reuse)

## Setup (developer)

```bash
npm install
npx prisma db push        # apply schema to DATABASE_URL
node prisma/seed.js       # serial counters + admin user
npm run build && npx next start
```

## Notes

- Database: Neon PostgreSQL `adweso_register` (isolated from FarmLink)
- Deployment: private Vercel project (production data — no public access)
- v1 scope: register, payments, reports. Out of scope: MoMo, SMS, photos, map.