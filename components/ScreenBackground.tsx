import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Filter, FeTurbulence, Rect } from 'react-native-svg';

type Preset = 'home' | 'plan' | 'scan' | 'progress' | 'shop';

const ScreenBackground = memo(function ScreenBackground({ preset: _ }: { preset: Preset }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#08080F', '#100830', '#1A0845']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Subtle noise grain overlay */}
      <Svg style={[StyleSheet.absoluteFill, { opacity: 0.04 }]}>
        <Filter id="noise">
          <FeTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
        </Filter>
        <Rect width="100%" height="100%" filter="url(#noise)" />
      </Svg>
    </View>
  );
});

export default ScreenBackground;
