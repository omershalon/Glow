import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const BG   = '#08080F';
const P1   = 'rgba(76,29,149,0.85)';
const P2   = 'rgba(91,33,182,0.70)';
const FADE = 'rgba(8,8,15,0)';

type Preset = 'home' | 'plan' | 'scan' | 'progress' | 'shop';

const PRESETS: Record<Preset, {
  primary: { colors: string[]; locations: number[]; start: {x:number;y:number}; end: {x:number;y:number} };
  accent:  { colors: string[]; locations: number[]; start: {x:number;y:number}; end: {x:number;y:number}; style: object };
}> = {
  home: {
    primary: { colors: [BG, BG, 'rgba(59,20,128,0.55)', P1], locations: [0, 0.38, 0.72, 1], start: {x:1,y:1}, end: {x:0,y:0} },
    accent:  { colors: [FADE, P2, P1], locations: [0, 0.5, 1], start: {x:0.5,y:0}, end: {x:0.5,y:1}, style: { bottom:0, right:0, width:'70%', height:'42%' } },
  },
  plan: {
    primary: { colors: [P1, 'rgba(59,20,128,0.50)', BG, BG], locations: [0, 0.28, 0.60, 1], start: {x:0,y:0}, end: {x:1,y:1} },
    accent:  { colors: [P2, 'rgba(76,29,149,0.4)', FADE], locations: [0, 0.5, 1], start: {x:0,y:0}, end: {x:1,y:1}, style: { top:0, left:0, width:'65%', height:'50%' } },
  },
  scan: {
    primary: { colors: [BG, BG, 'rgba(59,20,128,0.60)', P1], locations: [0, 0.40, 0.72, 1], start: {x:0.5,y:0}, end: {x:0.5,y:1} },
    accent:  { colors: [FADE, P2, P1], locations: [0, 0.45, 1], start: {x:0.5,y:0}, end: {x:0.5,y:1}, style: { bottom:0, left:0, right:0, height:'48%' } },
  },
  progress: {
    primary: { colors: [BG, BG, 'rgba(59,20,128,0.55)', P1], locations: [0, 0.38, 0.70, 1], start: {x:0,y:1}, end: {x:1,y:0} },
    accent:  { colors: [FADE, P2, P1], locations: [0, 0.5, 1], start: {x:0,y:1}, end: {x:1,y:0}, style: { bottom:0, left:0, width:'70%', height:'45%' } },
  },
  shop: {
    primary: { colors: [P1, 'rgba(59,20,128,0.50)', BG, BG], locations: [0, 0.30, 0.60, 1], start: {x:1,y:0}, end: {x:0,y:1} },
    accent:  { colors: [P2, 'rgba(76,29,149,0.4)', FADE], locations: [0, 0.5, 1], start: {x:1,y:0}, end: {x:0,y:1}, style: { top:0, right:0, width:'65%', height:'50%' } },
  },
};

export default function ScreenBackground({ preset }: { preset: Preset }) {
  const cfg = PRESETS[preset];
  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={cfg.primary.colors as any}
        locations={cfg.primary.locations}
        start={cfg.primary.start}
        end={cfg.primary.end}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={cfg.accent.colors as any}
        locations={cfg.accent.locations}
        start={cfg.accent.start}
        end={cfg.accent.end}
        style={[{ position: 'absolute' }, cfg.accent.style]}
      />
    </View>
  );
}
