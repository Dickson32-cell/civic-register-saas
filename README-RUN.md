# CivicData — Run Book

Self-serve civic data-collection platform: organizations create their own
workspace accounts; every company's data stays in its own isolated workspace.
Data collection is free; paid services (extra staff seats, branding/logo,
bill designer) unlock with an issued key after payment is agreed directly —
the platform never holds anybody's money.

## 1. Prerequisites
- Node.js 20+ and npm
- A PostgreSQL database (Neon): the production database already lives in the
  project's dedicated Neon project. A shared database = shared data, so a new
  machine connects to the SAME database with the connection strings — do not
  create a parallel one unless you intend to.

## 2. Install
    git clone https://github.com/Dickson32-cell/civic-register-saas.git
    cd civic-register-saas
    npm install

## 3. Create `.env` (never commit it)
Copy these five keys and fill the values from the gitignored credentials file
on the owner machine (`PLATFORM-CREDS-LOCAL.txt`):

    DATABASE_URL=postgresql://<app-role>:<password>@<pooler-host>/civic_platform?sslmode=require&pgbouncer=true
    DIRECT_URL=postgresql://<app-role>:<password>@<direct-host>/civic_platform?sslmode=require
    SESSION_SECRET=<long random string>
    LICENSE_SECRET=<long random string>
    TENANT_ID=civicdemo

- `DATABASE_URL` — pooled endpoint (hostname contains `-pooler`): app runtime.
- `DIRECT_URL` — same credentials, non-pooler host: schema work only.

### Brand-new empty database only
    npx prisma db push                                   (schema)
    node scripts/create_serial_release.cjs               (serial table)
    node scripts/seed_demo_tenant.cjs                    (demo workspace + admin)
Skip this section when connecting to the live database — it already has them.

## 4. Start

One click on Windows: double-click `start.bat` (installs deps if missing,
builds if needed, serves port 3100).

Manual:

    npx prisma generate
    npm run build
    npm start          # serves http://localhost:3100

## 5. LAN / phone access (Windows)
    netsh advfirewall firewall add rule name="CivicData-3100" dir=in action=allow protocol=TCP localport=3100
Then open http://<machine-lan-ip>:3100 on the phone (same Wi-Fi network).

## 6. Updating
    git pull && npm install && npx prisma generate && npm run build
Then restart the server.

## Security notes
- Never commit `.env`, credentials files, or keys. They are gitignored.
- The app connects with a least-privilege role (`civic_app`), not the owner.
- Every company's records are visible only through its own logins; cross-company
  access returns 404 by design.
- Bills print per company with their own logo/wording once the brand service is
  unlocked; money handling stays outside the system by policy.

## Project docs
`docs-project/PLAN.md` and `docs-project/diagrams/` carry the product plan and
the architecture / onboarding / data-model diagrams.
