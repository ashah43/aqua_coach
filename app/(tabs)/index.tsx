import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

const COLORS = {
  navy: '#04507D',
  blue: '#4873A3',
  aqua: '#41C9E5',
  aqua2: '#6BC7E2',
  coral: '#FB8F6E',
  surface: '#FFFFFF',
  border: '#DAE0E7',
};

type RangeKey = 'day' | 'week' | 'month';

const RANGE_LABEL: Record<RangeKey, string> = {
  day: 'Today',
  week: 'This Week',
  month: 'This Month',
};

type WorkoutRow = {
  id: string;
  user_id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_power_w: number | null;
  avg_acceleration?: number | null;
};

type DisplayStats = {
  sessions: string;
  distance: string;
  totalDuration: string;
};

function getRangeStart(range: RangeKey) {
  const now = new Date();
  const start = new Date(now);

  if (range === 'day') {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatDistanceKm(distanceMeters: number) {
  const km = distanceMeters / 1000;
  return `${km.toFixed(1)} km`;
}

function formatTotalDuration(totalSeconds: number) {
  const rounded = Math.round(totalSeconds);

  if (rounded <= 0) return '0 m';

  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);

  if (hours > 0) {
    return `${hours} h ${minutes} m`;
  }

  return `${minutes} m`;
}

export default function HomeScreen() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [range, setRange] = useState<RangeKey>('week');
  const [stats, setStats] = useState<DisplayStats>({
    sessions: '0',
    distance: '0.0 km',
    totalDuration: '0 m',
  });
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setUser(data?.user ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => {
      isMounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      if (!user) {
        setStats({
          sessions: '0',
          distance: '0.0 km',
          totalDuration: '0 m',
        });
        return;
      }

      setLoadingStats(true);

      const startDate = getRangeStart(range).toISOString();

      const { data, error } = await supabase
        .from('workouts')
        .select('id, user_id, started_at, ended_at, duration_seconds, distance_m, avg_power_w, avg_acceleration')
        .eq('user_id', user.id)
        .gte('started_at', startDate)
        .order('started_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        console.log('Error fetching home stats:', error);
        setStats({
          sessions: '0',
          distance: '0.0 km',
          totalDuration: '0 m',
        });
        setLoadingStats(false);
        return;
      }

      const workouts: WorkoutRow[] = data ?? [];

      const sessionCount = workouts.length;

      const totalDistanceM = workouts.reduce(
        (sum, workout) => sum + (workout.distance_m ?? 0),
        0
      );

      const totalDurationSeconds = workouts.reduce(
        (sum, workout) => sum + (workout.duration_seconds ?? 0),
        0
      );

      setStats({
        sessions: String(sessionCount),
        distance: formatDistanceKm(totalDistanceM),
        totalDuration: formatTotalDuration(totalDurationSeconds),
      });

      setLoadingStats(false);
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [user, range]);

  const meta = user?.user_metadata as any;
  const displayName =
    meta?.full_name || meta?.name || user?.email || '';

  const displayedStats = useMemo(() => {
    if (loadingStats) {
      return {
        sessions: '...',
        distance: '...',
        totalDuration: '...',
      };
    }
    return stats;
  }, [loadingStats, stats]);

  return (
    <ImageBackground
      source={require('@/assets/images/rowing-background.png')}
      style={styles.bg}
      imageStyle={styles.bgImage}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={styles.screen}>
        <ThemedView style={styles.header}>
          <View style={styles.headerTopRow}>
            <Image
              source={require('@/assets/images/aquacoach-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={styles.headerTextWrap}>
              <ThemedText type="title" style={styles.title}>
                Dashboard
              </ThemedText>

              {!!displayName && (
                <ThemedText
                  style={styles.subtitle}
                  numberOfLines={2}
                >
                  {displayName}
                </ThemedText>
              )}
            </View>
          </View>
        </ThemedView>

        <View style={styles.rangeContainer}>
          <View style={styles.rangeRow}>
            {(['day', 'week', 'month'] as const).map((key) => {
              const active = range === key;
              return (
                <View key={key} style={styles.rangePillWrap}>
                  <ThemedText
                    onPress={() => setRange(key)}
                    style={[
                      styles.rangePill,
                      active && styles.rangePillActive,
                    ]}
                  >
                    {RANGE_LABEL[key]}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.grid}>
          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua }]} />
            <ThemedText style={styles.cardLabel}>🚣 Sessions</ThemedText>
            <ThemedText style={styles.cardValue}>{displayedStats.sessions}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua2 }]} />
            <ThemedText style={styles.cardLabel}>📏 Distance</ThemedText>
            <ThemedText style={styles.cardValue}>{displayedStats.distance}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.blue }]} />
            <ThemedText style={styles.cardLabel}>⏱️ Total Duration</ThemedText>
            <ThemedText style={styles.cardValue}>{displayedStats.totalDuration}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.coral }]} />

            <Pressable
              style={styles.signInButton}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <ThemedText style={styles.signInButtonText}>
                {user ? `Welcome, ${displayName}!` : 'Sign in to view stats'}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  bgImage: {
    opacity: 0.28,
  },

  screen: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 44,
    rowGap: 18,
  },

  header: {
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logo: {
    width: 100,
    height: 100,
    marginRight: 14,
  },

  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    fontSize: 30,
    marginBottom: 4,
    letterSpacing: -0.2,
  },

  subtitle: {
    fontSize: 16,
    opacity: 0.75,
    flexWrap: 'wrap',
  },

  rangeContainer: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },

  rangeRow: {
    flexDirection: 'row',
    backgroundColor: '#EAF7FB',
    borderRadius: 999,
    padding: 4,
  },

  rangePillWrap: {
    overflow: 'hidden',
    borderRadius: 999,
  },

  rangePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    opacity: 0.75,
  },

  rangePillActive: {
    backgroundColor: COLORS.aqua,
    opacity: 1,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  card: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    minHeight: 150,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 6,
    width: '100%',
  },

  cardLabel: {
    fontSize: 16,
    opacity: 0.75,
    height: 28,
    textAlign: 'center',
  },

  cardValue: {
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 40,
    marginTop: 8,
    textAlign: 'center',
  },

  signInButton: {
    backgroundColor: COLORS.aqua,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
    width: '100%',
  },

  signInButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0B0E1A',
  },
});