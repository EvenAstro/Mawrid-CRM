import type { ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = () => (
  <Svg>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Svg>
);

export const ContactsIcon = () => (
  <Svg>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 20a5 5 0 0 0-3-4.6" />
  </Svg>
);

export const LeadsIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
  </Svg>
);

export const DealsIcon = () => (
  <Svg>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
  </Svg>
);

export const ActivitiesIcon = () => (
  <Svg>
    <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z" />
  </Svg>
);

export const SearchIcon = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Svg>
);

export const RevenueIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7v10M14.5 9.3A2.4 2.4 0 0 0 12 8c-1.4 0-2.4.8-2.4 1.9 0 2.6 4.8 1.2 4.8 3.9 0 1.1-1.1 1.9-2.4 1.9a2.5 2.5 0 0 1-2.6-1.4" />
  </Svg>
);

export const TasksIcon = () => (
  <Svg>
    <rect x="4" y="3.5" width="16" height="17" rx="2" />
    <path d="m8.5 11 2 2 3.5-4" />
  </Svg>
);

export const TicketsIcon = () => (
  <Svg>
    <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4Z" />
    <path d="M14 6v12" strokeDasharray="2 2" />
  </Svg>
);

export const AnalyticsIcon = () => (
  <Svg>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6" />
  </Svg>
);

export const ScoringIcon = () => (
  <Svg>
    <path d="m12 3.5 2.5 5 5.5.8-4 3.9.95 5.5L12 21.2 7.1 18.7 8 13.2l-4-3.9 5.5-.8Z" />
  </Svg>
);

export const BellIcon = () => (
  <Svg>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Svg>
);
