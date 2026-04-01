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
      <View style={{ width: 18, height: 14, borderWidth: 2, borderColor: Colors.white, borderRadius: 4 }}>
        <View style={{ position: 'absolute', top: -4, left: 6, width: 6, height: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2, borderWidth: 2, borderBottomWidth: 0, borderColor: Colors.white }} />
        <View style={{ position: 'absolute', top: 2, left: 3, width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: Colors.white }} />
      </View>
    </View>
  );
}

function TabIcon({ label, icon, color }: { label: string; icon: React.ReactNode; color: string }) {
  return (
    <View style={tabStyles.iconWrapper}>
      {icon}
      <Text style={[tabStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrapper: { alignItems: 'center', gap: 4, paddingTop: 4 },
  label: { fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
  scanCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.secondary,
    justifyContent: 'center', alignItems: 'center',
    marginTop: -22,
    borderWidth: 3, borderColor: Colors.white,
    ...Shadows.lg,
  },
  scanCircleFocused: { backgroundColor: Colors.secondaryDark },
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
            <TabIcon label="Home" color={focused ? Colors.primary : Colors.textMuted} icon={<HomeIcon color={focused ? Colors.primary : Colors.textMuted} />} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Plan" color={focused ? Colors.primary : Colors.textMuted} icon={<PlanIcon color={focused ? Colors.primary : Colors.textMuted} />} />
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
            <TabIcon label="Log" color={focused ? Colors.primary : Colors.textMuted} icon={<LogIcon color={focused ? Colors.primary : Colors.textMuted} />} />
          ),
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Products',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Products" color={focused ? Colors.primary : Colors.textMuted} icon={<ProductsIcon color={focused ? Colors.primary : Colors.textMuted} />} />
          ),
        }}
      />
    </Tabs>
  );
}
