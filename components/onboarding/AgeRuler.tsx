import { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/lib/theme';

const { width: SW } = Dimensions.get('window');
const TICK_W = 12;
const RANGE_START = 13;
const RANGE_END = 65;
const TOTAL_TICKS = RANGE_END - RANGE_START;
const RULER_W = TOTAL_TICKS * TICK_W;

export default function AgeRuler({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);
  const lastHapticAge = useRef(0);
  const [displayAge, setDisplayAge] = useState(parseInt(value) || 20);

  useEffect(() => {
    const initial = (parseInt(value) || 20) - RANGE_START;
    setTimeout(() => {
      (scrollRef.current as any)?.scrollTo?.({ x: initial * TICK_W, animated: false });
    }, 50);
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const age = Math.round(x / TICK_W) + RANGE_START;
    const clamped = Math.max(RANGE_START, Math.min(RANGE_END, age));
    setDisplayAge(clamped);

    // Haptic on each new number
    if (clamped !== lastHapticAge.current) {
      lastHapticAge.current = clamped;
      Haptics.selectionAsync();
    }
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const age = Math.round(x / TICK_W) + RANGE_START;
    const clamped = Math.max(RANGE_START, Math.min(RANGE_END, age));
    onChange(String(clamped));
  };

  return (
    <View style={s.container}>
      {/* Big number display */}
      <Text style={s.ageDisplay}>{displayAge}</Text>
      <Text style={s.ageLabel}>years old</Text>

      {/* Ruler */}
      <View style={s.rulerWrap}>
        {/* Center indicator line */}
        <View style={s.indicator} />

        <Animated.ScrollView
          ref={scrollRef as any}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK_W}
          decelerationRate="fast"
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onScrollEnd}
          contentContainerStyle={{ paddingHorizontal: SW / 2 - TICK_W / 2 }}
        >
          {Array.from({ length: TOTAL_TICKS + 1 }, (_, i) => {
            const age = RANGE_START + i;
            const isMajor = age % 5 === 0;
            return (
              <View key={age} style={s.tickWrap}>
                <View style={[s.tick, isMajor && s.tickMajor]} />
                {isMajor && <Text style={s.tickLabel}>{age}</Text>}
              </View>
            );
          })}
        </Animated.ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 8, marginTop: 20 },
  ageDisplay: { fontFamily: Fonts.bold, fontSize: 56, color: '#FFF', letterSpacing: -2 },
  ageLabel: { fontFamily: Fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.3)', marginTop: -8 },

  rulerWrap: { width: '100%', height: 70, marginTop: 20, position: 'relative' },
  indicator: {
    position: 'absolute', top: 0, left: '50%', marginLeft: -1,
    width: 2, height: 40, backgroundColor: '#7C5CFC', borderRadius: 1, zIndex: 10,
  },

  tickWrap: { width: TICK_W, alignItems: 'center' },
  tick: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.12)' },
  tickMajor: { height: 32, backgroundColor: 'rgba(255,255,255,0.3)' },
  tickLabel: { fontFamily: Fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 },
});
