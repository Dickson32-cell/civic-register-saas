"use client";
// Printable bill for ONE client - Assembly-style layout (main bill + counterfoil).
// Director name: typed once, remembered in this browser, printed on the signature line.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BillSheet, { type BillData } from "@/components/BillSheet";

const DIR_KEY = "billDirectorName";

export default function BillPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<BillData | null>(null);
  const [err, setErr] = useState("");
  const [director, setDirector] = useState("");
  const [dirDraft, setDirDraft] = useState("");
  const [orient, setOrient] = useState<"portrait" | "landscape">("portrait");
  useEffect(() => {
    const saved = window.localStorage.getItem("billOrient") as "portrait" | "landscape" | null;
    if (saved === "portrait" || saved === "landscape") setOrient(saved);
  }, []);
  function saveOrient(o: "portrait" | "landscape") { setOrient(o); window.localStorage.setItem("billOrient", o); }

  useEffect(() => {
    setDirector(window.localStorage.getItem(DIR_KEY) || "");
    setDirDraft(window.localStorage.getItem(DIR_KEY) || "");
    (async () => {
      const res = await fetch(`/api/records/${params.id}/bill`);
      if (res.ok) setData(await res.json());
      else setErr(res.status === 401 ? "Please log in first." : "Bill not found.");
    })();
  }, [params.id]);

  if (err) return <p style={{ padding: 40 }}>{err}</p>;
  if (!data) return <p style={{ padding: 40 }}>Loading…</p>;

  return (
    <div style={{ background: "#eef1f6", minHeight: "100vh", padding: 18 }}>
      <style>{`
        @media print { .bill-no-print { display: none !important; } body { background: #fff !important; } }
      `}</style>
      <div className="bill-no-print" style={{ maxWidth: 820, margin: "0 auto 12px", textAlign: "right" }}>
        <label style={{ fontSize: 12, marginRight: 8 }}>
          Director name:{" "}
          <input
            value={dirDraft}
            onChange={(e) => {
              setDirDraft(e.target.value);
              setDirector(e.target.value);
              window.localStorage.setItem(DIR_KEY, e.target.value);
            }}
            placeholder="e.g. K. Mensah"
            style={{ padding: "4px 8px", border: "1px solid #bbb", borderRadius: 4, width: 180 }}
          />
        </label>
        <button className="btn btn-primary" onClick={() => window.print()}>Print bill</button>{" "}
          <label style={{ fontSize: 12, marginRight: 8 }}>
            Orientation:{" "}
            <select value={orient} onChange={(e) => saveOrient(e.target.value as "portrait" | "landscape")} style={{ padding: "2px 6px" }}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
        {" "}
        <button className="btn btn-ghost" onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.href = "/"; }}>Back</button>
      </div>
      <BillSheet data={data} directorName={director} orientation={orient} />
    </div>
  );
}