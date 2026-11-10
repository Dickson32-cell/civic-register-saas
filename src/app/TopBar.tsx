"use client";
// TopBar — logo + brand + user + Change Password + admin links + logout
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function TopBar({ username, role, canReviewPasswords, logoDataUrl: logoProp, tenantName }: { username: string; role: string; canReviewPasswords?: boolean; logoDataUrl?: string | null; tenantName?: string | null }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [pwOpen, setPwOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // Approvals badge — how many decisions wait in Staff/Edits/Passwords queues.
  useEffect(() => {
    if (role !== "ADMIN") return;
    let stop = false;
    const load = () => fetch("/api/admin/approvals")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!stop && j?.counts) setPendingCount(j.counts.total as number); })
      .catch(() => {});
    load();
    const t = setInterval(load, 90000);
    return () => { stop = true; clearInterval(t); };
  }, [role]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function submitPwChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(""); setPwErr(""); setPwBusy(true);
    const res = await fetch("/api/auth/password-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    });
    const data = await res.json();
    setPwBusy(false);
    if (!res.ok) { setPwErr((data.errors && data.errors[0]) || data.error || "Failed"); return; }
    setPwMsg(data.message);
    setCurPw(""); setNewPw("");
  }

  // Drawer content — admin links + actions (phones only; CSS hides on desktop)
  const drawerBody = (
    <nav className="drawer-nav" onClick={() => setDrawer(false)}>
      <a href="/" className={`drawer-item${pathname === "/" ? " nav-on" : ""}`}>Home</a>
      <a href="/map" className={`drawer-item${pathname === "/map" ? " nav-on" : ""}`}>Map</a>
      {role === "ADMIN" && (
        <>
          <a href="/admin/approvals" className={`drawer-item${pathname === "/admin/approvals" ? " nav-on" : ""}`}>
            Approvals{pendingCount ? ` (${pendingCount})` : ""}
          </a>
          <a href="/admin/interface" className={`drawer-item${pathname === "/admin/interface" ? " nav-on" : ""}`}>Interface</a>
          <a href="/admin/services" className={`drawer-item${pathname === "/admin/services" ? " nav-on" : ""}`}>Services</a>
          <a href="/admin/users" className={`drawer-item${pathname === "/admin/users" ? " nav-on" : ""}`}>Staff</a>
          <a href="/admin/edits" className={`drawer-item${pathname === "/admin/edits" ? " nav-on" : ""}`}>Edits</a>
          {canReviewPasswords && <a href="/admin/passwords" className={`drawer-item${pathname === "/admin/passwords" ? " nav-on" : ""}`}>Passwords</a>}
        </>
      )}
      <ThemeToggle drawer />
      <button type="button" className="drawer-item" onClick={() => { setDrawer(false); setPwOpen(true); }}>Change Password</button>
      <button type="button" className="drawer-item drawer-danger" onClick={logout}>Log out</button>
    </nav>
  );

  return (
    <header className="topbar" style={{ position: "relative", paddingBottom: pwOpen ? 290 : undefined }}>
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoProp || "/logo.jpg"} alt="Institution logo" className="brand-logo" />
        <div>
          <div className="t1">{tenantName || "CivicData"}</div>
          <div className="t2">on CivicData</div>
        </div>
      </div>
      <div className="who">
        <b>{username}</b> · {role === "ADMIN" ? "Administrator" : "Staff"}
        <button className="drawer-burger only-mobile" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
          <span className="burger-bars" aria-hidden="true"><i /><i /><i /></span>
          Menu
        </button>
      </div>
      <div className="drawer-scrim only-mobile" style={{ display: drawer ? "block" : "none" }} onClick={() => setDrawer(false)} />
      <aside className="drawer only-mobile" role="dialog" aria-label="Menu" style={{ transform: drawer ? "translateX(0)" : "translateX(105%)" }}>
        <div className="drawer-head">
          <span>Menu</span>
          <button type="button" className="drawer-close" aria-label="Close menu" onClick={() => setDrawer(false)}>✕</button>
        </div>
        {drawerBody}
      </aside>
      {/* Desktop/tablet inline buttons — hidden on phones (drawer replaces them) */}
      <div className="who only-desktop">
        <b>{username}</b> · {role === "ADMIN" ? "Administrator" : "Staff"} &nbsp;{" "}
        <a href="/" className={"nav-link" + (pathname === "/" ? " nav-on" : "")}>
          Home
        </a>{" "}
        <a href="/map" className={"nav-link" + (pathname.startsWith("/map") ? " nav-on" : "")}>
          Map
        </a>{" "}
        {role === "ADMIN" && (
          <>
            <a href="/admin/approvals" className={"nav-link" + (pathname.startsWith("/admin/approvals") ? " nav-on" : "")}>
              Approvals{pendingCount ? ` (${pendingCount})` : ""}
            </a>{" "}
            <a href="/admin/interface" className={"nav-link" + (pathname.startsWith("/admin/interface") ? " nav-on" : "")}>
              Interface
            </a>{" "}
            <a href="/admin/services" className={"nav-link" + (pathname.startsWith("/admin/services") ? " nav-on" : "")}>
              Services
            </a>{" "}
            <a href="/admin/users" className={"nav-link" + (pathname.startsWith("/admin/users") ? " nav-on" : "")}>
              Staff
            </a>{" "}
            <a href="/admin/edits" className={"nav-link" + (pathname.startsWith("/admin/edits") ? " nav-on" : "")}>
              Edits
            </a>{" "}
            {canReviewPasswords && (
              <a href="/admin/passwords" className={"nav-link" + (pathname.startsWith("/admin/passwords") ? " nav-on" : "")}>
                Passwords
              </a>
            )}
          </>
        )}{" "}
        <ThemeToggle />{" "}
        <button className="nav-link" onClick={() => { setPwOpen((s) => !s); setPwMsg(""); setPwErr(""); }}>
          Change Password
        </button>{" "}
        <button className="nav-link" onClick={logout}>
          Log out
        </button>
      </div>

      {/* Change Password panel — flows BELOW the topbar (no overlay, no overlap on any device) */}
      {pwOpen && (
        <form className="card pw-panel" onSubmit={submitPwChange}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 14, margin: 0 }}>Change Password</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPwOpen(false)}>Close</button>
          </div>
          <p className="sub" style={{ fontSize: 12, marginTop: 4 }}>Your new password takes effect after an administrator approves it.</p>
          {pwErr && <div className="err" style={{ fontSize: 12 }}>{pwErr}</div>}
          {pwMsg && <div className="ok-msg" style={{ fontSize: 12 }}>{pwMsg}</div>}
          <label className="fld"><span className="cap">Current Password</span>
            <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required /></label>
          <label className="fld"><span className="cap">New Password (min 8 chars)</span>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} /></label>
          <button className="btn btn-primary btn-sm" disabled={pwBusy} style={{ width: "100%", justifyContent: "center" }}>
            {pwBusy ? "Submitting..." : "Request Change"}
          </button>
        </form>
      )}

      {/* ---- PHONE BOTTOM TAB BAR (real app navigation; PC/tablet keep the top bar) ---- */}
      <nav className="tabbar" aria-label="Main navigation">
        <a className={"tab" + (pathname === "/" ? " on" : "")} href="/">
          <span className="tic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11.2 12 4l9 7.2" /><path d="M5.4 9.6V20h13.2V9.6" /></svg></span>
          <span>Home</span>
        </a>
        <a className={"tab" + (pathname.startsWith("/map") ? " on" : "")} href="/map">
          <span className="tic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.7-6.5-10.4A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.6C18.5 15.3 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.2" /></svg></span>
          <span>Map</span>
        </a>
        {role === "ADMIN" && (
          <a className={"tab" + (pathname.startsWith("/admin/approvals") ? " on" : "")} href="/admin/approvals">
            <span className="tic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="16" rx="2.5" /><path d="M9 12.2l2.3 2.3L15.5 10" /></svg>{pendingCount ? <b className="badge">{pendingCount > 99 ? "99+" : pendingCount}</b> : null}</span>
            <span>Approvals</span>
          </a>
        )}
        <button type="button" className="tab" onClick={() => setMoreOpen(true)}>
          <span className="tic"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></svg></span>
          <span>More</span>
        </button>
      </nav>
      {moreOpen && (
        <>
          <div className="tb-scrim" onClick={() => setMoreOpen(false)} />
          <div className="tb-sheet" role="dialog" aria-label="More menu">
            <div className="grip" />
            <div className="g5">
              {role === "ADMIN" && <a className="gi" href="/admin/interface">Interface</a>}
              {role === "ADMIN" && <a className="gi" href="/admin/services">Services</a>}
              {role === "ADMIN" && <a className="gi" href="/admin/users">Staff</a>}
              {role === "ADMIN" && <a className="gi" href="/admin/edits">Edits</a>}
              {role === "ADMIN" && canReviewPasswords && <a className="gi" href="/admin/passwords">Passwords</a>}
              <button type="button" className="gi" onClick={() => { setMoreOpen(false); setPwOpen((s) => !s); setPwMsg(""); setPwErr(""); }}>Change pw</button>
            </div>
            <div className="tb-foot">
              <span><b>{username}</b> · {role === "ADMIN" ? "Administrator" : "Staff"}</span>
              <span className="tb-foot-actions">
                <a href="/login" className="tb-quiet" onClick={(e) => { e.preventDefault(); setMoreOpen(false); setDrawer(false); }}>Close</a>
                <button type="button" className="tb-danger" onClick={logout}>Log out</button>
              </span>
            </div>
          </div>
        </>
      )}
    </header>
  );
}