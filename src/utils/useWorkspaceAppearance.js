import {useEffect} from 'react';
const normalizeHex = (value, fallback = "#647687") => {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) return `#${raw.slice(1).split("").map((ch) => ch + ch).join("")}`.toLowerCase();
  return fallback;
};
const mixHex = (hex, target, ratio = 0.16) => {
  const value = normalizeHex(hex);
  const targetHex = normalizeHex(target, "#000000");
  const channel = (source, dest) => Math.round(source + (dest - source) * ratio);
  const parts = [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16));
  const targetParts = [1, 3, 5].map((start) => parseInt(targetHex.slice(start, start + 2), 16));
  return `#${parts.map((part, index) => channel(part, targetParts[index]).toString(16).padStart(2, "0")).join("")}`;
};
const contrastForHex = (hex) => {
  const value = normalizeHex(hex);
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#17191a" : "#ffffff";
};

export default function useWorkspaceAppearance(uiPreferences,workspaceSettings){
  useEffect(()=>{
    const root=document.documentElement;
    const pref=uiPreferences;
    const accent=normalizeHex(pref.accent,"#647687");
    root.style.setProperty("--accent",accent);
    root.style.setProperty("--primary",accent);
    root.style.setProperty("--primary-dark",mixHex(accent,"#000000",0.17));
    root.style.setProperty("--primary-contrast",contrastForHex(accent));
    root.style.setProperty("--sidebar-width",`${pref.sidebarWidth||277}px`);
    root.dataset.currency=workspaceSettings.organization.currency||"UZS";
    document.body.dataset.density=pref.density||"comfortable";
    document.body.dataset.sidebarMode=pref.sidebarMode||"comfortable";
    document.body.dataset.fontScale=pref.fontScale||"default";
    document.body.dataset.radius=pref.radius||"medium";
    document.body.dataset.tableDensity=pref.tableDensity||"comfortable";
    document.body.dataset.navbarCompact=String(Boolean(pref.navbarCompact));
    document.body.classList.toggle("no-card-shadow",!pref.cardShadow);
    document.body.classList.toggle("reduce-motion",Boolean(pref.reducedMotion));
    const dark=pref.theme==="dark"||(pref.theme==="system"&&window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("dark-mode",dark);
    const themeMeta=document.querySelector('meta[name="theme-color"]');
    if(themeMeta)themeMeta.setAttribute("content",dark?"#111315":"#f3f4f4");
  },[uiPreferences,workspaceSettings.organization.currency]);
}
