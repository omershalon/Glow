import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Colors, Typography, Spacing } from '@/lib/theme';

interface DataPoint {
  x: number;
  y: number;
  label: string;
}

interface ProgressChartProps {
  data: DataPoint[];
  height?: number;
}

const CHART_PADDING = { top: 20, right: 20, bottom: 36, left: 36 };

export function ProgressChart({ data, height = 200 }: ProgressChartProps) {
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const chartWidth = SCREEN_WIDTH - 48 - 32; // screen - padding - card padding
  const chartHeight = height;

  if (data.length < 2) {
    return (
      <View style={styles.insufficientData}>
        <Text style={styles.insufficientText}>
          Log at least 2 progress photos to see your chart
        </Text>
      </View>
    );
  }

  const innerWidth = chartWidth - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = chartHeight - CHART_PADDING.top - CHART_PADDING.bottom;

  const minY = Math.min(...data.map((d) => d.y));
  const maxY = Math.max(...data.map((d) => d.y));
  const yRange = maxY - minY || 1;

  const scaleX = (i: number) => (i / (data.length - 1)) * innerWidth + CHART_PADDING.left;
  const scaleY = (val: number) =>
    ((maxY - val) / yRange) * innerHeight + CHART_PADDING.top;

  // Build smooth line path
  const buildPath = () => {
    const points = data.map((d, i) => ({
      x: scaleX(i),
      y: scaleY(d.y),
    }));

    if (points.length === 0) return '';

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cp1x = (points[i - 1].x + points[i].x) / 2;
      const cp1y = points[i - 1].y;
      const cp2x = (points[i - 1].x + points[i].x) / 2;
      const cp2y = points[i].y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  // Build fill area
  const buildFill = () => {
    const points = data.map((d, i) => ({
      x: scaleX(i),
      y: scaleY(d.y),
    }));

    if (points.length === 0) return '';

    let path = `M ${points[0].x} ${chartHeight - CHART_PADDING.bottom}`;
    path += ` L ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const cp1x = (points[i - 1].x + points[i].x) / 2;
      const cp1y = points[i - 1].y;
      const cp2x = (points[i - 1].x + points[i].x) / 2;
      const cp2y = points[i].y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i].x} ${points[i].y}`;
    }

    path += ` L ${points[points.length - 1].x} ${chartHeight - CHART_PADDING.bottom}`;
    path += ' Z';
    return path;
  };

  const linePath = buildPath();
  const fillPath = buildFill();

  // Y axis grid lines
  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    minY + (yRange * i) / (yTicks - 1)
  );

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <SvgLinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.primary} stopOpacity="0.3" />
            <Stop offset="1" stopColor={Colors.primary} stopOpacity="0.02" />
          </SvgLinearGradient>
        </Defs>

        {/* Grid lines */}
        {yTickValues.map((val, i) => {
          const y = scaleY(val);
          return (
            <React.Fragment key={i}>
              <Line
                x1={CHART_PADDING.left}
                y1={y}
                x2={chartWidth - CHART_PADDING.right}
                y2={y}
                stroke={Colors.borderLight}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText
                x={CHART_PADDING.left - 6}
                y={y + 4}
                fontSize={10}
                fill={Colors.textMuted}
                textAnchor="end"
              >
                {val.toFixed(1)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Area fill */}
        <Path d={fillPath} fill="url(#areaGradient)" />

        {/* Line */}
        <Path
          d={linePath}
          stroke={Colors.primary}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points and labels */}
        {data.map((point, i) => {
          const cx = scaleX(i);
          const cy = scaleY(point.y);
          return (
            <React.Fragment key={i}>
              <Circle cx={cx} cy={cy} r={5} fill={Colors.white} stroke={Colors.primary} strokeWidth={2} />
              <Circle cx={cx} cy={cy} r={2.5} fill={Colors.primary} />
              <SvgText
                x={cx}
                y={chartHeight - 4}
                fontSize={10}
                fill={Colors.textMuted}
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>Severity Score</Text>
        </View>
        <Text style={styles.legendNote}>Lower is better</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  insufficientData: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardSubtle,
    borderRadius: 12,
  },
  insufficientText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  legendNote: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '600',
  },
});
