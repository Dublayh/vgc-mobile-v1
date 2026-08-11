import type { SVGProps } from 'react';

export type IconName = 'teams' | 'calc' | 'dex' | 'meta' | 'alert' | 'check' | 'spark';

const PATHS: Record<IconName, React.ReactNode> = {
  // Six team slots, lead slot filled
  teams: (
    <>
      <rect x="3" y="5" width="4.6" height="6" fill="currentColor" stroke="none" />
      <rect x="9.7" y="5" width="4.6" height="6" />
      <rect x="16.4" y="5" width="4.6" height="6" />
      <rect x="3" y="13.5" width="4.6" height="6" />
      <rect x="9.7" y="13.5" width="4.6" height="6" />
      <rect x="16.4" y="13.5" width="4.6" height="6" />
    </>
  ),
  // Crossed blades — the damage calc
  calc: (
    <>
      <path d="M4 20 19 5M19 5h-4.2M19 5v4.2" />
      <path d="M20 20 5 5M5 5h4.2M5 5v4.2" />
    </>
  ),
  // Bound dex with tab marks
  dex: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5Z" />
      <path d="M9 3v18" />
      <path d="M13 8h3M13 12h3" />
    </>
  ),
  // Usage bars
  meta: (
    <>
      <path d="M4.5 20V13M10 20V4M15.5 20V9M21 20V6.5" />
      <path d="M3 20h19" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 22 20H2Z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5L19.5 6.5" />,
  // SP spark — stat point marker
  spark: <path d="M12 2.5 14.4 9.6 21.5 12l-7.1 2.4L12 21.5 9.6 14.4 2.5 12l7.1-2.4Z" />,
};

export function Icon({
  name,
  size = 22,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
