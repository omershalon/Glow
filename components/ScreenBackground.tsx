import { View, StyleSheet } from 'react-native';

type Preset = 'home' | 'plan' | 'scan' | 'progress' | 'shop';

export default function ScreenBackground({ preset: _ }: { preset: Preset }) {
  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: -1, backgroundColor: '#08080F' }]}
      pointerEvents="none"
    />
  );
}
