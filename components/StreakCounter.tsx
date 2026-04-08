import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { format, subDays } from 'date-fns';
import { Colors, Fonts } from '@/lib/theme';

async function computeStreak(userId: string): Promise<number> {
  // Gather all activity dates from both tables
  const [scans, photos] = await Promise.all([
    supabase
      .from('skin_profiles')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('progress_photos')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  const allDates = [
    ...((scans.data as { created_at: string }[] ?? []).map(r => new Date(r.created_at))),
    ...((photos.data as { created_at: string }[] ?? []).map(r => new Date(r.created_at))),
  ];

  if (allDates.length === 0) return 0;

  // Deduplicate to unique calendar days
  const uniqueDays = Array.from(
    new Set(allDates.map(d => format(d, 'yyyy-MM-dd')))
  ).sort().reverse(); // newest first

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // Streak must include today or yesterday to still be active
  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0;

  let streak = 0;
  let cursor = uniqueDays[0] === today ? new Date() : subDays(new Date(), 1);

  for (const dayStr of uniqueDays) {
    const expected = format(cursor, 'yyyy-MM-dd');
    if (dayStr === expected) {
      streak++;
      cursor = subDays(cursor, 1);
    } else {
      break;
    }
  }

  return streak;
}

export default function StreakCounter() {
  const [streak, setStreak] = useState(0);
  const [isNewDay, setIsNewDay] = useState(false);
  const flameScale = useRef(new Animated.Value(1)).current;
  const pulseLoop  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const count = await computeStreak(user.id);
      setStreak(count);

      // Check if today already has an entry (meaning streak just extended today)
      const { data: todayScans } = await supabase
        .from('skin_profiles')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', format(new Date(), 'yyyy-MM-dd'))
        .limit(1);
      const { data: todayPhotos } = await supabase
        .from('progress_photos')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', format(new Date(), 'yyyy-MM-dd'))
        .limit(1);

      const actedToday = (todayScans?.length ?? 0) > 0 || (todayPhotos?.length ?? 0) > 0;
      setIsNewDay(actedToday && count > 0);
    })();
  }, []);

  useEffect(() => {
    if (isNewDay) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(flameScale, { toValue: 1.15, duration: 400, useNativeDriver: true }),
          Animated.timing(flameScale, { toValue: 1,    duration: 400, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      flameScale.setValue(1);
    }
    return () => { pulseLoop.current?.stop(); };
  }, [isNewDay, flameScale]);

  if (streak === 0) return null;

  return (
    <View style={styles.row}>
      <Animated.Text style={[styles.flame, { transform: [{ scale: flameScale }] }]}>🔥</Animated.Text>
      <Text style={styles.count}>{streak}</Text>
      <Text style={styles.label}>DAY STREAK</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(124,92,252,0.12)',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.25)',
    alignSelf: 'flex-start',
  },
  flame: {
    fontSize: 14,
  },
  count: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.semibold,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
});
