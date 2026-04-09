import Svg, { Path, Circle, Line, Rect, Polyline, G } from 'react-native-svg';

const S = 22; // default size
const C = 'rgba(255,255,255,0.5)'; // default color
const W = 1.8; // default stroke width

// ── Gender icons ──
export function MaleIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={10} cy={14} r={5} stroke={color} strokeWidth={W} />
      <Path d="M14 10l6-6M16 4h4v4" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FemaleIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={9} r={5} stroke={color} strokeWidth={W} />
      <Line x1={12} y1={14} x2={12} y2={22} stroke={color} strokeWidth={W} strokeLinecap="round" />
      <Line x1={9} y1={18} x2={15} y2={18} stroke={color} strokeWidth={W} strokeLinecap="round" />
    </Svg>
  );
}

export function OtherGenderIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={W} />
      <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke={color} strokeWidth={W} strokeLinecap="round" />
    </Svg>
  );
}

// ── Skin type icons ──
export function OilyIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C12 2 6 10 6 14a6 6 0 0012 0c0-4-6-12-6-12z" stroke={color} strokeWidth={W} strokeLinejoin="round" />
    </Svg>
  );
}

export function DryIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={W} />
      <Path d="M8 10c1-1 3-1 4 0s3 1 4 0" stroke={color} strokeWidth={W} strokeLinecap="round" />
      <Path d="M8 14c1-1 3-1 4 0s3 1 4 0" stroke={color} strokeWidth={W} strokeLinecap="round" />
    </Svg>
  );
}

export function ComboIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={W} />
      <Line x1={12} y1={4} x2={12} y2={20} stroke={color} strokeWidth={W} strokeLinecap="round" />
    </Svg>
  );
}

export function SensitiveIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" stroke={color} strokeWidth={W} strokeLinejoin="round" />
    </Svg>
  );
}

export function NormalIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke={color} strokeWidth={W} strokeLinecap="round" />
      <Polyline points="22 4 12 14.01 9 11.01" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function QuestionIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={W} />
      <Path d="M9 9a3 3 0 015.12 1.5c0 2-3 2.5-3 4.5" stroke={color} strokeWidth={W} strokeLinecap="round" />
      <Circle cx={12} cy={18} r={0.5} fill={color} />
    </Svg>
  );
}

// ── Duration icons ──
export function ClockIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={W} />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth={W} strokeLinecap="round" />
    </Svg>
  );
}

// ── Goal icons ──
export function TargetIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={W} />
      <Circle cx={12} cy={12} r={5} stroke={color} strokeWidth={W} />
      <Circle cx={12} cy={12} r={1.5} fill={color} />
    </Svg>
  );
}

export function TrendDownIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="23 18 13.5 8.5 8.5 13.5 1 6" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function ShieldIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={W} strokeLinejoin="round" />
    </Svg>
  );
}

export function SparkleIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7l2-7z" stroke={color} strokeWidth={W} strokeLinejoin="round" />
    </Svg>
  );
}

// ── Holistic icons ──
export function LeafIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 8c2-5-7-6-13-2 4 8 11 8 13 2z" stroke={color} strokeWidth={W} strokeLinejoin="round" />
      <Path d="M6 16c2-2 4-3 8-4" stroke={color} strokeWidth={W} strokeLinecap="round" />
    </Svg>
  );
}

// ── Barrier icons ──
export function BlockIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={W} />
      <Line x1={5.7} y1={5.7} x2={18.3} y2={18.3} stroke={color} strokeWidth={W} strokeLinecap="round" />
    </Svg>
  );
}

// ── Commitment icons ──
export function FlameIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22c4.97 0 8-3.03 8-8 0-4-2.5-7-4-9-1.5 2-2 3.5-2 5 0 0-2-1.5-2-4 0-2 1-4 2-5.5C12 3 10 5 9 7c-1.5 2-3 4-3 7 0 4.97 3.03 8 6 8z" stroke={color} strokeWidth={W} strokeLinejoin="round" />
    </Svg>
  );
}

// ── Tried icons ──
export function PillIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={8} width={16} height={8} rx={4} stroke={color} strokeWidth={W} />
      <Line x1={12} y1={8} x2={12} y2={16} stroke={color} strokeWidth={W} />
    </Svg>
  );
}

export function BottleIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={7} y={10} width={10} height={11} rx={2} stroke={color} strokeWidth={W} />
      <Path d="M9 10V7h6v3" stroke={color} strokeWidth={W} strokeLinecap="round" />
      <Rect x={10} y={4} width={4} height={3} rx={1} stroke={color} strokeWidth={W} />
    </Svg>
  );
}

export function SaladIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12h16" stroke={color} strokeWidth={W} strokeLinecap="round" />
      <Path d="M4 12c0 4.4 3.6 8 8 8s8-3.6 8-8" stroke={color} strokeWidth={W} />
      <Path d="M8 12V8c0-1.1.9-2 2-2M14 12V9c0-1.7 1.3-3 3-3" stroke={color} strokeWidth={W} strokeLinecap="round" />
    </Svg>
  );
}

export function DoctorIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={W} />
      <Path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke={color} strokeWidth={W} strokeLinecap="round" />
      <Path d="M10 14v3h4v-3" stroke={color} strokeWidth={W} />
    </Svg>
  );
}

export function FacialIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={W} />
      <Circle cx={9} cy={10} r={1} fill={color} />
      <Circle cx={15} cy={10} r={1} fill={color} />
      <Path d="M8 15c1.5 2 6.5 2 8 0" stroke={color} strokeWidth={W} strokeLinecap="round" />
    </Svg>
  );
}

export function EmptyIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={16} height={16} rx={3} stroke={color} strokeWidth={W} />
    </Svg>
  );
}

// ── Concern icons ──
export function BreakoutIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={8} cy={10} r={2} stroke={color} strokeWidth={W} />
      <Circle cx={16} cy={8} r={1.5} stroke={color} strokeWidth={W} />
      <Circle cx={12} cy={16} r={2.5} stroke={color} strokeWidth={W} />
    </Svg>
  );
}

export function ScarIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 18L18 6" stroke={color} strokeWidth={W} strokeLinecap="round" />
      <Path d="M9 6l-3 3M18 15l-3 3" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SunIcon({ size = S, color = C }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={5} stroke={color} strokeWidth={W} />
      <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={color} strokeWidth={W} strokeLinecap="round" />
    </Svg>
  );
}
