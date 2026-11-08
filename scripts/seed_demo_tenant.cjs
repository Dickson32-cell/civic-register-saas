/* Seed the CivicData demo tenant (idempotent): tenant row, admin account,
   serial counters, trial license row, and 3 sample records (one paid).
   Run: node scripts/seed_demo_tenant.cjs   (uses .env DATABASE_URL) */
const fs = require('fs');
const path = require('path');
const bcrypt = require(path.join(process.cwd(), 'node_modules', 'bcryptjs'));

const TENANT = 'civicdemo';
const ADMIN_PW = 'Admin2026demo';

require('dotenv').config ? null : null; // Next dev loads .env itself; here we read manually
const envUrl = (() => {
  const t = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
  const m = t.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  return m ? m[1].trim() : null;
})();
if (!envUrl) { console.error('no DATABASE_URL in .env'); process.exit(1); }

const { PrismaClient } = require(path.join(process.cwd(), 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient({ datasourceUrl: envUrl.includes('connection_limit') ? envUrl : envUrl + '&connection_limit=10&pool_timeout=20' });

const AREAS = [
  { area: 'Adweso Estate', code: 'ADW. E' },
  { area: 'Adweso Town', code: 'ADW. T' },
  { area: 'Two Streams', code: 'T. S' },
  { area: 'Nyerede North', code: 'NYE. N' },
  { area: 'Nyerede South', code: 'NYE. S' },
  { area: 'Osabene Mile 50', code: 'OSA. M' },
];

async function main() {
  const trial = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  await prisma.tenant.upsert({
    where: { id: TENANT },
    update: { trialEndsAt: trial },
    create: {
      id: TENANT, name: 'Demo Council (CivicData)', template: 'FEE_REGISTER',
      colour: '#0a3b2a', areas: AREAS, ownerEmail: 'demo@civicdata.test',
      ownerName: 'Demo Owner', status: 'TRIAL', trialEndsAt: trial,
    },
  });
  console.log('[tenant] civicdemo ready (trial to', trial.toISOString().slice(0, 10) + ')');

  await prisma.licenseState.upsert({
    where: { id: TENANT },
    update: { trialEndsAt: trial },
    create: { id: TENANT, paidThrough: 100, trialEndsAt: trial },
  });

  const hash = await (await import('bcryptjs')).hash(ADMIN_PW, 10);
  await prisma.appUser.upsert({
    where: { username: 'admin' },
    update: { passwordHash: hash, active: true },
    create: { tenantId: TENANT, username: 'admin', passwordHash: hash, fullName: 'Demo Administrator', role: 'ADMIN', adminLevel: 'FULL', active: true },
  });
  console.log('[user] admin seeded (password on file in chat)');

  for (const a of AREAS) {
    await prisma.serialCounter.upsert({
      where: { tenantId_electoralArea: { tenantId: TENANT, electoralArea: a.area } },
      update: {},
      create: { tenantId: TENANT, electoralArea: a.area, lastNumber: 0 },
    });
  }
  console.log('[counters]', AREAS.length, 'areas seeded');

  const samples = [
    { area: 'Adweso Estate', name: 'Ama Serwaa', businessName: 'Serwaa Provisions', street: 'Market Road', fee: '120.00', pay: '120.00' },
    { area: 'Adweso Town', name: 'Kofi Boateng', businessName: 'Boateng Electronics', street: 'Main Street', fee: '120.00', pay: '0' },
    { area: 'Osabene Mile 50', name: 'Abena Owusu', businessName: 'Owusu Chop Bar', street: 'Mile 50 Junction', fee: '650.00', pay: '300.00' },
  ];
  for (const s of samples) {
    const exists = await prisma.feePayer.findFirst({ where: { tenantId: TENANT, name: s.name } });
    if (exists) { console.log('[skip] sample exists:', s.name); continue; }
    const updated = await prisma.serialCounter.update({
      where: { tenantId_electoralArea: { tenantId: TENANT, electoralArea: s.area } },
      data: { lastNumber: { increment: 1 } },
    });
    const serial = `${AREAS.find(a => a.area === s.area).code}/ ${String(updated.lastNumber).padStart(2, '0')}`;
    const rec = await prisma.feePayer.create({
      data: {
        tenantId: TENANT, serialNumber: serial, electoralArea: s.area, name: s.name,
        businessName: s.businessName, telephone: '0200000000', streetName: s.street,
        fee: s.fee, status: 'UNPAID', recordStatus: 'ACTIVE',
      },
    });
    await prisma.fee.create({ data: { tenantId: TENANT, feePayerId: rec.id, amount: s.fee, description: 'Registration fee' } });
    if (s.pay !== '0') {
      await prisma.payment.create({ data: { tenantId: TENANT, feePayerId: rec.id, amount: s.pay, method: 'CASH' } });
      await prisma.feePayer.update({ where: { id: rec.id }, data: { status: 'PAID' } });
    }
    await prisma.auditLog.create({
      data: { tenantId: TENANT, userId: null, action: 'CREATE_RECORD', entityType: 'FEE_PAYER', entityId: rec.id, details: { serial, name: s.name, seed: true } },
    });
    console.log('[record]', serial, s.name, s.pay !== '0' ? '(paid)' : '(unpaid)');
  }
}
main().then(() => process.exit(0)).catch(e => { console.error('ERR', e.message); process.exit(1); });