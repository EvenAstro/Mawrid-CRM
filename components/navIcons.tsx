import type { ReactNode } from "react";

function Svg({
  children,
  className = "h-5 w-5",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

type P = { className?: string };

/* grid-2x2 */
export const DashboardIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </Svg>
);

/* users */
export const ContactsIcon = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 20a5 5 0 0 0-3-4.6" />
  </Svg>
);

/* target / crosshair */
export const LeadsIcon = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
  </Svg>
);

/* layers */
export const DealsIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Svg>
);

/* activity wave */
export const ActivitiesIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M3 12h4l2.5-7 5 14L17 12h4" />
  </Svg>
);

/* check-square */
export const TasksIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="m8.5 12 2.5 2.5L16 9" />
  </Svg>
);

/* bar-chart-2 */
export const AnalyticsIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M18 20V10M12 20V4M6 20v-6" />
  </Svg>
);

/* zap */
export const ScoringIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z" />
  </Svg>
);

/* check-circle */
export const CheckCircleIcon = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5L16 9" />
  </Svg>
);

/* trending-up */
export const TrendingUpIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M17 7h4v4" />
  </Svg>
);

/* briefcase (kept for reuse) */
export const RevenueIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
  </Svg>
);

/* bell */
export const BellIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Svg>
);

/* search */
export const SearchIcon = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Svg>
);

/* chevron-down */
export const ChevronDownIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

/* sparkle-chart */
export const InsightsIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M4 20V11M10 20V6M16 20v-8M20 20v-4" />
    <path d="M18.5 3.5v3M17 5h3" />
  </Svg>
);

/* open-book */
export const PlaybookIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 6.5c-1.8-1.3-4-2-6.5-2-.6 0-1 .4-1 1v11c0 .6.4 1 1 1 2.5 0 4.7.7 6.5 2 1.8-1.3 4-2 6.5-2 .6 0 1-.4 1-1v-11c0-.6-.4-1-1-1-2.5 0-4.7.7-6.5 2Z" />
    <path d="M12 6.5v13" />
  </Svg>
);

/* revenue intelligence — pipeline chart with signal dot */
export const RevenueIntelIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M3 3v18h18" />
    <path d="m7 16 4-4 4 4 4-4" />
    <circle cx="19" cy="5" r="2.5" fill="currentColor" stroke="none" />
  </Svg>
);

/* logout */
export const LogoutIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 17l-5-5 5-5M5 12h11" />
  </Svg>
);

/* coach / performance */
export const CoachIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4Z" />
    <path d="M18 20c0-3.3-2.7-6-6-6s-6 2.7-6 6" />
    <path d="M15 11l2 2 3.5-3.5" />
  </Svg>
);

/* team / users management */
export const UsersIcon = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
    <circle cx="17" cy="8.5" r="2.4" />
    <path d="M15.8 14.2c2.4.3 4.2 2.3 4.2 5.3" />
  </Svg>
);
