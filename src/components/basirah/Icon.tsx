import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

/**
 * Basirah line-icon set — every icon is redrawn from the design handoff
 * (24px grid, ~1.7px stroke). Icons that encode a direction of travel
 * (back, forward, send, seek) are pre-mirrored for the RTL layout, same
 * as the prototype's scaleX(-1) transforms.
 */

export type IconName =
  | 'bell'
  | 'gear'
  | 'menu'
  | 'dots'
  | 'chevronBack'
  | 'chevronForward'
  | 'chevronDown'
  | 'book'
  | 'bookOpen'
  | 'layers'
  | 'search'
  | 'spark'
  | 'headphones'
  | 'bookmark'
  | 'play'
  | 'pause'
  | 'skipNext'
  | 'skipPrev'
  | 'seekBack10'
  | 'seekFwd10'
  | 'moon'
  | 'sun'
  | 'mic'
  | 'attach'
  | 'send'
  | 'copy'
  | 'share'
  | 'pencil'
  | 'repeat'
  | 'timer'
  | 'bolt'
  | 'download'
  | 'check'
  | 'wifiOff'
  | 'info'
  | 'thumbUp'
  | 'thumbDown'
  | 'plus'
  | 'journey'
  | 'sliders'
  | 'home'
  | 'heart'
  | 'arrowGo'
  | 'clock'
  | 'close'
  | 'mapPin'
  | 'refresh'
  | 'sunrise'
  | 'sunset';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Renders the filled variant where one exists (bookmark, heart). */
  filled?: boolean;
}

interface Def {
  node: (filled: boolean) => React.ReactNode;
  /** Icon is inherently filled (no stroke). */
  fill?: boolean;
  /** Pre-mirrored for RTL. */
  mirror?: boolean;
}

const DEFS: Record<IconName, Def> = {
  bell: {
    node: () => (
      <>
        <Path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <Path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>
    ),
  },
  gear: {
    node: () => (
      <>
        <Circle cx={12} cy={12} r={3} />
        <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
  menu: {
    node: () => (
      <>
        <Line x1={4} y1={6} x2={20} y2={6} />
        <Line x1={4} y1={12} x2={20} y2={12} />
        <Line x1={4} y1={18} x2={20} y2={18} />
      </>
    ),
  },
  dots: {
    fill: true,
    node: () => (
      <>
        <Circle cx={5} cy={12} r={2} />
        <Circle cx={12} cy={12} r={2} />
        <Circle cx={19} cy={12} r={2} />
      </>
    ),
  },
  chevronBack: { mirror: true, node: () => <Path d="M15 18l-6-6 6-6" /> },
  chevronForward: { node: () => <Path d="M15 18l-6-6 6-6" /> },
  chevronDown: { node: () => <Path d="M6 9l6 6 6-6" /> },
  book: {
    node: () => (
      <>
        <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
  },
  bookOpen: {
    node: () => (
      <>
        <Path d="M2 4h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2z" />
        <Path d="M22 4h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z" />
      </>
    ),
  },
  layers: {
    node: () => (
      <>
        <Path d="M12 2L2 7l10 5 10-5-10-5z" />
        <Path d="M2 17l10 5 10-5" />
        <Path d="M2 12l10 5 10-5" />
      </>
    ),
  },
  search: {
    node: () => (
      <>
        <Circle cx={11} cy={11} r={7} />
        <Path d="M21 21l-4-4" />
      </>
    ),
  },
  spark: { node: () => <Path d="M12 3l1.9 4.6L18 9.5l-4.1 1.9L12 16l-1.9-4.6L6 9.5l4.1-1.9z" /> },
  headphones: {
    node: () => (
      <>
        <Path d="M3 14v-2a9 9 0 0 1 18 0v2" />
        <Path d="M21 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2z" />
        <Path d="M3 15a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2z" />
      </>
    ),
  },
  bookmark: {
    node: (filled) => (
      <Path d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1z" fill={filled ? 'currentColor' : 'none'} />
    ),
  },
  play: { fill: true, node: () => <Path d="M8 5v14l11-7z" /> },
  pause: {
    fill: true,
    node: () => (
      <>
        <Rect x={6} y={5} width={4} height={14} rx={1} />
        <Rect x={14} y={5} width={4} height={14} rx={1} />
      </>
    ),
  },
  skipNext: { fill: true, node: () => <Path d="M4 5v14l8-7zM13 5v14l8-7z" /> },
  skipPrev: { fill: true, mirror: true, node: () => <Path d="M4 5v14l8-7zM13 5v14l8-7z" /> },
  seekBack10: {
    node: () => (
      <>
        <Path d="M11 4L4 8l7 4V4z" />
        <Path d="M20 8a8 8 0 1 1-8-4" />
      </>
    ),
  },
  seekFwd10: {
    mirror: true,
    node: () => (
      <>
        <Path d="M11 4L4 8l7 4V4z" />
        <Path d="M20 8a8 8 0 1 1-8-4" />
      </>
    ),
  },
  moon: { fill: true, node: () => <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /> },
  sun: {
    node: () => (
      <>
        <Circle cx={12} cy={12} r={4} />
        <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
      </>
    ),
  },
  mic: {
    node: () => (
      <>
        <Rect x={9} y={2} width={6} height={12} rx={3} />
        <Path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
      </>
    ),
  },
  attach: {
    node: () => (
      <>
        <Path d="M21 12.8V17a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h6" />
        <Path d="M17 3v6h-6" />
      </>
    ),
  },
  send: { fill: true, mirror: true, node: () => <Path d="M2 21l21-9L2 3v7l15 2-15 2z" /> },
  copy: {
    node: () => (
      <>
        <Rect x={9} y={9} width={12} height={12} rx={2} />
        <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
  },
  share: {
    node: () => (
      <>
        <Circle cx={18} cy={5} r={3} />
        <Circle cx={6} cy={12} r={3} />
        <Circle cx={18} cy={19} r={3} />
        <Path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </>
    ),
  },
  pencil: {
    node: () => (
      <>
        <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <Path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
      </>
    ),
  },
  repeat: {
    node: () => (
      <>
        <Path d="M17 2l4 4-4 4" />
        <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <Path d="M7 22l-4-4 4-4" />
        <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </>
    ),
  },
  timer: {
    node: () => (
      <>
        <Circle cx={12} cy={13} r={8} />
        <Path d="M12 9v4l2 2M9 2h6" />
      </>
    ),
  },
  bolt: { node: () => <Path d="M13 2L3 14h9l-1 8 10-12h-9z" /> },
  download: {
    node: () => (
      <>
        <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <Path d="M7 10l5 5 5-5M12 15V3" />
      </>
    ),
  },
  check: { node: () => <Path d="M20 6L9 17l-5-5" /> },
  wifiOff: {
    node: () => (
      <Path d="M1 1l22 22M16.7 11.7A4 4 0 0 0 12 8M5 12.5a10 10 0 0 1 3-2M8.5 16.5a5 5 0 0 1 5-1M12 20h.01" />
    ),
  },
  info: {
    node: () => (
      <>
        <Circle cx={12} cy={12} r={9} />
        <Path d="M12 8h.01M11 12h1v4h1" />
      </>
    ),
  },
  thumbUp: {
    node: () => (
      <Path d="M7 10v11M18 10l-1.5 8a2 2 0 0 1-2 1.6H4V10l4-8a2 2 0 0 1 2 1.4V8h6a2 2 0 0 1 2 2z" />
    ),
  },
  thumbDown: {
    node: () => (
      <Path
        d="M7 10v11M18 10l-1.5 8a2 2 0 0 1-2 1.6H4V10l4-8a2 2 0 0 1 2 1.4V8h6a2 2 0 0 1 2 2z"
        transform="scale(1,-1) translate(0,-24)"
      />
    ),
  },
  plus: { node: () => <Path d="M12 5v14M5 12h14" /> },
  journey: {
    node: () => (
      <>
        <Circle cx={6} cy={6} r={2.5} />
        <Circle cx={18} cy={18} r={2.5} />
        <Circle cx={18} cy={6} r={2.5} />
        <Path d="M8 7l8 9M8 6h8" />
      </>
    ),
  },
  sliders: {
    node: () => (
      <>
        <Line x1={4} y1={8} x2={14} y2={8} />
        <Circle cx={17} cy={8} r={2.2} />
        <Line x1={10} y1={16} x2={20} y2={16} />
        <Circle cx={7} cy={16} r={2.2} />
      </>
    ),
  },
  home: {
    node: () => (
      <>
        <Path d="M3 10.5L12 3l9 7.5" />
        <Path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
      </>
    ),
  },
  heart: {
    node: (filled) => (
      <Path
        d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"
        fill={filled ? 'currentColor' : 'none'}
      />
    ),
  },
  arrowGo: { mirror: true, node: () => <Path d="M5 12h14M13 6l6 6-6 6" /> },
  clock: {
    node: () => (
      <>
        <Circle cx={12} cy={12} r={9} />
        <Path d="M12 7v5l3 2" />
      </>
    ),
  },
  close: { node: () => <Path d="M18 6L6 18M6 6l12 12" /> },
  mapPin: {
    node: () => (
      <>
        <Path d="M12 21.5s7-6.3 7-11.2a7 7 0 1 0-14 0c0 4.9 7 11.2 7 11.2z" />
        <Circle cx={12} cy={10} r={2.6} />
      </>
    ),
  },
  refresh: {
    node: () => (
      <>
        <Path d="M20.5 12a8.5 8.5 0 1 1-2.4-5.9" />
        <Path d="M20.5 3.5V9H15" />
      </>
    ),
  },
  sunrise: {
    node: () => (
      <>
        <Path d="M17 17a5 5 0 0 0-10 0" />
        <Path d="M12 2.5V7M4.6 9.6l1.5 1.5M17.9 11.1l1.5-1.5M2 17h2M20 17h2" />
        <Path d="M9 21h6" />
        <Path d="M9.5 5 12 2.5 14.5 5" />
      </>
    ),
  },
  sunset: {
    node: () => (
      <>
        <Path d="M17 17a5 5 0 0 0-10 0" />
        <Path d="M12 7V2.5M4.6 9.6l1.5 1.5M17.9 11.1l1.5-1.5M2 17h2M20 17h2" />
        <Path d="M9 21h6" />
        <Path d="M9.5 4.5 12 7l2.5-2.5" />
      </>
    ),
  },
};

export default function Icon({
  name,
  size = 20,
  color = '#0D1B2A',
  strokeWidth = 1.7,
  filled = false,
}: IconProps) {
  const def = DEFS[name];
  const isFill = def.fill === true;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFill ? color : 'none'}
      stroke={isFill ? 'none' : color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      color={color}
      style={def.mirror ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      {def.node(filled)}
    </Svg>
  );
}
