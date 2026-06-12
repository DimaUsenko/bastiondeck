import { useEffect, useRef } from "react";
import { Icons } from "../icons.js";
import { CopyBtn, StatusDot, type ActionKind } from "../components/Card.js";
import { localUrl, relTime, sourceAddr, sshCommand, STATUS_LABEL } from "../lib/tm.js";
import type { LogLine, Settings, Status, Tunnel } from "../types.js";

const STATUS_COLOR: Record<Status, string> = {
  active: "var(--st-active)",
  connecting: "var(--st-connecting)",
  inactive: "var(--text-3)",
  error: "var(--st-error)",
};

function CmdLine({ t, settings }: { t: Tunnel; settings: Settings }) {
  return (
    <code>
      ssh <span className="flag">-N</span> <span className="flag">-L</span>{" "}
      <span className="arg">{t.localPort}</span>:<span className="host">{t.host}</span>:<span className="arg">{t.port}</span>{" "}
      {settings.sshLogin}@<span className="host">{t.jumpHost || settings.jumpHost}</span>
    </code>
  );
}

export function DetailDrawer({ t, settings, logs, onClose, onToggle, onAction, toast }: {
  t: Tunnel;
  settings: Settings;
  logs: LogLine[];
  onClose: () => void;
  onToggle: (t: Tunnel) => void;
  onAction: (kind: ActionKind, t: Tunnel) => void;
  toast: (m: string) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [logs]);

  const st = t.status;
  const on = st === "active" || st === "connecting";
  const statusColor = STATUS_COLOR[st];

  const data = t.series.length >= 2 ? t.series : [t.latency ?? 0, t.latency ?? 0];
  const min = Math.min(...data), max = Math.max(...data);
  const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length);

  const W = 472, H = 96;
  const rng = (max - min) || 1, step = W / (data.length - 1);
  const pts = data.map((v, i) => [i * step, H - 8 - ((v - min) / rng) * (H - 20)] as const);
  const dPath = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog">
        <div className="drawer-head">
          <div className="dh-top">
            <div style={{ minWidth: 0 }}>
              <h2><StatusDot status={st} /> {t.name}
                <span className={"badge " + t.type.toLowerCase()}>{t.type}</span>
              </h2>
              <div className={"card-status-label " + st} style={{ marginTop: "6px" }}>
                {STATUS_LABEL[st]}{st === "active" && t.uptime && t.uptime !== "—" ? ` · up ${t.uptime}` : ""}
                {st === "error" && t.error ? ` · ${t.error}` : ""}
              </div>
            </div>
            <button className="icon-btn" onClick={onClose}><Icons.Close size={17} /></button>
          </div>
          <div className="drawer-map">
            <span className="map-pill"><span className="pk">Source</span>{sourceAddr(t)}</span>
            <Icons.Arrow size={16} style={{ color: "var(--text-3)" }} />
            <span className="map-pill"><span className="pk">Local</span>{localUrl(t)}</span>
            <CopyBtn text={localUrl(t)} toast={toast} />
          </div>
        </div>

        <div className="drawer-body" ref={bodyRef}>
          <div>
            <div className="section-title">Live logs <span className="mono" style={{ color: "var(--text-3)", fontWeight: 400 }}>tail -f</span></div>
            <div className="terminal">
              <div className="term-head">
                <span className="tl" style={{ background: "#ff5f57" }} />
                <span className="tl" style={{ background: "#febc2e" }} />
                <span className="tl" style={{ background: "#28c840" }} />
                <span className="t-title">{settings.sshLogin}@{t.jumpHost || settings.jumpHost} — ssh</span>
              </div>
              <div className="term-body">
                {logs.map((l, i) => (
                  <div key={i} className={"log-line " + l.level}>
                    <span className="ts">{l.ts}</span>
                    <span className="lv">{l.level.toUpperCase()}</span>
                    <span className="msg">{l.msg}</span>
                  </div>
                ))}
                {on && <div className="log-line"><span className="ts"> </span><span className="cursor-blink" /></div>}
              </div>
            </div>
          </div>

          <div>
            <div className="section-title">Latency history</div>
            <div className="chart-wrap">
              <div className="chart-legend">
                <span>last {data.length} checks · every {settings.interval}s</span>
                <span>min <b>{min}ms</b> · avg <b>{avg}ms</b> · max <b>{max}ms</b></span>
              </div>
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="dchart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={statusColor} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={statusColor} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map((g, i) => (
                  <line key={i} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--border)" strokeWidth="1" />
                ))}
                <path d={dPath + ` L${W} ${H} L0 ${H} Z`} fill="url(#dchart)" />
                <path d={dPath} fill="none" stroke={statusColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={statusColor} />
              </svg>
            </div>
          </div>

          <div>
            <div className="section-title">Connection</div>
            <div className="detail-list">
              <div className="detail-item"><span className="dk">Status</span><span className="dv" style={{ color: statusColor }}>{STATUS_LABEL[st]}</span></div>
              <div className="detail-item"><span className="dk">Jump host</span><span className="dv">{t.jumpHost || settings.jumpHost}</span></div>
              <div className="detail-item"><span className="dk">SSH login</span><span className="dv">{settings.sshLogin}</span></div>
              <div className="detail-item"><span className="dk">Local port</span><span className="dv">{t.localPort}</span></div>
              <div className="detail-item"><span className="dk">Auto-restart</span><span className="dv">{t.autoRestart ? "On" : "Off"}</span></div>
              <div className="detail-item"><span className="dk">Latency</span><span className="dv">{t.latency != null ? t.latency + " ms" : "—"}</span></div>
              <div className="detail-item"><span className="dk">Last check</span><span className="dv">{st === "connecting" ? "now" : relTime(t.lastCheck)}</span></div>
            </div>
          </div>

          <div>
            <div className="section-title">SSH command</div>
            <div className="cmd">
              <CmdLine t={t} settings={settings} />
              <span className="cmd-copy"><CopyBtn text={sshCommand(t, settings)} toast={toast} /></span>
            </div>
          </div>
        </div>

        <div className="drawer-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => onToggle(t)}>
            {on ? <><Icons.Stop size={14} /> Stop</> : <><Icons.Play size={14} /> Start</>}
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => onAction("restart", t)}><Icons.Restart size={15} /> Restart</button>
          <button className="btn btn-danger btn-icon" onClick={() => onAction("delete", t)}><Icons.Trash size={16} /></button>
        </div>
      </div>
    </>
  );
}
