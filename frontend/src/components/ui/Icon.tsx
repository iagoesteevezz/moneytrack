/**
 * Minimal SVG icon set — finance-app focused.
 * All icons are 24×24 viewBox, stroke-based (2px, round caps).
 */

type IconName =
  | 'dashboard'
  | 'transactions'
  | 'budgets'
  | 'insights'
  | 'profile'
  | 'logout'
  | 'plus'
  | 'search'
  | 'filter'
  | 'download'
  | 'edit'
  | 'trash'
  | 'close'
  | 'chevron-down'
  | 'chevron-right'
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-right'
  | 'trending-up'
  | 'trending-down'
  | 'wallet'
  | 'calendar'
  | 'check'
  | 'alert'
  | 'info'
  | 'sparkle'
  | 'target'
  | 'settings'
  | 'more'

interface IconProps {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
  className?: string
}

const paths: Record<IconName, string> = {
  dashboard:     'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  transactions:  'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  budgets:       'M12 2a10 10 0 100 20A10 10 0 0012 2z M12 6v6l4 2',
  insights:      'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  profile:       'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  logout:        'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9',
  plus:          'M12 5v14M5 12h14',
  search:        'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  filter:        'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  download:      'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  edit:          'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:         'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6',
  close:         'M18 6L6 18M6 6l12 12',
  'chevron-down':  'M6 9l6 6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'arrow-up':    'M12 19V5M5 12l7-7 7 7',
  'arrow-down':  'M12 5v14M19 12l-7 7-7-7',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  'trending-up':   'M23 6l-9.5 9.5-5-5L1 18',
  'trending-down': 'M23 18l-9.5-9.5-5 5L1 6',
  wallet:        'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z M16 3H8L4 7h16l-4-4z M12 14a1 1 0 100-2 1 1 0 000 2z',
  calendar:      'M3 9h18M7 3v2m10-2v2 M3 5h18a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1z',
  check:         'M20 6L9 17l-5-5',
  alert:         'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  info:          'M12 22a10 10 0 100-20 10 10 0 000 20z M12 8h.01 M11 12h1v4h1',
  sparkle:       'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z',
  target:        'M12 22a10 10 0 100-20 10 10 0 000 20z M12 18a6 6 0 100-12 6 6 0 000 12z M12 14a2 2 0 100-4 2 2 0 000 4z',
  settings:      'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  more:          'M12 13a1 1 0 100-2 1 1 0 000 2z M19 13a1 1 0 100-2 1 1 0 000 2z M5 13a1 1 0 100-2 1 1 0 000 2z',
}

export function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.75, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name].split(' M').map((segment, i) => (
        <path key={i} d={i === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  )
}
