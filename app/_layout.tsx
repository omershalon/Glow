import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

function RootLayoutNav({ session }: { session: Session | null }) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = inAuthGroup && segments[1] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup && !inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [session, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="product" options={{ presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [fontsLoaded] = useFonts({
    'NunitoSans-Regular': require('@expo-google-fonts/nunito-sans/400Regular/NunitoSans_400Regular.ttf'),
    'NunitoSans-Medium': require('@expo-google-fonts/nunito-sans/500Medium/NunitoSans_500Medium.ttf'),
    'NunitoSans-SemiBold': require('@expo-google-fonts/nunito-sans/600SemiBold/NunitoSans_600SemiBold.ttf'),
    'NunitoSans-Bold': require('@expo-google-fonts/nunito-sans/700Bold/NunitoSans_700Bold.ttf'),
    'NunitoSans-ExtraBold': require('@expo-google-fonts/nunito-sans/800ExtraBold/NunitoSans_800ExtraBold.ttf'),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!initialized || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootLayoutNav session={session} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
