import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// Cosmetic "Tweaks" panel ported from the design prototype (accent / font /
// layout / density / radius). Values persist to localStorage. In the standalone
// app the panel opens with the `t` keyboard shortcut.

export type TweakValues = {
  accent: string;
  density: "compact" | "regular" | "comfy";
  layout: "grid" | "list";
  radius: number;
  font: "Geist" | "Inter" | "IBM Plex";
};

const STORE_KEY = "tm-tweaks";

const TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    background:rgba(20,22,28,.86);color:#e7e9ec;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:1px solid rgba(255,255,255,.12);border-radius:14px;
    box-shadow:0 12px 40px rgba(0,0,0,.5);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(231,233,236,.55);
    width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(255,255,255,.08);color:#fff}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;color:rgba(231,233,236,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(231,233,236,.5);font-variant-numeric:tabular-nums}
  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(231,233,236,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}
  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:1px solid rgba(255,255,255,.12);border-radius:7px;
    background:rgba(255,255,255,.05);color:inherit;font:inherit;outline:none}
  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(255,255,255,.16);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:pointer}
  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;background:rgba(255,255,255,.08);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;background:rgba(255,255,255,.16);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;background:transparent;
    color:inherit;font:inherit;font-weight:500;min-height:22px;border-radius:6px;cursor:pointer;padding:4px 6px}
  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:30px;padding:0;border:0;border-radius:6px;
    cursor:pointer;box-shadow:0 0 0 1px rgba(255,255,255,.14)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 2px #fff}
`;

export function useTweaks(defaults: TweakValues): [TweakValues, <K extends keyof TweakValues>(k: K, v: TweakValues[K]) => void] {
  const [values, setValues] = useState<TweakValues>(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<TweakValues>) };
    } catch {
      /* ignore */
    }
    return defaults;
  });
  const setTweak = useCallback(<K extends keyof TweakValues>(k: K, v: TweakValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [k]: v };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return [values, setTweak];
}

export function TweaksPanel({ title = "Tweaks", children }: { title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "t" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!open) return null;
  return (
    <>
      <style>{TWEAKS_STYLE}</style>
      <div ref={ref} className="twk-panel">
        <div className="twk-hd">
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="twk-body">{children}</div>
      </div>
    </>
  );
}

export function TweakSection({ label }: { label: string }) {
  return <div className="twk-sect">{label}</div>;
}

function TweakRow({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="twk-row">
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = "", onChange }: {
  label: string; value: number; min?: number; max?: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
        value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

export function TweakRadio<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly T[]; onChange: (v: T) => void;
}) {
  const idx = Math.max(0, options.indexOf(value));
  const n = options.length;
  return (
    <TweakRow label={label}>
      <div className="twk-seg" role="radiogroup">
        <div className="twk-seg-thumb" style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`, width: `calc((100% - 4px) / ${n})` }} />
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === value} onClick={() => onChange(o)}>{o}</button>
        ))}
      </div>
    </TweakRow>
  );
}

export function TweakSelect<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly T[]; onChange: (v: T) => void;
}) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </TweakRow>
  );
}

export function TweakColor({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((c) => (
          <button key={c} type="button" className="twk-chip" role="radio" aria-checked={c === value}
            data-on={c === value ? "1" : "0"} style={{ background: c }} aria-label={c} onClick={() => onChange(c)} />
        ))}
      </div>
    </TweakRow>
  );
}
