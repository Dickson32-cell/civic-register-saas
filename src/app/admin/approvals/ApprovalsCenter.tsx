"use client";
// ApprovalsCenter — three queues in one screen: staff signups, edit requests,
// password requests. Approve/Reject calls the existing guarded endpoints.
import { useCallback, useEffect, useState } from "react";

type Item = {
  kind: "staff" | "edit" | "password";
  id: string;
  desc: string;
  requestedAt: string;
  accountActive?: boolean;
};

type Data = {
  perms: { manageUsers: boolean; reviewEdits: boolean; reviewPasswords: boolean };
  counts: { staff: number; edits: number; passwords: number; total: number };
  staff: Item[];
  edits: Item[];
  passwords: Item[];
};

const SECTIONS: Array<{
  key: keyof Omit<Data, "perms" | "counts">;
  title: string;
  empty: string;
  gate: (p: Data["perms"]) => boolean;
  hint: string;
}> = [
  {
    key: "staff",
    title: "New staff accounts",
    empty: "No staff waiting for approval.",
    gate: (p) => p.manageUsers,
    hint: "People who registered themselves. Approve to give them access.",
  },
  {
    key: "edits",
    title: "Record edit requests",
    empty: "No edit requests waiting.",
    gate: (p) => p.reviewEdits,
    hint: "Changes staff want made to records. Approve = applied to the record.",
  },
  {
    key: "passwords",
    title: "Password change requests",
    empty: "No password requests waiting.",
    gate: (p) => p.reviewPasswords,
    hint: "Requests from accounts. Approve = the new password takes effect.",
  },
];

export default function ApprovalsCenter() {
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/approvals");
    if (res.ok) setData((await res.json()) as Data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(item: Item, decision: "approve" | "reject") {
    setBusyId(item.id);
    setMsg("");
    try {
      const url =
        item.kind === "staff"
          ? "/api/admin/users"
          : item.kind === "edit"
            ? "/api/admin/edits"
            : "/api/admin/passwords";
      const body =
        item.kind === "staff"
          ? JSON.stringify({ userId: item.id, action: decision })
          : item.kind === "edit"
            ? JSON.stringify({ editId: item.id, decision })
            : JSON.stringify({ requestId: item.id, decision });
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
      const j = (await res.json().catch(() => ({}))) as { error?: string; deleted?: string };
      if (!res.ok) {
        setMsg(j.error || `Could not ${decision} — try again.`);
      } else if (decision === "approve") {
        setMsg(j.deleted ? "Account removed." : `Approved: ${item.desc}`);
      } else {
        setMsg("Rejected.");
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return <div className="card" style={{ padding: 16 }}>Loading approvals…</div>;

  const { counts, perms } = data;

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>Approvals</h2>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Everything waiting for a decision, in one place.
          {counts.total > 0 ? `${counts.total} waiting.` : "Nothing waiting — inbox zero."}
        </div>
      </div>

      {msg && (
        <div style={{ margin: "0 0 12px", padding: "10px 14px", background: "var(--blue-soft)", color: "var(--navy)", borderRadius: 8, fontSize: 14 }}>
          {msg}
        </div>
      )}

      {SECTIONS.filter((s) => s.gate(perms)).map((s) => {
        const items = data[s.key] as Item[];
        return (
          <div className="card" key={s.key} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>{s.title}</h2>
              {items.length > 0 && (
                <span style={{ background: "var(--navy)", color: "#fff", borderRadius: 999, fontSize: 12, padding: "2px 9px", fontWeight: 700 }}>
                  {items.length} waiting
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>{s.hint}</div>
            {items.length === 0 ? (
              <div style={{ fontSize: 14, color: "var(--muted)" }}>{s.empty}</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {items.map((it) => (
                  <div key={`${it.kind}-${it.id}`} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 260px" }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{it.desc}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        requested {new Date(it.requestedAt).toLocaleString()}
                        {it.kind === "password" && it.accountActive === false ? " · account not yet staff-approved" : ""}
                      </div>
                    </div>
                    <button className="btn btn-primary btn-sm" disabled={busyId === it.id} onClick={() => act(it, "approve")}>
                      Approve
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busyId === it.id} onClick={() => act(it, "reject")}>
                      Reject
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
