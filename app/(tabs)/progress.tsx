// app/(tabs)/progress.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

type WorkoutRow = {
  id: string;
  user_id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_power_w: number | null;
  created_at: string | null;
};

export default function ProgressScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [lastWorkout, setLastWorkout] = useState<WorkoutRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Load current user once and subscribe to auth changes
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setUser(data?.user ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  // When user changes, load their last workout
  useEffect(() => {
    if (!user) {
      setLastWorkout(null);
      setLoading(false);
      return;
    }

    const fetchLastWorkout = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('workouts')
        .select(
          'id, user_id, started_at, ended_at, duration_seconds, distance_m, avg_power_w, created_at'
        )
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.log('Error loading last workout:', error);
        setLastWorkout(null);
      } else {
        setLastWorkout(data);
      }
      setLoading(false);
    };

    fetchLastWorkout();
  }, [user?.id]);

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return '—';
    const mm = Math.floor(seconds / 60);
    const ss = (seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const distanceMeters = lastWorkout?.distance_m ?? null;
  const distanceKm =
    distanceMeters != null ? (distanceMeters / 1000).toFixed(2) : null;

  const avgPower =
    lastWorkout?.avg_power_w != null
      ? `${lastWorkout.avg_power_w.toFixed(0)} W`
      : '—';

  let subtitle = '';
  if (loading) {
    subtitle = 'Loading your last workout...';
  } else if (!user) {
    subtitle = 'Sign in to see your saved workouts.';
  } else if (!lastWorkout) {
    subtitle = 'No workouts saved yet. Start a session to log one!';
  } else {
    subtitle = `Last workout on ${formatDateTime(lastWorkout.started_at)}`;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {/* Hero: Last workout summary */}
      <ThemedView style={styles.hero}>
        <ThemedText type="title" style={styles.title}>
          Last Workout
        </ThemedText>
        <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
      </ThemedView>

      {/* Only show details if we actually have a workout */}
      {lastWorkout && (
        <>
          {/* Top row: Distance + Duration */}
          <View style={styles.topRow}>
            <ThemedView style={styles.statCard}>
              <ThemedText style={styles.cardLabelTop}>Distance</ThemedText>
              <ThemedText style={styles.bigValue}>
                {distanceKm ?? '—'} km
              </ThemedText>
              <ThemedText style={styles.cardLabelBottom}>
                {distanceMeters != null
                  ? `${distanceMeters.toFixed(0)} m total`
                  : 'No distance recorded'}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.statCard}>
              <ThemedText style={styles.cardLabelTop}>Duration</ThemedText>
              <ThemedText style={styles.bigValue}>
                {formatDuration(lastWorkout.duration_seconds)}
              </ThemedText>
              <ThemedText style={styles.cardLabelBottom}>
                Started at {formatDateTime(lastWorkout.started_at)}
              </ThemedText>
            </ThemedView>
          </View>

          {/* Bottom row: Avg power + End time */}
          <View style={styles.bottomRow}>
            <ThemedView style={styles.smallCard}>
              <ThemedText style={styles.smallLabel}>Avg Power</ThemedText>
              <ThemedText style={styles.smallValue}>{avgPower}</ThemedText>
            </ThemedView>

            <ThemedView style={styles.smallCard}>
              <ThemedText style={styles.smallLabel}>Ended At</ThemedText>
              <ThemedText style={styles.smallValue}>
                {formatDateTime(lastWorkout.ended_at)}
              </ThemedText>
            </ThemedView>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const R = 22;

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 44,
    rowGap: 16,
  },

  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: R + 4,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#EEF1F5',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  title: { fontSize: 28, marginBottom: 6 },
  subtitle: { fontSize: 16, opacity: 0.75 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: R,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardLabelTop: { fontSize: 15, opacity: 0.6, marginBottom: 6 },
  bigValue: {
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 34,
    marginBottom: 6,
    letterSpacing: 0,
  },
  cardLabelBottom: { fontSize: 15, opacity: 0.6 },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 16,
  },
  smallCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: R,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  smallLabel: { fontSize: 15, opacity: 0.6, marginBottom: 6 },
  smallValue: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: 0,
  },
});
