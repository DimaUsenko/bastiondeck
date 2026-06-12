import { useEffect, useState } from "react";
import { Icons } from "../icons.js";
import type { Settings } from "../types.js";

export function SettingsPage({ settings, onChange }: {
  settings: Settings;
  onChange: (next: Settings) => Promise<Settings>;
}) {
  // Local draft so settings are saved only after explicit user approval.
  const [draft, setDraft] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "idle" | "ok" | "error"; text: string }>({
    kind: "idle",
    text: "Review the connection details, then save to apply them.",
  });

  useEffect(() => {
    setDraft(settings);
    setMessage({ kind: "idle", text: "Review the connection details, then save to apply them." });
  }, [settings]);

  const set = (k: keyof Settings, v: string | number) => {
    setDraft({ ...draft, [k]: v });
    setMessage({ kind: "idle", text: "Unsaved changes. Save when the values look correct." });
  };

  const normalized = (): Settings => {
    const jumpHost = draft.jumpHost.trim();
    const portFrom = Number(draft.portFrom);
    const portTo = Number(draft.portTo);
    const interval = Number(draft.interval);
    return {
      ...draft,
      jumpHost,
      jumpHosts: jumpHost ? [jumpHost] : [],
      sshLogin: draft.sshLogin.trim(),
      keyPath: draft.keyPath.trim(),
      portFrom,
      portTo,
      interval,
    };
  };

  const isValidHost = (host: string) => /^[A-Za-z0-9]([A-Za-z0-9.-]{0,253}[A-Za-z0-9])?$/.test(host) && !host.includes("..");
  const isValidLogin = (login: string) => /^[A-Za-z0-9._-]{1,64}$/.test(login);
  const isValidPort = (port: number) => Number.isInteger(port) && port >= 1 && port <= 65535;
  const isValidKeyPath = (path: string) => path === "" || (path.length <= 1024 && !/[\n\r\0]/.test(path));

  const validate = (next: Settings): string | null => {
    if (!next.jumpHost) return "Enter a jump host.";
    if (!isValidHost(next.jumpHost)) return "Jump host must be a valid hostname.";
    if (!next.sshLogin) return "Enter an SSH login in Settings.";
    if (!isValidLogin(next.sshLogin)) return "SSH login can contain letters, numbers, dots, underscores, and dashes.";
    if (!isValidKeyPath(next.keyPath)) return "Key path cannot contain line breaks.";
    if (!isValidPort(next.portFrom) || !isValidPort(next.portTo) || next.portFrom > next.portTo) {
      return "Auto-port range must be valid and ordered.";
    }
    if (![5, 10, 30, 60].includes(next.interval)) return "Choose a supported health-check interval.";
    return null;
  };

  const save = async () => {
    const next = normalized();
    const error = validate(next);
    if (error) {
      setMessage({ kind: "error", text: error });
      return;
    }
    setSaving(true);
    setMessage({ kind: "idle", text: "Saving settings..." });
    try {
      const saved = await onChange(next);
      setDraft(saved);
      setMessage({ kind: "ok", text: "Settings saved. VPN and SSH reachability will refresh automatically." });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message || "Failed to save settings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page settings fade-up">
      <div className="page-head"><div><h1>Settings</h1><p className="sub">Global defaults applied to every new tunnel.</p></div></div>

      <div className="set-group-title">Jump host</div>
      <div className="set-card">
        <div className="set-row">
          <div className="si"><div className="st">Jump host</div><div className="sd">Bastion server used for every tunnel.</div></div>
          <div className="sc">
            <input className="input sans" value={draft.jumpHost} onChange={(e) => set("jumpHost", e.target.value)}
              placeholder="bastion.example.com" />
          </div>
        </div>
        <div className="set-row">
          <div className="si"><div className="st">SSH login</div><div className="sd">Username used to authenticate to the jump host.</div></div>
          <div className="sc"><input className="input" value={draft.sshLogin} onChange={(e) => set("sshLogin", e.target.value)} placeholder="jdoe" /></div>
        </div>
        <div className="set-row">
          <div className="si"><div className="st">Key path</div><div className="sd">Private key for authentication. Leave blank to use ssh-agent / ssh_config.</div></div>
          <div className="sc"><input className="input" value={draft.keyPath} onChange={(e) => set("keyPath", e.target.value)} placeholder="~/.ssh/id_ed25519" /></div>
        </div>
        <div className="set-note">
          <Icons.Key size={15} />
          <span>SSH public-key access must already work for this host. Password prompts are disabled.</span>
        </div>
      </div>

      <div className="set-group-title">Tunnels</div>
      <div className="set-card">
        <div className="set-row">
          <div className="si"><div className="st">Auto-port range</div><div className="sd">Range used when a local port is set to "Auto".</div></div>
          <div className="sc" style={{ display: "flex", gap: "8px", width: "200px" }}>
            <input className="input" value={draft.portFrom} onChange={(e) => set("portFrom", Number(e.target.value.replace(/\D/g, "")) || 0)} />
            <input className="input" value={draft.portTo} onChange={(e) => set("portTo", Number(e.target.value.replace(/\D/g, "")) || 0)} />
          </div>
        </div>
        <div className="set-row">
          <div className="si"><div className="st">Health-check interval</div><div className="sd">How often each active tunnel's latency is probed.</div></div>
          <div className="sc" style={{ width: "140px" }}>
            <select className="input sans" value={draft.interval}
              onChange={(e) => set("interval", parseInt(e.target.value, 10))}
              style={{ appearance: "none", cursor: "pointer" }}>
              {[5, 10, 30, 60].map((n) => <option key={n} value={n}>{n} seconds</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className={"set-save set-status " + message.kind}>
        <div className="set-save-copy">
          {message.kind === "error" ? <Icons.Alert size={15} /> : message.kind === "ok" ? <Icons.Check size={15} /> : <Icons.Key size={15} />}
          <span>{message.text}</span>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}
          style={saving ? { opacity: 0.65, cursor: "wait" } : {}}>
          <Icons.Check size={15} /> {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}
