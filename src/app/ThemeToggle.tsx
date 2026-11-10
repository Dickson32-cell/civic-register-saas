"use client";
// ThemeToggle — light/dark switch on every screen size (PC, tablet, phone).
// A real switch control (not a labelled text button) with sun/moon marks.
// Choice persists in localStorage ('zc-theme'); the pre-paint script in
// app/layout.tsx applies it before first render, so there is no flash.
// Bill pages (/bill*) always stay light — they simulate paper for printing.
import { useEffect, useState } from "react";

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.5 14.5A8.8 8.8 0 0 1 9.5 3.5a8.8 8.8 0 1 0 11 11Z" />
    </svg>
  );
}

export default function ThemeToggle({ drawer = false }: { drawer?: boolean }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    let d = document.documentElement.getAttribute("data-theme") === "dark";
    try {
      // re-apply the stored theme after hydration — heals any pre-paint failure
      const stored = localStorage.getItem("zc-theme");
      if (stored === "dark" && !d) { document.documentElement.setAttribute("data-theme", "dark"); d = true; }
      else if (stored === "light" && d) { document.documentElement.removeAttribute("data-theme"); d = false; }
    } catch { /* private mode */ }
    setDark(d);
  }, []);

  function toggle() {
    const next = !(document.documentElement.getAttribute("data-theme") === "dark");
    if (next) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem("zc-theme", next ? "dark" : "light"); } catch { /* private mode */ }
    try {
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute("content", next ? "#0d1411" : "#1c3f6e");
    } catch { /* meta not present */ }
    setDark(next);
  }

  const checked = dark === true;
  if (drawer) {
    return (
      <div className="drawer-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--navy)", pointerEvents: "none" }}>Dark mode</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label="Dark mode"
          className="theme-switch"
          onClick={toggle}
        >
          <span className="ts-icon ts-sun"><SunIcon /></span>
          <span className="ts-icon ts-moon"><MoonIcon /></span>
          <span className="ts-knob" />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? "Switch to light mode" : "Switch to dark mode"}
      className="theme-switch"
      onClick={toggle}
      title={checked ? "Light mode" : "Dark mode"}
    >
      <span className="ts-icon ts-sun"><SunIcon /></span>
      <span className="ts-icon ts-moon"><MoonIcon /></span>
      <span className="ts-knob" />
    </button>
  );
}
