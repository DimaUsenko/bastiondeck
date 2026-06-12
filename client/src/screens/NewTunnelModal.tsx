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
  return (
    <code>
      ssh <span className="flag">-N</span> <span className="flag">-L</span>{" "}
      <span className="arg">{t.localPort}</span>:<span className="host">{t.host}</span>:<span className="arg">{t.port}</span>{" "}
      {settings.sshLogin}@<span className="host">{settings.jumpHost}</span>
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
  const [adv, setAdv] = useState(!settings.sshLogin);
  const [jump, setJump] = useState(editing?.jumpHost ?? settings.jumpHost);
  const [login, setLogin] = useState(editing?.sshLogin ?? settings.sshLogin);
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
  const previewTunnel = p.ok ? { host: p.host!, port: p.port!, path: p.path, localPort: effPort } : null;
  const effSettings = { ...settings, jumpHost: jump, sshLogin: login };
  const jumpOptions = Array.from(new Set([jump, settings.jumpHost, ...settings.jumpHosts].filter(Boolean)));
  const needsSsh = !jump.trim() || !login.trim();

  function submit() {
    if (!p.ok || needsSsh) return;
    const spec: TunnelSpec = {
      name: name.trim() || undefined,
      type: p.type,
      host: p.host!,
      port: p.port!,
      path: p.path,
      localPort: effPort,
      autoRestart: editing?.autoRestart ?? false,
      jumpHost: jump !== settings.jumpHost ? jump : undefined,
      sshLogin: login !== settings.sshLogin ? login : undefined,
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
              placeholder="http://internal-api.example.com:8040/mcp" />
            <span className="help">Accepts <span className="mono">host:port</span>, a full URL, or <span className="mono">host:port/path</span>.</span>
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
                <span className="val mono" style={{ color: "var(--accent)" }}>http://localhost:{effPort}{p.path || ""}</span>
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

          <button className={"adv-toggle" + (adv ? " open" : "")} onClick={() => setAdv((a) => !a)}>
            <Icons.ChevR size={14} className="chev" /> Advanced — jump host &amp; login
          </button>
          {adv && (
            <div className="adv-body">
              <div className="input-row">
                <div className="field">
                  <label>Jump host</label>
                  <select className="input sans" value={jump} onChange={(e) => setJump(e.target.value)}>
                    {!jumpOptions.length && <option value="">Configure in Settings</option>}
                    {jumpOptions.map((host) => <option key={host} value={host}>{host}</option>)}
                  </select>
                </div>
                <div className="field" style={{ maxWidth: "180px" }}>
                  <label>SSH login</label>
                  <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="jdoe" />
                </div>
              </div>
              <div className={"setup-callout" + (needsSsh ? " warn" : "")}>
                <Icons.Key size={14} />
                <span>
                  {needsSsh
                    ? "Choose a jump host and enter your SSH login. Public-key access must already work for that host."
                    : "Public-key access must already work for this jump host. Changes here apply only to this tunnel."}
                </span>
              </div>
            </div>
          )}

          <div className="field">
            <label>Command preview</label>
            <div className="cmd">
              {previewTunnel
                ? <CmdLine t={previewTunnel} settings={effSettings} />
                : <code style={{ color: "var(--text-3)" }}>ssh -N -L &lt;localPort&gt;:&lt;host&gt;:&lt;port&gt; {login}@{jump}</code>}
              {previewTunnel && (
                <span className="cmd-copy"><CopyBtn text={sshCommand({ ...previewTunnel, jumpHost: jump, sshLogin: login }, effSettings)} toast={toast} /></span>
              )}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <span className="hint"><Icons.Lock size={13} /> {needsSsh ? "SSH login required" : "Forwarded over SSH · key auth"}</span>
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
