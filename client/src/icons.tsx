import type { SVGProps, ReactNode } from "react";

// Minimal stroke icon set (ported from the design prototype's icons.jsx).

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "stroke"> {
  size?: number;
  stroke?: number;
  fill?: string;
  d?: string;
  children?: ReactNode;
}

const S = ({ d, size = 16, fill, stroke = 1.6, children, ...p }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill || "none"}
    stroke={fill ? "none" : "currentColor"}
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

type P = Omit<IconProps, "d" | "children">;

export const Icons = {
  Plus: (p: P) => <S {...p} d="M12 5v14M5 12h14" />,
  Search: (p: P) => <S {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></S>,
  Copy: (p: P) => <S {...p}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" /></S>,
  Check: (p: P) => <S {...p} d="M4 12.5l5 5L20 6.5" />,
  Kebab: (p: P) => <S {...p}><circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" /></S>,
  Restart: (p: P) => <S {...p}><path d="M3 12a9 9 0 1 0 2.6-6.3" /><path d="M3 4v4h4" /></S>,
  Edit: (p: P) => <S {...p} d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17.2V20zM14 7l3 3" />,
  Logs: (p: P) => <S {...p}><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M7 9h7M7 13h10M7 17h5" /></S>,
  Trash: (p: P) => <S {...p} d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />,
  Close: (p: P) => <S {...p} d="M6 6l12 12M18 6L6 18" />,
  ChevR: (p: P) => <S {...p} d="M9 6l6 6-6 6" />,
  ChevD: (p: P) => <S {...p} d="M6 9l6 6 6-6" />,
  Arrow: (p: P) => <S {...p} d="M5 12h14M13 6l6 6-6 6" />,
  Power: (p: P) => <S {...p}><path d="M12 4v8" /><path d="M7.5 7a7 7 0 1 0 9 0" /></S>,
  Sun: (p: P) => <S {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></S>,
  Moon: (p: P) => <S {...p} d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" />,
  Stop: (p: P) => <S {...p}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" /></S>,
  Play: (p: P) => <S {...p}><path d="M7 5l12 7-12 7V5z" fill="currentColor" stroke="none" /></S>,
  Bolt: (p: P) => <S {...p} d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  Server: (p: P) => <S {...p}><rect x="3.5" y="4" width="17" height="7" rx="2" /><rect x="3.5" y="13" width="17" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></S>,
  Link: (p: P) => <S {...p}><path d="M9 15l6-6" /><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1" /><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1" /></S>,
  Lock: (p: P) => <S {...p}><rect x="4.5" y="10" width="15" height="10" rx="2.2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></S>,
  Clock: (p: P) => <S {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></S>,
  Alert: (p: P) => <S {...p}><path d="M12 3l9 16H3l9-16z" /><path d="M12 10v4M12 17h.01" /></S>,
  Key: (p: P) => <S {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M16 4l3 3M14 6l2 2" /></S>,
};

export type IconComponent = (p: P) => ReactNode;
