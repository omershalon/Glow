import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Colors, Fonts } from '@/lib/theme';

const { width: SW } = Dimensions.get('window');
const GW = SW - 96; // graph width
const GH = 140; // graph height

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function AnimatedGraph({ skinType }: { skinType: string }) {
  const drawProgress = useRef(new Animated.Value(0)).current;
  const statOpacity = useRef(new Animated.Value(0)).current;
  const statScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Draw the graph line, then pop in the stat
    Animated.sequence([
      Animated.delay(400),
      Animated.timing(drawProgress, { toValue: 1, duration: 1800, useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(statOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(statScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // SVG path for the improvement curve
  const curvePath = `M 0 ${GH * 0.85} Q ${GW * 0.2} ${GH * 0.75}, ${GW * 0.35} ${GH * 0.55} Q ${GW * 0.5} ${GH * 0.35}, ${GW * 0.7} ${GH * 0.2} L ${GW} ${GH * 0.1}`;
  const flatPath = `M 0 ${GH * 0.85} Q ${GW * 0.3} ${GH * 0.82}, ${GW * 0.5} ${GH * 0.88} Q ${GW * 0.7} ${GH * 0.92}, ${GW} ${GH * 0.95}`;

  // Approximate total path length for stroke animation
  const pathLength = GW * 1.3;

  return (
    <View style={s.container}>
      <Text style={s.title}>Your skin can improve</Text>
      <Text style={s.subtitle}>Based on users with {skinType?.toLowerCase() || 'similar'} skin</Text>

      <View style={s.graphCard}>
        <Text style={s.graphLabel}>Skin Clarity</Text>

        <Svg width={GW} height={GH} viewBox={`0 0 ${GW} ${GH}`}>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(pct => (
            <Line key={pct} x1={0} y1={GH * pct} x2={GW} y2={GH * pct}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}

          {/* "Without changes" dashed line */}
          <Path d={flatPath} stroke="rgba(255,255,255,0.12)" strokeWidth={1.5}
            fill="none" strokeDasharray="5,4" />

          {/* "With plan" animated line */}
          <AnimatedPath
            d={curvePath}
            stroke={Colors.primary}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={pathLength}
            strokeDashoffset={drawProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [pathLength, 0],
            })}
          />
        </Svg>

        {/* X axis */}
        <View style={s.xAxis}>
          <Text style={s.xLabel}>Week 1</Text>
          <Text style={s.xLabel}>Week 3</Text>
          <Text style={s.xLabel}>Week 6</Text>
        </View>

        {/* Legend */}
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: Colors.primary }]} />
            <Text style={s.legendText}>With SkinX</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
            <Text style={s.legendText}>Without changes</Text>
          </View>
        </View>
      </View>

      {/* Stat that pops in after graph draws */}
      <Animated.View style={[s.statRow, { opacity: statOpacity, transform: [{ scale: statScale }] }]}>
        <Text style={s.statText}>92% of users see visible improvement by week 4</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 16 },
  title: { fontFamily: Fonts.bold, fontSize: 28, color: '#FFF', lineHeight: 36, letterSpacing: -0.5 },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.35)', marginTop: -8 },

  graphCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 10, marginTop: 8,
  },
  graphLabel: { fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.3)' },

  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  xLabel: { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.2)' },

  legend: { flexDirection: 'row', gap: 20, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 3, borderRadius: 1.5 },
  legendText: { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.2)' },

  statRow: { alignItems: 'center', marginTop: 4 },
  statText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.primaryLight, textAlign: 'center' },
});
