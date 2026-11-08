// READ-ONLY GPS quality audit across the shared council DB.
// Prints per-council coverage, dupes, zero-points, and distance from the
// council's expected center. No writes of any kind.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CENTERS = {
  adweso:   [6.0934, -0.2591, "Koforidua"],
  anlotown: [6.0934, -0.2591, "Koforidua"],
  betom:    [6.0934, -0.2591, "Koforidua"],
  newtown:  [6.0934, -0.2591, "Koforidua"],
  nkukwao:  [6.0934, -0.2591, "Koforidua"],
  oldestate:[6.0934, -0.2591, "Koforidua"],
  srodae:   [6.0934, -0.2591, "Koforidua"],
  oguaa:    [6.0934, -0.2591, "Koforidua"],
  ogua:     [6.0934, -0.2591, "Koforidua"],
};

function havKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

(async () => {
  const rows = await prisma.feePayer.groupBy({
    by: ["councilId"],
    _count: { _all: true },
    where: { recordStatus: "ACTIVE" },
  });
  console.log("council | active | hasGps | w/oGps | dupPoints | far>2km | far>10km | farthest(km)");
  let allGps = 0, allRows = 0;
  for (const g of rows.sort((a, b) => a.councilId.localeCompare(b.councilId))) {
    const c = g.councilId;
    const recs = await prisma.feePayer.findMany({
      where: { councilId: c, recordStatus: "ACTIVE" },
      select: { latitude: true, longitude: true },
    });
    const n = recs.length;
    const gps = recs.filter((r) => r.latitude != null && r.longitude != null);
    allRows += n; allGps += gps.length;
    // duplicate coordinate fingerprints
    const seen = new Map();
    for (const r of gps) {
      const key = `${r.latitude.toFixed(6)}|${r.longitude.toFixed(6)}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    const dups = Array.from(seen.values()).filter((v) => v > 1).length;
    const [clat, clon] = CENTERS[c] || [6.09, -0.26];
    let far2 = 0, far10 = 0, farthest = 0, farthestWho = "";
    for (const r of gps) {
      const km = havKm(Number(r.latitude), Number(r.longitude), clat, clon);
      if (km > 2) far2++;
      if (km > 10) far10++;
      if (km > farthest) { farthest = km; farthestWho = `${Number(r.latitude)},${Number(r.longitude)}`; }
    }
    // zero/origin signature
    const zeros = gps.filter((r) => Math.abs(Number(r.latitude)) < 0.001 && Math.abs(Number(r.longitude)) < 0.001).length;
    console.log(
      `${c} | ${n} | ${gps.length} | ${n - gps.length} | ${dups} | ${far2} | ${far10} | ${farthest.toFixed(1)} (${farthestWho})` +
      (zeros ? ` | ZERO-POINTS: ${zeros}` : "")
    );
  }
  console.log(`TOTAL | ${allRows} | ${allGps} | ${allRows - allGps}`);
  await prisma.$disconnect();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });