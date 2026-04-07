import { useRef, useCallback } from 'react';
import { Tabs, useSegments, useRouter } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

const FILL   = Colors.primary;
const STROKE = '#FFFFFF';

function HomeIcon({ focused }: { focused: boolean }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      {/* Filled background — invisible when not focused */}
      <Path d="M3 12L12 3L21 12V20a1 1 0 01-1 1H4a1 1 0 01-1-1V12Z" fill={focused ? FILL : 'none'} stroke="none" />
      {/* Original roof line */}
      <Path d="M3 12L12 3l9 9" stroke={STROKE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Original walls */}
      <Path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" stroke={STROKE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlanIcon({ focused }: { focused: boolean }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={3} stroke={STROKE} strokeWidth={2} fill={focused ? FILL : 'none'} />
      <Line x1={7} y1={8}  x2={17} y2={8}  stroke={STROKE} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={7} y1={12} x2={17} y2={12} stroke={STROKE} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={7} y1={16} x2={17} y2={16} stroke={STROKE} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function LogIcon({ focused }: { focused: boolean }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={STROKE} strokeWidth={2} fill={focused ? FILL : 'none'} />
      <Path d="M8 12l3 3 5-5" stroke={STROKE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ProductsIcon({ focused }: { focused: boolean }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M6 2l-3 6h18l-3-6H6z" stroke={STROKE} strokeWidth={2} strokeLinejoin="round" fill={focused ? FILL : 'none'} />
      <Path d="M3 8v12a2 2 0 002 2h14a2 2 0 002-2V8" stroke={STROKE} strokeWidth={2} fill={focused ? FILL : 'none'} />
      <Path d="M10 12a2 2 0 004 0" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ScanIcon({ focused }: { focused: boolean }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11z"
        stroke={STROKE}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? FILL : 'none'}
      />
      <Circle cx={12} cy={13} r={4} stroke={STROKE} strokeWidth={1.8} fill={focused ? FILL : 'none'} />
    </Svg>
  );
}

function ChatBubbleIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/* ── Animated tab button ── */
function AnimatedTabButton({ children, onPress, onLongPress, style, accessibilityState }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.78,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, []);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  }, []);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const segments = useSegments();

  const activeTab = (segments as string[])[1] as string | undefined;
  const showFab   = activeTab !== 'scan' && activeTab !== 'scanner';

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: Colors.background },
          tabBarStyle: {
            backgroundColor: Colors.card,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 82 + insets.bottom,
            paddingBottom: insets.bottom + 4,
            paddingTop: 10,
          },
          tabBarActiveTintColor:   Colors.primary,
          tabBarInactiveTintColor: Colors.white,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            color: Colors.white,
            marginTop: 2,
          },
          tabBarButton: (props) => <AnimatedTabButton {...props} />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plan',
            tabBarIcon: ({ focused }) => <PlanIcon focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarIcon: ({ focused }) => <ScanIcon focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Log',
            tabBarIcon: ({ focused }) => <LogIcon focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="scanner"
          options={{
            title: 'Shop ',
            tabBarIcon: ({ focused }) => <ProductsIcon focused={focused} />,
          }}
        />
      </Tabs>

      {showFab && (
        <TouchableOpacity
          style={[ts.fab, { bottom: insets.bottom + 91 }]}
          activeOpacity={0.85}
          onPress={() => router.push('/coach')}
        >
          <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={ts.fabGradient}>
            <ChatBubbleIcon size={26} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const ts = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    zIndex: 100,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
