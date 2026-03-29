import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, BorderRadius, Shadows } from '@/lib/theme';

function TabIcon({
  label,
  icon,
  focused,
  isPrimary,
}: {
  label: string;
  icon: string;
  focused: boolean;
  isPrimary?: boolean;
}) {
  if (isPrimary) {
    return (
      <View style={tabStyles.primaryIconWrapper}>
        <View style={[tabStyles.primaryIconBg, focused && tabStyles.primaryIconBgFocused]}>
          <Text style={tabStyles.primaryIconEmoji}>{icon}</Text>
        </View>
        <Text style={[tabStyles.primaryLabel, focused && tabStyles.primaryLabelFocused]}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View style={tabStyles.iconWrapper}>
      <Text style={[tabStyles.iconEmoji, focused && tabStyles.iconEmojiFocused]}>{icon}</Text>
      <Text style={[tabStyles.iconLabel, focused && tabStyles.iconLabelFocused]}>{label}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    gap: 2,
  },
  iconEmoji: {
    fontSize: 22,
    opacity: 0.5,
  },
  iconEmojiFocused: {
    opacity: 1,
  },
  iconLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 10,
  },
  iconLabelFocused: {
    color: Colors.primary,
    fontWeight: '600',
  },
  primaryIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: -20,
  },
  primaryIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.backgroundDark,
    ...Shadows.lg,
  },
  primaryIconBgFocused: {
    backgroundColor: Colors.primary,
  },
  primaryIconEmoji: {
    fontSize: 24,
  },
  primaryLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 10,
  },
  primaryLabelFocused: {
    color: Colors.primary,
    fontWeight: '600',
  },
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
            <TabIcon label="Home" icon="🏠" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Plan" icon="📋" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Scan" icon="📸" focused={focused} isPrimary />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Progress" icon="📈" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Scan" icon="🔍" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
