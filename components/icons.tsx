type IconProps = { className?: string };

const base = "h-5 w-5";

export function MailIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function LockIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function UserIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function EyeIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.7 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.1 6.1A17 17 0 0 0 2 13s3.5 7 10 7a9.6 9.6 0 0 0 5.9-1.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

/* ── Activity-type glyphs (replace the emoji previously used in
   activityGlyph()/empty states — emoji render differently per OS/device) ── */

export function PhoneIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6.5 3h3l1.5 4.5-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z" />
    </svg>
  );
}

export function ChatBubbleIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3.5v-14A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5z" />
    </svg>
  );
}

export function CalendarIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M8 2.5v4M16 2.5v4M3 10h18" />
    </svg>
  );
}

export function DotIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function EmptyChartIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 20h18" />
      <path d="M6 20v-7M11 20V5M16 20v-6" />
    </svg>
  );
}

export function WifiOffIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 8.5a16.5 16.5 0 0 1 4.2-2.8M8.5 5.2A16.5 16.5 0 0 1 22 8.5M5 12.5a11 11 0 0 1 3-1.8M16 10.7a11 11 0 0 1 3 1.8M8.5 15.8a6 6 0 0 1 3.3-1M12 19v.01" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function CelebrationIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 20 8 9l7 7z" />
      <path d="M14 3.5v2M19 6l-1.4 1.4M20.5 12h-2" />
    </svg>
  );
}

/* ── General-purpose UI glyphs — added to replace emoji used as icons
   across the dashboard (deals, tasks, contacts, activities, insights,
   playbook, lead-scoring). Emoji render differently per OS, which makes
   them unreliable for anything a user must recognise at a glance. ── */

export function BoltIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13 2 4.5 13.5H11L10 22l9-11.5h-6.5z" />
    </svg>
  );
}

export function BuildingIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" />
    </svg>
  );
}

export function BriefcaseIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2.5" y="7" width="19" height="13" rx="2.5" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function NoteIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3h9L20 8.5v11A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

export function ClipboardIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4.5" y="4" width="15" height="17" rx="2" />
      <path d="M9 4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v1H9zM8.5 11h7M8.5 15h5" />
    </svg>
  );
}

export function BookIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 19.5z" />
    </svg>
  );
}

export function BeakerIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.5 3v6L4.6 17.4A2 2 0 0 0 6.3 20.5h11.4a2 2 0 0 0 1.7-3.1L14.5 9V3" />
      <path d="M8 3h8M7.5 14h9" />
    </svg>
  );
}

export function BroadcastIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 15.5a5 5 0 0 0 0-7M5.8 5.8a9 9 0 0 0 0 12.4M18.2 18.2a9 9 0 0 0 0-12.4" />
    </svg>
  );
}

export function TrophyIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4.5v1a3.5 3.5 0 0 0 3 3.5M17 6h2.5v1a3.5 3.5 0 0 1-3 3.5M9.5 20h5M12 14v6" />
    </svg>
  );
}

export function MoneyIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2v20" />
      <path d="M17 6.5c0-2-2.2-3-5-3s-5 1-5 3.2c0 4.8 10 2.6 10 7.3 0 2.2-2.2 3.5-5 3.5s-5-1.2-5-3.2" />
    </svg>
  );
}

export function PinIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function RocketIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2c3.5 2.2 5.5 6 5.5 10L12 18l-5.5-6C6.5 8 8.5 4.2 12 2z" />
      <circle cx="12" cy="9.5" r="2" />
      <path d="M8.5 16 6 21l4-1.5M15.5 16 18 21l-4-1.5" />
    </svg>
  );
}

export function BanIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </svg>
  );
}

export function CheckIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m5 12.5 5 5L19 6.5" />
    </svg>
  );
}

export function XIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function AlertIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4.5M12 17.2v.01" />
    </svg>
  );
}

export function TargetIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </svg>
  );
}

export function ChartUpIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 17.5 9 11l4 4 7.5-7.5" />
      <path d="M15 7.5h5.5V13" />
    </svg>
  );
}

export function ChartBarIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 20h18" />
      <path d="M6 20v-7M11 20V5M16 20v-10M21 20v-4" />
    </svg>
  );
}

export function MonitorIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8.5 21h7M12 17v4" />
    </svg>
  );
}

export function PencilIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
      <path d="m14.5 5.5 4 4" />
    </svg>
  );
}

export function CurrencyIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.9 0-3 1-3 2.2 0 2.8 6 1.4 6 4.1 0 1.3-1.2 2.2-3 2.2-1.4 0-2.5-.5-3-1.5" />
    </svg>
  );
}

export function SignalIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 20v-4M9.3 20v-8M14.7 20v-12M20 20V4" />
    </svg>
  );
}

export function SparkIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9z" />
      <path d="M18.5 4v2.5M19.8 5.2h-2.5" />
    </svg>
  );
}

export function WaveIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11M12 10.5V4a1.5 1.5 0 0 1 3 0v7M15 11V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7 7 7 0 0 1-7-7v-2a1.5 1.5 0 0 1 3 0" />
      <path d="M9 11V9" />
    </svg>
  );
}

export function ScaleIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v18M7 21h10M12 6l7 2M12 6 5 8" />
      <path d="M5 8 2.5 14a2.5 2.5 0 0 0 5 0zM19 8l-2.5 6a2.5 2.5 0 0 0 5 0z" />
    </svg>
  );
}

export function MedalIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="15" r="6" />
      <path d="M8.5 9.5 6 2.5h12l-2.5 7M12 13v4M10.5 15h3" />
    </svg>
  );
}

export function SmartphoneIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

export function ClockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 5.8V10l2.8 1.8" />
    </svg>
  );
}

/* ── Glyphs added to retire the last 133 emoji used as UI icons. Emoji render
      differently on Windows, iOS and Android, and a medal emoji carrying rank
      is invisible to a screen reader. All of these inherit currentColor and
      carry aria-hidden — the label belongs on the element that owns them. ── */

const S = { fill: "none" as const, stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function WatchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (<svg viewBox="0 0 20 20" {...S} className={className} aria-hidden="true"><path d="M1.8 10S4.7 4.6 10 4.6 18.2 10 18.2 10 15.3 15.4 10 15.4 1.8 10 1.8 10Z" /><circle cx="10" cy="10" r="2.3" /></svg>);
}
export function MegaphoneIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (<svg viewBox="0 0 20 20" {...S} className={className} aria-hidden="true"><path d="M15.5 4.2v11.6L6.4 13V7l9.1-2.8Z" /><path d="M6.4 7H4.2a1.6 1.6 0 0 0-1.6 1.6v2.8A1.6 1.6 0 0 0 4.2 13h2.2M6.8 13.3l1 3.5" /></svg>);
}
export function DocumentIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (<svg viewBox="0 0 20 20" {...S} className={className} aria-hidden="true"><path d="M11.4 2.4H5.8a1.6 1.6 0 0 0-1.6 1.6v12a1.6 1.6 0 0 0 1.6 1.6h8.4a1.6 1.6 0 0 0 1.6-1.6V6.6l-4.4-4.2Z" /><path d="M11.4 2.4v4.2h4.4M7.2 11h5.6M7.2 13.8h4" /></svg>);
}
export function GearIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (<svg viewBox="0 0 20 20" {...S} className={className} aria-hidden="true"><circle cx="10" cy="10" r="2.4" /><path d="M15.9 12.2a1.3 1.3 0 0 0 .3 1.5l.1.1a1.6 1.6 0 1 1-2.3 2.3l-.1-.1a1.3 1.3 0 0 0-2.2.9v.2a1.6 1.6 0 1 1-3.2 0v-.1a1.3 1.3 0 0 0-2.2-.9l-.1.1a1.6 1.6 0 1 1-2.3-2.3l.1-.1a1.3 1.3 0 0 0-.9-2.2h-.2a1.6 1.6 0 1 1 0-3.2h.1a1.3 1.3 0 0 0 .9-2.2l-.1-.1a1.6 1.6 0 1 1 2.3-2.3l.1.1a1.3 1.3 0 0 0 1.5.3h.1a1.3 1.3 0 0 0 .8-1.2v-.2a1.6 1.6 0 1 1 3.2 0v.1a1.3 1.3 0 0 0 2.2.9l.1-.1a1.6 1.6 0 1 1 2.3 2.3l-.1.1a1.3 1.3 0 0 0 .9 2.2h.2a1.6 1.6 0 1 1 0 3.2h-.1a1.3 1.3 0 0 0-1.2.8Z" /></svg>);
}
export function SortIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (<svg viewBox="0 0 20 20" {...S} className={className} aria-hidden="true"><path d="M6.2 3.6v12.8M6.2 3.6 3.4 6.6M6.2 3.6 9 6.6M13.8 16.4V3.6M13.8 16.4l-2.8-3M13.8 16.4l2.8-3" /></svg>);
}
export function SunIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (<svg viewBox="0 0 20 20" {...S} className={className} aria-hidden="true"><circle cx="10" cy="10" r="3.4" /><path d="M10 1.8v1.8M10 16.4v1.8M3.8 3.8l1.3 1.3M14.9 14.9l1.3 1.3M1.8 10h1.8M16.4 10h1.8M3.8 16.2l1.3-1.3M14.9 5.1l1.3-1.3" /></svg>);
}
export function MoonIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (<svg viewBox="0 0 20 20" {...S} className={className} aria-hidden="true"><path d="M17 11.4A7.4 7.4 0 0 1 8.6 3 7.4 7.4 0 1 0 17 11.4Z" /></svg>);
}
export function CloudSunIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (<svg viewBox="0 0 20 20" {...S} className={className} aria-hidden="true"><path d="M6.4 5.4V4M3.3 6.6 2.3 5.6M9.5 6.6l1-1M3 9.8H1.6" /><circle cx="6.4" cy="9.8" r="2.2" /><path d="M8.6 15.6h6.6a2.6 2.6 0 0 0 .3-5.2 3.6 3.6 0 0 0-6.9-.6 2.9 2.9 0 0 0 0 5.8Z" /></svg>);
}
/**
 * Replaces the three medal emoji in the leaderboard. Rank is data, so it is set as
 * a tabular numeral inside a ring rather than as three pictograms a screen
 * reader announces as "1st place medal".
 */
export function RankMark({ rank, className = "h-7 w-7" }: { rank: number; className?: string }) {
  const top = rank <= 3;
  return (
    <span
      className={`inline-flex flex-none items-center justify-center rounded-full border t-figure ${className} ${
        top
          ? "border-[var(--border-accent)] text-[color:var(--content-accent)]"
          : "border-[var(--border-subtle)] text-[color:var(--content-tertiary)]"
      }`}
      style={{ fontSize: top ? "0.9375rem" : "0.8125rem" }}
      aria-hidden="true"
    >
      {rank}
    </span>
  );
}
/**
 * The one mark every empty state uses, rotated per variant. Derived from the
 * logo's arc — an open bracket that reads as "nothing here yet" without being
 * an illustration to commission or an emoji to render differently per OS.
 */
export function EmptyMark({ className = "h-16 w-16", rotate = 0 }: { className?: string; rotate?: number }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} style={{ transform: `rotate(${rotate}deg)` }} aria-hidden="true">
      <path d="M40 12H26a14 14 0 0 0 0 28h8v-8h-8a6 6 0 0 1 0-12h14v32" opacity="0.55" />
      <circle cx="32" cy="32" r="27" strokeDasharray="3 7" opacity="0.35" />
    </svg>
  );
}

export function PaperclipIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16.1 9.4 10 15.5a3.9 3.9 0 0 1-5.5-5.5l6.1-6.1a2.6 2.6 0 0 1 3.7 3.7l-6.1 6.1a1.3 1.3 0 0 1-1.9-1.9l5.7-5.6" />
    </svg>
  );
}
