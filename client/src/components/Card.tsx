import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icons, type IconComponent } from "../icons.js";
import { localUrl, relTime, sourceAddr, STATUS_LABEL } from "../lib/tm.js";
import type { Status, Tunnel } from "../types.js";

export type ActionKind = "restart" | "edit" | "delete";

const STATUS_COLOR: Record<Status, string> = {
  active: "var(--st-active)",
  connecting: "var(--st-connecting)",
  inactive: "var(--text-3)",
  error: "var(--st-error)",
};

// ---- Sparkline ----
export function Sparkline({ data, color, w = 84, h = 26, muted }: {
  data: number[]; color: string; w?: number; h?: number; muted?: boolean;
}) {
  if (!data || data.length < 2) return <svg width={w} height={h} className="spark" />;
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - 3 - ((v - min) / rng) * (h - 6)] as const);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + ` L${w} ${h} L0 ${h} Z`;
  const id = "sg" + Math.round(min + max + data.length);
  const c = muted ? "var(--text-3)" : color;
  return (
    <svg width={w} height={h} className="spark" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity={muted ? 0.12 : 0.28} />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={c} />
    </svg>
  );
}

// ---- Status dot ----
export const StatusDot = ({ status }: { status: Status }) => (
  <span className={"status " + status}><span className="core" /></span>
);

// ---- Toggle switch ----
function Switch({ on, busy, onChange }: { on: boolean; busy?: boolean; onChange: () => void }) {
  return (
    <label className={"switch" + (on ? " on" : "") + (busy ? " busy" : "")}
      onClick={(e) => { e.stopPropagation(); onChange(); }}>
      <span className="track" /><span className="thumb" />
    </label>
  );
}

// ---- Kebab menu ----
interface KebabItem {
  icon?: IconComponent;
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  sep?: boolean;
}
function Kebab({ items }: { items: KebabItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        <Icons.Kebab size={16} />
      </button>
      {open && (
        <div className="menu" onClick={(e) => e.stopPropagation()} style={menuStyle}>
          {items.map((it, i) => it.sep ? <div key={i} style={menuSep} /> : (
            <button key={i} className="menu-item" style={{ ...menuItem, ...(it.danger ? { color: "var(--st-error)" } : {}) }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => { setOpen(false); it.onClick && it.onClick(); }}>
              {it.icon && <it.icon size={15} />} {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
const menuStyle: CSSProperties = { position: "absolute", top: "36px", right: 0, zIndex: 40, minWidth: "168px",
  background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "11px",
  padding: "5px", boxShadow: "var(--shadow-pop)", animation: "pop .14s ease" };
const menuItem: CSSProperties = { display: "flex", alignItems: "center", gap: "10px", width: "100%", textAlign: "left",
  padding: "8px 10px", fontSize: "13px", color: "var(--text)", background: "transparent",
  border: "none", borderRadius: "7px", cursor: "pointer", fontFamily: "inherit" };
const menuSep: CSSProperties = { height: "1px", background: "var(--border)", margin: "5px 6px" };

// ---- Copy button ----
export function CopyBtn({ text, toast }: { text: string; toast?: (m: string) => void }) {
  const [done, setDone] = useState(false);
  return (
    <button className={"copy-btn" + (done ? " copied" : "")} title="Copy"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {});
        setDone(true); toast && toast("Copied to clipboard");
        setTimeout(() => setDone(false), 1300);
      }}>
      {done ? <Icons.Check size={14} /> : <Icons.Copy size={14} />}
    </button>
  );
}

// ---- Tunnel card ----
export function TunnelCard({ t, onToggle, onOpen, onAction, toast }: {
  t: Tunnel;
  onToggle: (t: Tunnel) => void;
  onOpen: (t: Tunnel) => void;
  onAction: (kind: ActionKind, t: Tunnel) => void;
  toast: (m: string) => void;
}) {
  const st = t.status;
  const statusColor = STATUS_COLOR[st];
  const on = st === "active" || st === "connecting";
  return (
    <div className={"card is-" + st} onClick={() => onOpen(t)}>
      <div className="card-top">
        <div className="card-id">
          <StatusDot status={st} />
          <div className="card-name-wrap">
            <div className="card-name">
              <span className="nm">{t.name}</span>
              <span className={"badge " + t.type.toLowerCase()}>{t.type}</span>
            </div>
            <div className={"card-status-label " + st}>
              {STATUS_LABEL[st]}{st === "active" && t.uptime && t.uptime !== "—" ? ` · up ${t.uptime}` : ""}
            </div>
          </div>
        </div>
        <div className="card-actions">
          <Switch on={on} busy={st === "connecting"} onChange={() => onToggle(t)} />
          <Kebab items={[
            { icon: Icons.Restart, label: "Restart", onClick: () => onAction("restart", t) },
            { icon: Icons.Edit, label: "Edit", onClick: () => onAction("edit", t) },
            { icon: Icons.Logs, label: "View logs", onClick: () => onOpen(t) },
            { sep: true },
            { icon: Icons.Trash, label: "Delete", danger: true, onClick: () => onAction("delete", t) },
          ]} />
        </div>
      </div>

      <div className="addr-block">
        <div className="addr-row">
          <span className="lbl">Source</span>
          <span className="val dim mono">{sourceAddr(t)}</span>
        </div>
        <div className="addr-row">
          <span className="lbl">Local</span>
          <span className="val mono" style={on ? {} : { color: "var(--text-3)" }}>{localUrl(t)}</span>
          <CopyBtn text={localUrl(t)} toast={toast} />
        </div>
      </div>

      {st === "error" && (
        <div className="err-line">
          <Icons.Alert size={15} style={{ flex: "0 0 auto" }} />
          <span>{t.error}</span>
        </div>
      )}

      <div className="card-foot">
        <div className="health-stats">
          <div className="health-stat">
            <span className="k">Latency</span>
            <span className={"v" + (t.latency == null ? " muted" : "")}>
              {t.latency != null ? `${t.latency} ms` : "—"}
            </span>
          </div>
          <div className="health-stat">
            <span className="k">Checked</span>
            <span className="v muted">{st === "connecting" ? "now" : relTime(t.lastCheck)}</span>
          </div>
        </div>
        <Sparkline data={t.series} color={statusColor} muted={!on} />
      </div>
    </div>
  );
}

export { Switch };
export { STATUS_COLOR };
