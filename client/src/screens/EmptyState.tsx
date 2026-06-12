import { Icons } from "../icons.js";

export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty fade-up">
      <div className="art">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="52" stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="4 6" />
          <rect x="14" y="50" width="20" height="20" rx="5" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="1.5" />
          <rect x="86" y="50" width="20" height="20" rx="5" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="1.5" />
          <path d="M36 60h48" stroke="var(--accent)" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round">
            <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="0.9s" repeatCount="indefinite" />
          </path>
          <circle cx="60" cy="60" r="9" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
          <circle cx="60" cy="60" r="3" fill="var(--accent)" />
        </svg>
      </div>
      <h2>No tunnels yet</h2>
      <p>Create a secure port-forward to reach an internal API or MCP server from your machine.</p>
      <button className="btn btn-primary" onClick={onCreate}><Icons.Plus size={16} /> Create your first tunnel</button>
    </div>
  );
}
