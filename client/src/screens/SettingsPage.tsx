import { useEffect, useState } from "react";
import { Icons } from "../icons.js";
import type { Settings } from "../types.js";

export function SettingsPage({ settings, onChange }: {
  settings: Settings;
  onChange: (next: Settings) => void;
}) {
  // Local draft so typing doesn't round-trip on every keystroke; commit on blur.
  const [draft, setDraft] = useState<Settings>(settings);
  useEffect(() => setDraft(settings), [settings]);

  const normalizeHosts = (hosts: string[], selected = draft.jumpHost) => {
    return Array.from(new Set([selected, ...hosts].map((h) => h.trim()).filter(Boolean)));
  };
  const set = (k: keyof Settings, v: string | number | string[]) => setDraft({ ...draft, [k]: v });
  const commit = (next = draft) => onChange({ ...next, jumpHosts: normalizeHosts(next.jumpHosts, next.jumpHost) });
  const setHostsText = (text: string) => {
    const hosts = text.split(/[\s,]+/).map((h) => h.trim()).filter(Boolean);
    setDraft((d) => {
      const selected = d.jumpHost || hosts[0] || "";
      const jumpHost = hosts.includes(selected) ? selected : hosts[0] || "";
      return { ...d, jumpHost, jumpHosts: normalizeHosts(hosts, jumpHost) };
    });
  };

  return (
    <div className="page settings fade-up">
      <div className="page-head"><div><h1>Settings</h1><p className="sub">Global defaults applied to every new tunnel.</p></div></div>

      <div className="set-group-title">Jump host</div>
      <div className="set-card">
        <div className="set-row">
          <div className="si"><div className="st">Selected jump host</div><div className="sd">Default bastion server used for new tunnels.</div></div>
          <div className="sc">
            <select className="input sans" value={draft.jumpHost}
              onChange={(e) => {
                const next = { ...draft, jumpHost: e.target.value, jumpHosts: normalizeHosts(draft.jumpHosts, e.target.value) };
                setDraft(next);
                commit(next);
              }}>
              {!normalizeHosts(draft.jumpHosts).length && <option value="">Add a jump host below</option>}
              {normalizeHosts(draft.jumpHosts).map((host) => <option key={host} value={host}>{host}</option>)}
            </select>
          </div>
        </div>
        <div className="set-row">
          <div className="si"><div className="st">Available jump hosts</div><div className="sd">One host per line. Users can choose one per tunnel.</div></div>
          <div className="sc">
            <textarea className="input input-area" value={draft.jumpHosts.join("\n")}
              onChange={(e) => setHostsText(e.target.value)} onBlur={() => commit()} />
          </div>
        </div>
        <div className="set-row">
          <div className="si"><div className="st">SSH login</div><div className="sd">Username used to authenticate to the jump host.</div></div>
          <div className="sc"><input className="input" value={draft.sshLogin} onChange={(e) => set("sshLogin", e.target.value)} onBlur={() => commit()} placeholder="jdoe" /></div>
        </div>
        <div className="set-row">
          <div className="si"><div className="st">Key path</div><div className="sd">Private key for authentication. Leave blank to use ssh-agent / ssh_config.</div></div>
          <div className="sc"><input className="input" value={draft.keyPath} onChange={(e) => set("keyPath", e.target.value)} onBlur={() => commit()} placeholder="~/.ssh/id_ed25519" /></div>
        </div>
        <div className="set-note">
          <Icons.Key size={15} />
          <span>SSH public-key access must already be configured for the selected jump host. Password prompts are disabled, so tunnels start only when the key works through ssh-agent, ssh_config, or the key path above.</span>
        </div>
      </div>

      <div className="set-group-title">Tunnels</div>
      <div className="set-card">
        <div className="set-row">
          <div className="si"><div className="st">Auto-port range</div><div className="sd">Range used when a local port is set to "Auto".</div></div>
          <div className="sc" style={{ display: "flex", gap: "8px", width: "200px" }}>
            <input className="input" value={draft.portFrom} onChange={(e) => set("portFrom", Number(e.target.value.replace(/\D/g, "")) || 0)} onBlur={() => commit()} />
            <input className="input" value={draft.portTo} onChange={(e) => set("portTo", Number(e.target.value.replace(/\D/g, "")) || 0)} onBlur={() => commit()} />
          </div>
        </div>
        <div className="set-row">
          <div className="si"><div className="st">Health-check interval</div><div className="sd">How often each active tunnel's latency is probed.</div></div>
          <div className="sc" style={{ width: "140px" }}>
            <select className="input sans" value={draft.interval}
              onChange={(e) => { const v = parseInt(e.target.value, 10); setDraft((d) => { const n = { ...d, interval: v }; onChange(n); return n; }); }}
              style={{ appearance: "none", cursor: "pointer" }}>
              {[5, 10, 30, 60].map((n) => <option key={n} value={n}>{n} seconds</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
