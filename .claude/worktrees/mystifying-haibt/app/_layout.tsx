import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export default function RootLayout() {
  const router   = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return; // still loading initial session

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Not logged in — send to login
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Logged in — send to app
      router.replace('/(tabs)');
    }
  }, [session, segments]);

  if (!fontsLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
