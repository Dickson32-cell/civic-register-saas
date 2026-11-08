"use client";
// MapClient — view-only map of registered structures (temporal structures and
// properties). Markers are colored by what the structure is (amber = container
// / temporal, green = property/shop). Tapping a pin shows its record; a button
// on the popup hands over to the register and opens that record's detail.
// Money is NEVER rendered here. Leaflet loads only in the browser.
import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type Rec = {
  id: string;
  serialNumber: string;
  name: string;
  businessName: string;
  electoralArea: string;
  streetName: string;
  businessType: string | null;
  containerSize: string | null;
  containerCategory: string | null;
  latitude: number | null;
  longitude: number | null;
  hasGps: boolean;
  status: string;
};

const KOFORIDUA: [number, number] = [6.0934, -0.2591];
const GREEN = "#0a3b2a";
const AMBER = "#b45309";
const GREY = "#6b7280";

export default function MapClient({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [error, setError] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<unknown>(null);
  const baseRef = useRef<unknown>(null);
  const labelsRef = useRef<unknown>(null);
  const [mode, setMode] = useState<"satellite" | "street">("satellite");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/records/list");
        if (!res.ok) {
          if (alive) setError(res.status === 401 ? "Your session expired. Log in again." : "Could not load records.");
          return;
        }
        const data = await res.json();
        if (alive) setRows(data.records as Rec[]);
      } catch {
        if (alive) setError("Network problem — the map needs a connection to load.");
      }
    })();
    return () => { alive = false; };
  }, []);

  const areas = useMemo(() => {
    if (!rows) return [];
    return Array.from(new Set(rows.map((r) => r.electoralArea).filter(Boolean))).sort();
  }, [rows]);

  const isTemporal = (r: Rec) => !!(r.containerSize || r.containerCategory);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (areaFilter && r.electoralArea !== areaFilter) return false;
      if (typeFilter === "temporal" && !isTemporal(r)) return false;
      if (typeFilter === "property" && isTemporal(r)) return false;
      return true;
    });
  }, [rows, areaFilter, typeFilter]);

  const withGps = useMemo(() => filtered.filter((r) => r.hasGps), [filtered]);
  const missingGps = useMemo(() => (rows || []).filter((r) => !r.hasGps), [rows]);
  const temporalCount = useMemo(() => (rows || []).filter(isTemporal).length, [rows]);
  const propertyCount = useMemo(() => (rows || []).length - temporalCount, [rows, temporalCount]);

  // Build the map + markers in the browser only.
  useEffect(() => {
    if (!rows) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;

      if (!mapRef.current) {
        const el = document.getElementById("zc-map") as HTMLDivElement | null;
        if (!el) return;
        const map = L.map(el, { zoomControl: true, attributionControl: true }).setView(KOFORIDUA, 14);
        mapRef.current = map;
        markersRef.current = L.layerGroup().addTo(map);
      }

      // Base layer follows the Satellite/Street toggle. Satellite (Esri World
      // Imagery) is the default; labels are drawn on top so towns stay readable.
      const map = mapRef.current as import("leaflet").Map;
      if (baseRef.current) { map.removeLayer(baseRef.current as import("leaflet").Layer); baseRef.current = null; }
      if (labelsRef.current) { map.removeLayer(labelsRef.current as import("leaflet").Layer); labelsRef.current = null; }
      if (mode === "satellite") {
        const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          maxNativeZoom: 19, maxZoom: 20,
          attribution: 'Imagery &copy; <a href="https://www.arcgis.com/">Esri</a>, Maxar, Earthstar Geographics',
        }).addTo(map);
        const labels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
          maxNativeZoom: 19, maxZoom: 20,
        }).addTo(map);
        baseRef.current = sat;
        labelsRef.current = labels;
      } else {
        baseRef.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
      }
      const group = markersRef.current as import("leaflet").LayerGroup;
      group.clearLayers();

      for (const r of withGps) {
        const color = r.containerSize || r.containerCategory ? AMBER : r.containerSize === null && !r.businessType ? GREY : GREEN;
        const icon = L.divIcon({
          className: "",
          html:
            '<span style="display:block;width:14px;height:14px;border-radius:50%;background:' + color +
            ';border:2px solid #ffffff;box-shadow:0 0 0 1px rgba(0,0,0,0.35);"></span>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          popupAnchor: [0, -8],
        });
        const label = r.businessName ? r.businessName : r.name || "(unnamed)";
        const sizeCat = [r.containerSize, r.containerCategory ? "CAT " + r.containerCategory : ""].filter(Boolean).join(" — ");
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const html =
          '<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.45;min-width:220px;">' +
          '<div style="font-weight:700;margin-bottom:2px;">' + esc(label) + "</div>" +
          '<div style="color:#374151;">' + esc(r.serialNumber || "") + " · " + esc(r.electoralArea || "") + "</div>" +
          (r.streetName ? '<div style="color:#374151;">' + esc(r.streetName) + "</div>" : "") +
          '<div style="color:#374151;">' +
          (sizeCat ? esc(sizeCat) : esc(r.businessType || "Property / shop")) +
          " · " + (r.status === "PAID" ? "Paid" : "Unpaid") + "</div>" +
          '<div style="margin-top:6px;display:flex;gap:6px;">' +
          '<button type="button" data-zc-serial="' + esc(r.serialNumber || "") +
          '" style="border:0;border-radius:6px;padding:5px 9px;background:#0a3b2a;color:#fff;font-weight:700;font-size:12px;cursor:pointer;">Open record</button>' +
          (r.latitude != null && r.longitude != null
            ? '<a href="https://www.google.com/maps?q=' + r.latitude + "," + r.longitude +
              '" target="_blank" rel="noopener" style="text-decoration:none;border:1px solid #d1d5db;border-radius:6px;padding:4px 9px;font-size:12px;color:#111827;">Directions</a>'
            : "") +
          "</div></div>";

        const m = L.marker([r.latitude as number, r.longitude as number], { icon }).bindPopup(html, { maxWidth: 280 });
        group.addLayer(m);
        m.on("popupopen", (e: import("leaflet").LeafletEvent) => {
          const root = (e.popup.getElement() as HTMLElement) || document;
          const btn = root.querySelector("[data-zc-serial]") as HTMLButtonElement | null;
          if (btn) {
            btn.onclick = () => {
              try { window.sessionStorage.setItem("mapFocusSerial", btn.getAttribute("data-zc-serial") || ""); } catch {}
              window.location.href = "/";
            };
          }
        });
      }

      const pts = withGps.map((r) => [r.latitude as number, r.longitude as number] as [number, number]);
      if (pts.length === 1) {
        map.setView(pts[0], 17);
      } else if (pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts).pad(0.25));
      }
    })();
    return () => { cancelled = true; };
  }, [rows, withGps, mode]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="card" style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <strong style={{ fontSize: 15 }}>Property &amp; Structure Map</strong>
          <span className="sub" style={{ fontSize: 12 }}>
            {rows
              ? `Plotted ${withGps.length} of ${(rows || []).length}${isAdmin ? "" : ""} · Temporal/containers ${temporalCount} · Properties/shops ${propertyCount}`
              : "Loading records..."}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" onClick={() => setMode("satellite")} style={{ borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid " + (mode === "satellite" ? "transparent" : "var(--line, #e5e7eb)"), background: mode === "satellite" ? "#0a3b2a" : "transparent", color: mode === "satellite" ? "#ffffff" : "var(--ink, #111827)" }}>
                Satellite
              </button>
              <button type="button" onClick={() => setMode("street")} style={{ borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid " + (mode === "street" ? "transparent" : "var(--line, #e5e7eb)"), background: mode === "street" ? "#0a3b2a" : "transparent", color: mode === "street" ? "#ffffff" : "var(--ink, #111827)" }}>
                Street
              </button>
            </div>
            <select className="fld" style={{ padding: "6px 8px" }} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} aria-label="Filter by electoral area">
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select className="fld" style={{ padding: "6px 8px" }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by structure type">
              <option value="">All types</option>
              <option value="property">Properties / shops</option>
              <option value="temporal">Containers / temporal</option>
            </select>
          </div>
        </div>
        <div className="sub" style={{ fontSize: 12, marginTop: 4 }}>
          Pins: <span style={{ color: GREEN, fontWeight: 700 }}>&#9679;</span> property/shop &nbsp;
          <span style={{ color: AMBER, fontWeight: 700 }}>&#9679;</span> container/temporal &nbsp;
          <span style={{ color: GREY, fontWeight: 700 }}>&#9679;</span> unclassified.
          Positions come from the GPS captured at registration. This map is staff/admin-only — no money figures are shown.
        </div>
      </div>

      {error && <div className="err" style={{ padding: "8px 12px" }}>{error}</div>}

      <div
        id="zc-map"
        style={{
          height: "min(68vh, 620px)",
          borderRadius: 10,
          border: "1px solid var(--line, #e5e7eb)",
          boxShadow: "var(--shadow, none)",
          background: "#dfe6df",
          zIndex: 0,
        }}
      />

      <details className="card" style={{ padding: "10px 12px" }}>
        <summary style={{ fontWeight: 700, cursor: "pointer" }}>
          Registered without GPS — {missingGps.length} record{missingGps.length === 1 ? "" : "s"}
        </summary>
        <div className="sub" style={{ fontSize: 12, margin: "6px 0" }}>
          These do not appear on the map. Open the record in the register and use &quot;Pick GPS Again&quot; to add its position.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 6 }}>
          {missingGps.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--line, #e5e7eb)", borderRadius: 8, padding: "6px 8px", fontSize: 13 }}>
              <b>{r.serialNumber || "(no serial)"}</b> · {r.name || r.businessName || "(unnamed)"}
              <div className="sub" style={{ fontSize: 12 }}>{r.electoralArea || "—"}</div>
            </div>
          ))}
          {missingGps.length === 0 && <div className="sub" style={{ fontSize: 12 }}>Every registered record has GPS. Well done.</div>}
        </div>
      </details>
    </div>
  );
}