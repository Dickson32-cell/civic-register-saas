"use client";
// ThemeToggle — switches the register between light and dark mode.
// The choice persists in localStorage ('zc-theme'); the pre-paint script in
// app/layout.tsx applies it before first render, so there is no flash.
// Bill pages (/bill*) always stay light — they simulate paper for printing.
import { useEffect, useState } from "react";

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
      if (m) m.setAttribute("content", next ? "#0d1411" : "#0a3b2a");
    } catch { /* meta not present */ }
    setDark(next);
  }

  const label = dark === null ? "Theme" : dark ? "Light mode" : "Dark mode";
  if (drawer) {
    return (
      <button type="button" className="drawer-item" onClick={toggle}>{label}</button>
    );
  }
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      style={{ color: "#fff", borderColor: "#2c6e4b" }}
      onClick={toggle}
    >
      {label}
    </button>
  );
}
