import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "./icons.js";
import { TunnelCard, type ActionKind } from "./components/Card.js";
import { NewTunnelModal } from "./screens/NewTunnelModal.js";
import { DetailDrawer } from "./screens/DetailDrawer.js";
import { SettingsPage } from "./screens/SettingsPage.js";
import { EmptyState } from "./screens/EmptyState.js";
import {
  TweaksPanel, TweakSection, TweakColor, TweakSelect, TweakRadio, TweakSlider,
  useTweaks, type TweakValues,
} from "./tweaks.js";
import { toView } from "./lib/tm.js";
import { api, subscribeLogs, subscribeTunnels } from "./api.js";
import type { LogLine, PreflightResult, Settings, Tunnel, TunnelSpec, WireTunnel } from "./types.js";

const TWEAK_DEFAULTS: TweakValues = {
  accent: "#7c5cff",
  density: "regular",
  layout: "grid",
  radius: 14,
  font: "Geist",
};

function hexToRgb(hex: string): string {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

const FONTS: Record<string, { sans: string; mono: string }> = {
  Geist: { sans: '"Geist", sans-serif', mono: '"Geist Mono", monospace' },
  Inter: { sans: '"Inter", sans-serif', mono: '"JetBrains Mono", monospace' },
  "IBM Plex": { sans: '"IBM Plex Sans", sans-serif', mono: '"IBM Plex Mono", monospace' },
};
const DENSITY: Record<string, { pad: string; gap: string }> = {
  compact: { pad: "14px", gap: "11px" },
  regular: { pad: "20px", gap: "16px" },
  comfy: { pad: "26px", gap: "22px" },
};

const DEFAULT_SETTINGS: Settings = {
  jumpHost: "", jumpHosts: [], sshLogin: "", keyPath: "", portFrom: 8000, portTo: 9999, interval: 10,
};

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("tm-theme") || "dark");
  const [view, setView] = useState<"dashboard" | "settings">("dashboard");
  const [wire, setWire] = useState<WireTunnel[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "issues" | "inactive">("all");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Tunnel | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  // ---- theme + tweak CSS vars ----
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("tm-theme", theme);
  }, [theme]);

  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--accent", t.accent);
    r.setProperty("--accent-rgb", hexToRgb(t.accent));
    r.setProperty("--radius", t.radius + "px");
    r.setProperty("--radius-sm", Math.max(4, t.radius - 5) + "px");
    r.setProperty("--radius-xs", Math.max(3, t.radius - 8) + "px");
    const d = DENSITY[t.density] || DENSITY.regular;
    r.setProperty("--pad", d.pad);
    r.setProperty("--gap", d.gap);
    const f = FONTS[t.font] || FONTS.Geist;
    r.setProperty("--font-sans", f.sans);
    r.setProperty("--font-mono", f.mono);
  }, [t.accent, t.radius, t.density, t.font]);

  // ---- initial load + live state subscription ----
  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
    api.listTunnels().then(setWire).catch(() => {});
    const unsub = subscribeTunnels(setWire);
    return unsub;
  }, []);

  const refreshPreflight = useCallback((jumpHost = settings.jumpHost) => {
    if (!jumpHost) return;
    api.getPreflight(jumpHost).then((result) => {
      if (jumpHost === settings.jumpHost) setPreflight(result);
    }).catch(() => {
      setPreflight({
        status: "error",
        checkedAt: Date.now(),
        jumpHost,
        dns: { ok: false, detail: "Preflight request failed", latency: null },
        sshPort: { ok: false, detail: "Preflight request failed", latency: null },
        loginConfigured: Boolean(settings.sshLogin),
        keyMode: settings.keyPath ? "file" : "agent",
        message: "Unable to check corporate VPN",
      });
    });
  }, [settings.jumpHost, settings.keyPath, settings.sshLogin]);

  useEffect(() => {
    if (!settings.jumpHost) return;
    refreshPreflight(settings.jumpHost);
    const iv = setInterval(() => refreshPreflight(settings.jumpHost), 30_000);
    return () => clearInterval(iv);
  }, [settings.jumpHost, settings.sshLogin, settings.keyPath, refreshPreflight]);

  // ---- 1s ticker to refresh derived "last check / uptime" fields ----
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // ---- per-tunnel log stream while a drawer is open ----
  useEffect(() => {
    if (!openId) { setLogs([]); return; }
    setLogs([]);
    const unsub = subscribeLogs(openId, (line) => setLogs((prev) => [...prev.slice(-300), line]));
    return unsub;
  }, [openId]);

  const tunnels: Tunnel[] = useMemo(() => wire.map((x) => toView(x, now)), [wire, now]);

  // ---- actions (route to the API; SSE pushes the resulting state) ----
  const toggle = useCallback((tn: Tunnel) => {
    const on = tn.status === "active" || tn.status === "connecting";
    if (on) {
      api.stop(tn.id).then(() => showToast(`${tn.name} stopped`)).catch((e: Error) => showToast(e.message));
      return;
    }
    const login = settings.sshLogin;
    const jumpHost = tn.jumpHost || settings.jumpHost;
    if (!login) {
      setView("settings");
      showToast("Enter your SSH login first");
      return;
    }
    api.getPreflight(jumpHost).then((result) => {
      if (jumpHost === settings.jumpHost) setPreflight(result);
      if (result.status === "error") {
        showToast(result.message);
        return;
      }
      api.start(tn.id).then((updated) => {
        showToast(updated.status === "error" ? (updated.error || "Tunnel failed to start") : `${tn.name} starting…`);
      }).catch((e: Error) => showToast(e.message));
    }).catch((e: Error) => showToast(e.message));
  }, [settings.jumpHost, settings.sshLogin, showToast]);

  const action = useCallback((kind: ActionKind, tn: Tunnel) => {
    if (kind === "delete") {
      api.deleteTunnel(tn.id).then(() => {
        if (openId === tn.id) setOpenId(null);
        showToast(`${tn.name} deleted`);
      }).catch((e: Error) => showToast(e.message));
    } else if (kind === "restart") {
      api.restart(tn.id).then(() => showToast(`${tn.name} restarting…`)).catch((e: Error) => showToast(e.message));
    } else if (kind === "edit") {
      setEditing(tn);
      setShowNew(true);
    }
  }, [openId, showToast]);

  const submit = useCallback((spec: TunnelSpec, editingId?: string) => {
    const call = editingId ? api.updateTunnel(editingId, spec) : api.createTunnel(spec);
    call.then((created) => {
      setShowNew(false);
      setEditing(null);
      if (!editingId) setOpenId(created.id);
      showToast(`${created.name} ${editingId ? "updated" : "created"}`);
    }).catch((e: Error) => showToast(e.message));
  }, [showToast]);

  const saveSettings = useCallback((next: Settings) => {
    api.saveSettings(next).then(setSettings).catch((e: Error) => showToast(e.message));
  }, [showToast]);

  // ---- derived ----
  const counts = tunnels.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; a.all++; return a; },
    { all: 0 } as Record<string, number> & { all: number });
  const issues = (counts.error || 0) + (counts.connecting || 0);

  const filtered = tunnels.filter((x) => {
    if (filter === "active" && x.status !== "active") return false;
    if (filter === "issues" && !(x.status === "error" || x.status === "connecting")) return false;
    if (filter === "inactive" && x.status !== "inactive") return false;
    if (query) {
      const q = query.toLowerCase();
      if (!(x.name.toLowerCase().includes(q) || x.host.toLowerCase().includes(q) ||
        String(x.port).includes(q) || String(x.localPort).includes(q))) return false;
    }
    return true;
  });

  const openTunnel = openId ? tunnels.find((x) => x.id === openId) ?? null : null;

  const healthSummary = (
    <div className="health-pill">
      <span className="seg"><span className="dot" style={{ background: "var(--st-active)", boxShadow: "0 0 7px var(--st-active)" }} /><b>{counts.active || 0}</b> active</span>
      {(counts.connecting || 0) > 0 && <span className="seg"><span className="dot" style={{ background: "var(--st-connecting)" }} /><b>{counts.connecting}</b> connecting</span>}
      {(counts.error || 0) > 0 && <span className="seg"><span className="dot" style={{ background: "var(--st-error)" }} /><b>{counts.error}</b> error</span>}
      {!issues && (counts.inactive || 0) > 0 && <span className="seg"><span className="dot" style={{ background: "var(--st-inactive)" }} /><b>{counts.inactive}</b> idle</span>}
    </div>
  );

  const vpnSummary = (
    <button className={"vpn-pill " + (preflight?.status || "checking")}
      onClick={() => settings.jumpHost ? refreshPreflight(settings.jumpHost) : setView("settings")}
      title={preflight ? `${preflight.jumpHost}: ${preflight.sshPort.detail}` : "Checking corporate VPN"}>
      <span className="dot" />
      <span>{preflight ? preflight.message : "Checking VPN"}</span>
    </button>
  );

  const FILTERS = [
    { k: "all", label: "All", n: counts.all },
    { k: "active", label: "Active", n: counts.active || 0 },
    { k: "issues", label: "Issues", n: issues },
    { k: "inactive", label: "Idle", n: counts.inactive || 0 },
  ] as const;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="6" rx="8" ry="3.2" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" opacity="0.55" /><path d="M12 9.2v8.6" />
            </svg>
          </div>
          <div className="name"><b>Bastion</b> <span>Deck</span></div>
        </div>
        <nav className="nav">
          <button className={"nav-link" + (view === "dashboard" ? " active" : "")} onClick={() => setView("dashboard")}>Dashboard</button>
          <button className={"nav-link" + (view === "settings" ? " active" : "")} onClick={() => setView("settings")}>Settings</button>
        </nav>
        <div className="spacer" />
        {vpnSummary}
        {view === "dashboard" && healthSummary}
        {view === "dashboard" && (
          <div className="search">
            <Icons.Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tunnels…" />
            <span className="kbd">/</span>
          </div>
        )}
        <button className="icon-btn" title="Toggle theme" onClick={() => setTheme((th) => th === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Icons.Sun size={17} /> : <Icons.Moon size={17} />}
        </button>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowNew(true); }}><Icons.Plus size={16} /> New tunnel</button>
      </header>

      <main className="main">
        {view === "settings" ? (
          <SettingsPage settings={settings} onChange={saveSettings} />
        ) : tunnels.length === 0 ? (
          <div className="page"><EmptyState onCreate={() => { setEditing(null); setShowNew(true); }} /></div>
        ) : (
          <div className="page">
            <div className="page-head">
              <div>
                <h1>Tunnels</h1>
                <p className="sub">{counts.active || 0} of {counts.all} forwards active{issues ? ` · ${issues} need attention` : ""}.</p>
              </div>
              <div className="toolbar">
                <div className="filter-tabs">
                  {FILTERS.map((f) => (
                    <button key={f.k} className={"filter-tab" + (filter === f.k ? " active" : "")} onClick={() => setFilter(f.k)}>
                      {f.label} <span className="count">{f.n}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-3)", fontSize: "14px" }}>
                No tunnels match{query ? ` “${query}”` : " this filter"}.
              </div>
            ) : (
              <div className={"tunnels " + t.layout}>
                {filtered.map((tn) => (
                  <TunnelCard key={tn.id} t={tn} onToggle={toggle} onOpen={(x) => setOpenId(x.id)} onAction={action} toast={showToast} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {showNew && (
        <NewTunnelModal settings={settings} editing={editing}
          onClose={() => { setShowNew(false); setEditing(null); }} onSubmit={submit} toast={showToast} />
      )}
      {openTunnel && (
        <DetailDrawer t={openTunnel} settings={settings} logs={logs}
          onClose={() => setOpenId(null)} onToggle={toggle} onAction={action} toast={showToast} />
      )}

      {toast && <div className="toast"><Icons.Check size={15} style={{ color: "var(--st-active)" }} /> {toast}</div>}

      <TweaksPanel>
        <TweakSection label="Brand" />
        <TweakColor label="Accent" value={t.accent}
          options={["#7c5cff", "#4f78ff", "#c05cff", "#16b39a", "#f5803e"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSelect label="Type" value={t.font} options={["Geist", "Inter", "IBM Plex"] as const} onChange={(v) => setTweak("font", v as TweakValues["font"])} />
        <TweakSection label="Layout" />
        <TweakRadio label="Cards" value={t.layout} options={["grid", "list"] as const} onChange={(v) => setTweak("layout", v)} />
        <TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"] as const} onChange={(v) => setTweak("density", v)} />
        <TweakSlider label="Corner radius" value={t.radius} min={4} max={20} step={1} unit="px" onChange={(v) => setTweak("radius", v)} />
      </TweaksPanel>
    </div>
  );
}
