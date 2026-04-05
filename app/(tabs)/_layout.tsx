import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Shadows } from '@/lib/theme';

function HomeIcon({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
      <View style={{ width: 14, height: 9, backgroundColor: color, marginTop: -1 }}>
        <View style={{ position: 'absolute', bottom: 0, left: 4, width: 6, height: 6, backgroundColor: Colors.background }} />
      </View>
    </View>
  );
}

function PlanIcon({ color }: { color: string }) {
  return (
    <View style={{ gap: 4, justifyContent: 'center', width: 22, height: 22 }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ height: 2, backgroundColor: color, borderRadius: 1, width: i === 0 ? 18 : i === 1 ? 14 : 10 }} />
      ))}
    </View>
  );
}

function LogIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, borderWidth: 2, borderColor: color, borderRadius: 3 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 2, gap: 1.5 }}>
        {[0,1,2,3,4,5].map(i => (
          <View key={i} style={{ width: 4, height: 4, backgroundColor: color, borderRadius: 0.5, opacity: i < 2 ? 0.4 : 1 }} />
        ))}
      </View>
    </View>
  );
}

function ProductsIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: color, borderTopLeftRadius: 4, borderTopRightRadius: 4, marginBottom: 1 }} />
      <View style={{ width: 18, height: 14, borderWidth: 2, borderColor: color, borderRadius: 3 }}>
        <View style={{ position: 'absolute', top: 2, left: 3, width: 3, height: 3, borderWidth: 1.5, borderColor: color, borderRadius: 1.5 }} />
        <View style={{ position: 'absolute', top: 2, right: 3, width: 3, height: 3, borderWidth: 1.5, borderColor: color, borderRadius: 1.5 }} />
      </View>
    </View>
  );
}

function ScanIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[tabStyles.scanCircle, focused && tabStyles.scanCircleFocused]}>
      <View style={{ width: 28, height: 22, position: 'relative' }}>
        {/* Camera top bump — centered */}
        <View style={{
          position: 'absolute', top: 0, left: 8, width: 12, height: 6,
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 3, borderTopRightRadius: 3,
        }} />
        {/* Camera body — solid filled rounded rect */}
        <View style={{
          position: 'absolute', top: 4, width: 28, height: 18,
          backgroundColor: '#FFFFFF',
          borderRadius: 4,
          justifyContent: 'center', alignItems: 'center',
        }}>
          {/* Lens — green ring with green center (punched out look) */}
          <View style={{
            width: 12, height: 12, borderRadius: 6,
            borderWidth: 2.5,
            borderColor: focused ? '#1E3329' : '#2D4A3E',
            backgroundColor: focused ? '#1E3329' : '#2D4A3E',
          }} />
          {/* Lens inner white ring */}
          <View style={{
            position: 'absolute',
            width: 10, height: 10, borderRadius: 5,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            backgroundColor: 'transparent',
          }} />
          {/* Flash dot — top left */}
          <View style={{
            position: 'absolute', top: 3, left: 3,
            width: 3, height: 3, borderRadius: 1.5,
            backgroundColor: focused ? '#1E3329' : '#2D4A3E',
          }} />
        </View>
      </View>
    </View>
  );
}

function TabIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <View style={tabStyles.iconWrapper}>
      {icon}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrapper: { alignItems: 'center', gap: 4, paddingTop: 4 },
  label: { fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
  scanCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2D4A3E',
    justifyContent: 'center', alignItems: 'center',
    marginTop: -22,
    borderWidth: 3, borderColor: Colors.white,
    ...Shadows.lg,
  },
  scanCircleFocused: { backgroundColor: '#1E3329' },
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.borderLight,
          borderTopWidth: 1,
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          ...Shadows.lg,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={<HomeIcon color={focused ? Colors.primary : Colors.textMuted} />} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={<PlanIcon color={focused ? Colors.primary : Colors.textMuted} />} />
          ),
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
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={<LogIcon color={focused ? Colors.primary : Colors.textMuted} />} />
          ),
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Skin Shop',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={<ProductsIcon color={focused ? Colors.primary : Colors.textMuted} />} />
          ),
        }}
      />
    </Tabs>
  );
}
