import { useEffect, useRef, useState } from "react";
import { Icons } from "../icons.js";
import { CopyBtn } from "../components/Card.js";
import { parseAddress, sourceAddr, sshCommand } from "../lib/tm.js";
import { api } from "../api.js";
import type { Settings, Tunnel, TunnelSpec } from "../types.js";

function CmdLine({ t, settings }: {
  t: { localPort: number; host: string; port: number };
  settings: { sshLogin: string; jumpHost: string };
}) {
  const login = settings.sshLogin || "<login>";
  const jumpHost = settings.jumpHost || "<jump-host>";
  return (
    <code>
      ssh <span className="flag">-N</span> <span className="flag">-L</span>{" "}
      <span className="arg">{t.localPort}</span>:<span className="host">{t.host}</span>:<span className="arg">{t.port}</span>{" "}
      {login}@<span className="host">{jumpHost}</span>
    </code>
  );
}

export function NewTunnelModal({ settings, editing, onClose, onSubmit, toast }: {
  settings: Settings;
  editing?: Tunnel | null;
  onClose: () => void;
  onSubmit: (spec: TunnelSpec, editingId?: string) => void;
  toast: (m: string) => void;
}) {
  const [raw, setRaw] = useState(editing ? sourceAddr(editing) : "");
  const [name, setName] = useState(editing?.name ?? "");
  const [localPort, setLocalPort] = useState(editing ? String(editing.localPort) : "");
  const [suggested, setSuggested] = useState<number | null>(editing ? editing.localPort : null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  // Suggest a free local port for new tunnels.
  useEffect(() => {
    if (editing) return;
    let cancelled = false;
    api.suggestPort().then((r) => { if (!cancelled) setSuggested(r.port); }).catch(() => {});
    return () => { cancelled = true; };
  }, [editing]);

  const p = parseAddress(raw);
  const autoPort = suggested ?? (p.ok ? p.port! : settings.portFrom);
  const effPort = localPort ? parseInt(localPort, 10) : autoPort;
  const previewTunnel = p.ok ? { host: p.host!, port: p.port!, protocol: p.protocol!, path: p.path, localPort: effPort } : null;
  const needsSsh = !settings.jumpHost.trim() || !settings.sshLogin.trim();

  function submit() {
    if (!p.ok || needsSsh) return;
    const spec: TunnelSpec = {
      name: name.trim() || undefined,
      type: p.type,
      protocol: p.protocol,
      host: p.host!,
      port: p.port!,
      path: p.path,
      localPort: effPort,
      autoRestart: editing?.autoRestart ?? false,
    };
    onSubmit(spec, editing?.id);
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog">
        <div className="modal-head">
          <h2>{editing ? "Edit tunnel" : "New tunnel"}</h2>
          <p>Paste an internal address. We'll forward it through your jump host to localhost.</p>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Internal address</label>
            <input ref={inputRef} className="input lg" value={raw} onChange={(e) => setRaw(e.target.value)}
              placeholder="https://internal-app.example.com" />
            <span className="help">Accepts <span className="mono">host</span>, <span className="mono">host:port</span>, a full URL, or <span className="mono">host:port/path</span>.</span>
          </div>

          <div className={"parsed-card" + (p.ok ? " ok" : "")}>
            <div className="pc-head">
              {p.ok ? <Icons.Check size={14} style={{ color: "var(--accent)" }} /> : <Icons.Server size={14} />}
              {p.ok ? "Detected" : "Waiting for a valid address…"}
            </div>
            <div className="parsed">
              <div className={"chip" + (p.ok ? "" : " empty")}>
                <span className="ck">Host</span><span className="cv">{p.ok ? p.host : "—"}</span>
              </div>
              <div className={"chip" + (p.ok ? "" : " empty")}>
                <span className="ck">Port</span><span className="cv">{p.ok ? p.port : "—"}</span>
              </div>
              <div className={"chip" + (p.ok ? "" : " empty")}>
                <span className="ck">Protocol</span><span className="cv">{p.ok ? p.protocol : "—"}</span>
              </div>
              <div className={"chip" + (p.ok ? " accent" : " empty")}>
                <span className="ck">Type</span><span className="cv">{p.ok ? p.type : "—"}</span>
              </div>
              {p.ok && p.path && (
                <div className="chip"><span className="ck">Path</span><span className="cv">{p.path}</span></div>
              )}
            </div>
            {p.ok && (
              <div className="addr-row" style={{ marginTop: "2px" }}>
                <span className="lbl">Local</span>
                <span className="val mono" style={{ color: "var(--accent)" }}>{p.protocol}://localhost:{effPort}{p.path || ""}</span>
              </div>
            )}
          </div>

          <div className="input-row">
            <div className="field">
              <label>Name <span className="help">optional</span></label>
              <input className="input sans" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={p.ok ? p.host!.split(".")[0] : "Internal API"} />
            </div>
            <div className="field" style={{ maxWidth: "150px" }}>
              <label>Local port</label>
              <input className="input" value={localPort} onChange={(e) => setLocalPort(e.target.value.replace(/\D/g, ""))}
                placeholder={"Auto · " + autoPort} />
            </div>
          </div>

          <div className={"setup-callout" + (needsSsh ? " warn" : "")}>
            <Icons.Key size={14} />
            <span>
              {needsSsh
                ? "Configure one jump host and SSH login in Settings before creating tunnels."
                : `Forwarding through ${settings.jumpHost}. SSH login and key handling are managed in Settings.`}
            </span>
          </div>

          <div className="field">
            <label>Command preview</label>
            <div className="cmd">
              {previewTunnel
                ? <CmdLine t={previewTunnel} settings={settings} />
                : <code style={{ color: "var(--text-3)" }}>ssh -N -L &lt;localPort&gt;:&lt;host&gt;:&lt;port&gt; {settings.sshLogin || "<login>"}@{settings.jumpHost || "<jump-host>"}</code>}
              {previewTunnel && !needsSsh && (
                <span className="cmd-copy"><CopyBtn text={sshCommand(previewTunnel, settings)} toast={toast} /></span>
              )}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <span className="hint"><Icons.Lock size={13} /> {needsSsh ? "Configure SSH settings first" : "Forwarded over SSH · key auth"}</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-subtle" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!p.ok || needsSsh} onClick={submit}
              style={!p.ok || needsSsh ? { opacity: 0.45, cursor: "not-allowed" } : {}}>
              <Icons.Bolt size={15} /> {editing ? "Save changes" : "Create tunnel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
