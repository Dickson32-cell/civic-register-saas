// OWNERSHIP E2E — proves the staff-responsibility model end to end:
//   1. staffA creates an entry   -> createdBy = staffA
//   2. staffB CANNOT pay staffA's entry  (403)
//   3. staffA CAN pay own entry (200)
//   4. staffB CANNOT edit staffA's entry (403)
//   5. staffA CAN edit own entry (200)
//   6. admin sees createdBy on the list
//   7. cleanup: delete test entry (serial retired), delete test staff; real staff untouched.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const BASE = "http://localhost:3111";
const p = new PrismaClient();

async function login(username, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const cookie = r.headers.get("set-cookie")?.split(";")[0];
  return cookie;
}

async function api(cookie, method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

(async () => {
  const pass = "OwnTest2026!";
  const hash = await bcrypt.hash(pass, 10);
  const a = await p.appUser.upsert({ where: { councilId_username: { councilId: "adweso", username: "ownTestA" } }, update: { passwordHash: hash, active: true, role: "STAFF", adminLevel: null }, create: { councilId: "adweso", username: "ownTestA", passwordHash: hash, fullName: "Owner Test A", role: "STAFF", active: true } });
  const b = await p.appUser.upsert({ where: { councilId_username: { councilId: "adweso", username: "ownTestB" } }, update: { passwordHash: hash, active: true, role: "STAFF", adminLevel: null }, create: { councilId: "adweso", username: "ownTestB", passwordHash: hash, fullName: "Owner Test B", role: "STAFF", active: true } });

  const cookieA = await login("ownTestA", pass);
  const cookieB = await login("ownTestB", pass);
  const cookieAdm = await login("admin", process.env.ADMIN_PW);
  console.log("logins:", cookieA ? "A ok" : "A FAIL", "|", cookieB ? "B ok" : "B FAIL", "|", cookieAdm ? "admin ok" : "admin FAIL");

  // 1. A creates
  const create = await api(cookieA, "POST", "/api/records", { name: "Own Test Payer", businessName: "OTB", telephone: "0240000099", electoralArea: "Adweso Town", streetName: "Own St", fee: "200" });
  console.log("1. A creates entry:", create.status, create.data?.record?.serialNumber);
  const rid = create.data?.record?.id;

  // 2. B pays A's entry -> must 403
  const payB = await api(cookieB, "POST", `/api/records/${rid}/payments`, { amount: "50" });
  console.log("2. B pays A's entry:", payB.status, payB.status === 403 ? "(BLOCKED - correct)" : "(HOLE!)", payB.data?.error?.slice(0, 50));

  // 3. A pays own -> 200
  const payA = await api(cookieA, "POST", `/api/records/${rid}/payments`, { amount: "50" });
  console.log("3. A pays own entry:", payA.status, "balance:", payA.data?.totals?.balance);

  // 4. B edits A's entry -> 403
  const editB = await api(cookieB, "PATCH", `/api/records/${rid}`, { name: "Hacked Name" });
  console.log("4. B edits A's entry:", editB.status, editB.status === 403 ? "(BLOCKED - correct)" : "(HOLE!)", editB.data?.error?.slice(0, 50));

  // 5. A edits own -> 200
  const editA = await api(cookieA, "PATCH", `/api/records/${rid}`, { name: "Own Test Payer Fixed" });
  console.log("5. A edits own entry:", editA.status, editA.data?.record ? "(ok)" : editA.data);

  // 6. admin list shows createdBy
  const list = await api(cookieAdm, "GET", "/api/records/list");
  const row = list.data?.records?.find((r) => r.id === rid);
  console.log("6. admin sees createdBy:", row?.createdByUsername, "(expect ownTestA)");

  // 7. cleanup
  await p.feePayer.update({ where: { id: rid }, data: { recordStatus: "INACTIVE" } });
  await p.feePayer.update({ where: { id: rid }, data: { createdBy: null } }); // detach so user delete cascades cleanly
  await p.appUser.delete({ where: { id: a.id } });
  await p.appUser.delete({ where: { id: b.id } });
  const survivors = await p.appUser.findMany({ where: { councilId: "adweso" }, select: { username: true } });
  console.log("7. cleanup done. users:", survivors.map((u) => u.username).join(", "), "(must include admin, Dickson32, Joseph, Manuel)");
  await p.$disconnect();
})().catch((e) => { console.error("E2E FAILED:", e.message); process.exit(1); });