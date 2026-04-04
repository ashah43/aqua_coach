import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Modal,
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
  ink: '#0B0E1A',
};

type RangeKey = 'Week' | 'Month' | 'All';

const RANGE_LABEL: Record<RangeKey, string> = {
  Week: 'This Week',
  Month: 'This Month',
  All: 'All Time',
};

type WorkoutRow = {
  id: string;
  user_id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_power_w: number | null;
  avg_acceleration: number | null;
};

type ProgressStats = {
  totalDistanceM: number;
  totalSessions: number;
  bestAvgPower: number;
  bestAvgAcceleration: number;
};

function RangePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.rangePill, active && styles.rangePillActive]}
      hitSlop={8}
    >
      <ThemedText style={[styles.rangePillText, active && styles.rangePillTextActive]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function getRangeStart(range: RangeKey) {
  const now = new Date();
  const start = new Date(now);

  if (range === 'Week') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === 'Month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  return null;
}

function formatKm(distanceM: number) {
  return `${(distanceM / 1000).toFixed(1)} km`;
}

function formatMeters(distanceM: number) {
  return `${Math.round(distanceM)} m traveled`;
}

function formatPower(power: number) {
  if (power <= 0) return '— W';
  return `${Math.round(power)} W`;
}

function formatAcceleration(accel: number) {
  if (accel <= 0) return '—';
  return `${accel.toFixed(2)} m/s²`;
}

function formatDuration(totalSeconds: number | null) {
  if (!totalSeconds || totalSeconds <= 0) return '0m 0s';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function formatWorkoutDate(dateString: string | null) {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatWorkoutTime(dateString: string | null) {
  if (!dateString) return 'Unknown time';
  const date = new Date(dateString);

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function buildBars(workouts: WorkoutRow[], range: RangeKey) {
  if (range === 'Week') {
    const monday = getRangeStart('Week')!;
    const bars = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(monday);
      dayStart.setDate(monday.getDate() + i);
      const dayEnd = endOfDay(dayStart);

      const total = workouts.reduce((sum, workout) => {
        if (!workout.started_at) return sum;
        const started = new Date(workout.started_at);
        if (started >= dayStart && started <= dayEnd) {
          return sum + (workout.distance_m ?? 0);
        }
        return sum;
      }, 0);

      return total;
    });

    return bars;
  }

  if (range === 'Month') {
    const firstDay = getRangeStart('Month')!;
    const year = firstDay.getFullYear();
    const month = firstDay.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const bucketCount = Math.min(5, Math.ceil(daysInMonth / 7));

    const bars = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = new Date(year, month, 1 + i * 7);
      const bucketEnd = new Date(
        year,
        month,
        Math.min(daysInMonth, (i + 1) * 7),
        23,
        59,
        59,
        999
      );

      const total = workouts.reduce((sum, workout) => {
        if (!workout.started_at) return sum;
        const started = new Date(workout.started_at);
        if (started >= bucketStart && started <= bucketEnd) {
          return sum + (workout.distance_m ?? 0);
        }
        return sum;
      }, 0);

      return total;
    });

    return bars;
  }

  const allWorkouts = workouts
    .filter((w) => !!w.started_at)
    .sort((a, b) => {
      const aTime = a.started_at ? new Date(a.started_at).getTime() : 0;
      const bTime = b.started_at ? new Date(b.started_at).getTime() : 0;
      return aTime - bTime;
    });

  if (allWorkouts.length === 0) {
    return Array(12).fill(0);
  }

  const newest = new Date(allWorkouts[allWorkouts.length - 1].started_at!);
  const bars = Array.from({ length: 12 }, (_, i) => {
    const monthDate = new Date(
      newest.getFullYear(),
      newest.getMonth() - (11 - i),
      1
    );
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const total = allWorkouts.reduce((sum, workout) => {
      if (!workout.started_at) return sum;
      const started = new Date(workout.started_at);
      if (started >= monthStart && started <= monthEnd) {
        return sum + (workout.distance_m ?? 0);
      }
      return sum;
    }, 0);

    return total;
  });

  return bars;
}

export default function ProgressScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [range, setRange] = useState<RangeKey>('Week');
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutRow[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

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

    const fetchWorkouts = async () => {
      if (!user) {
        setWorkouts([]);
        return;
      }

      setLoading(true);

      const rangeStart = getRangeStart(range);

      let query = supabase
        .from('workouts')
        .select(
          'id, user_id, started_at, ended_at, duration_seconds, distance_m, avg_power_w, avg_acceleration'
        )
        .eq('user_id', user.id)
        .order('started_at', { ascending: true });

      if (rangeStart) {
        query = query.gte('started_at', rangeStart.toISOString());
      }

      const { data, error } = await query;

      if (cancelled) return;

      if (error) {
        console.log('Error fetching progress workouts:', error);
        setWorkouts([]);
        setLoading(false);
        return;
      }

      setWorkouts((data as WorkoutRow[]) ?? []);
      setLoading(false);
    };

    fetchWorkouts();

    return () => {
      cancelled = true;
    };
  }, [user, range]);

  useEffect(() => {
    let cancelled = false;

    const fetchRecentWorkouts = async () => {
      if (!user) {
        setRecentWorkouts([]);
        setSelectedWorkout(null);
        return;
      }

      const { data, error } = await supabase
        .from('workouts')
        .select(
          'id, user_id, started_at, ended_at, duration_seconds, distance_m, avg_power_w, avg_acceleration'
        )
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(10);

      if (cancelled) return;

      if (error) {
        console.log('Error fetching recent workouts:', error);
        setRecentWorkouts([]);
        setSelectedWorkout(null);
        return;
      }

      const rows = (data as WorkoutRow[]) ?? [];
      setRecentWorkouts(rows);
      setSelectedWorkout(rows[0] ?? null);
    };

    fetchRecentWorkouts();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const stats: ProgressStats = useMemo(() => {
    const totalDistanceM = workouts.reduce(
      (sum, workout) => sum + (workout.distance_m ?? 0),
      0
    );

    const totalSessions = workouts.length;

    const bestAvgPower = workouts.reduce((max, workout) => {
      const value = workout.avg_power_w ?? 0;
      return value > max ? value : max;
    }, 0);

    const bestAvgAcceleration = workouts.reduce((max, workout) => {
      const value = workout.avg_acceleration ?? 0;
      return value > max ? value : max;
    }, 0);

    return {
      totalDistanceM,
      totalSessions,
      bestAvgPower,
      bestAvgAcceleration,
    };
  }, [workouts]);

  const bars = useMemo(() => buildBars(workouts, range), [workouts, range]);
  const maxBarValue = Math.max(...bars, 1);

  const shownDistanceKm = loading ? '...' : formatKm(stats.totalDistanceM);
  const shownDistanceM = loading ? '...' : formatMeters(stats.totalDistanceM);
  const shownSessions = loading ? '...' : String(stats.totalSessions);
  const shownBestAvgPower = loading ? '...' : formatPower(stats.bestAvgPower);
  const shownBestAvgAcceleration = loading
    ? '...'
    : formatAcceleration(stats.bestAvgAcceleration);

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
            <View style={{ flex: 1 }}>
              <ThemedText type="title" style={styles.title}>
                Progress
              </ThemedText>
              <ThemedText style={styles.subtitle}>Track your progress</ThemedText>
            </View>
          </View>
        </ThemedView>

        <View style={styles.rangeContainer}>
          <View style={styles.rangeRow}>
            {(['Week', 'Month', 'All'] as const).map((key) => {
              const active = range === key;
              return (
                <RangePill
                  key={key}
                  label={key}
                  active={active}
                  onPress={() => setRange(key)}
                />
              );
            })}
          </View>
        </View>

        <Pressable
          style={styles.historyButton}
          onPress={() => setHistoryVisible(true)}
        >
          <ThemedText style={styles.historyButtonText}>Workout History</ThemedText>
        </Pressable>

        <View style={styles.grid}>
          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua }]} />
            <ThemedText style={styles.cardLabel}>📏 Total Distance</ThemedText>
            <ThemedText style={styles.cardValue}>{shownDistanceKm}</ThemedText>
            <ThemedText style={styles.cardSub}>{shownDistanceM}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua2 }]} />
            <ThemedText style={styles.cardLabel}>🚣 Total Sessions</ThemedText>
            <ThemedText style={styles.cardValue}>{shownSessions}</ThemedText>
            <ThemedText style={styles.cardSub}>completed</ThemedText>
          </ThemedView>
        </View>

        <ThemedView style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <ThemedText style={styles.chartTitle}>Distance Trend</ThemedText>
            <ThemedText style={styles.chartSubTitle}>{RANGE_LABEL[range]}</ThemedText>
          </View>

          <View style={styles.chartArea}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridH, { top: 18 + i * 36 }]} />
            ))}
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={`v-${i}`} style={[styles.gridV, { left: 18 + i * 62 }]} />
            ))}

            <View style={styles.barsRow}>
              {bars.map((value, idx) => {
                const normalizedHeight =
                  value <= 0 ? 12 : 12 + (value / maxBarValue) * 88;

                return (
                  <View
                    key={idx}
                    style={[styles.bar, { height: normalizedHeight }]}
                  />
                );
              })}
            </View>
          </View>
        </ThemedView>

        <View style={styles.grid}>
          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.blue }]} />
            <ThemedText style={styles.cardLabel}>⚡ Best Avg Power</ThemedText>
            <ThemedText style={styles.cardValue}>{shownBestAvgPower}</ThemedText>
            <ThemedText style={styles.cardSub}>Highest saved average</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.coral }]} />
            <ThemedText style={styles.cardLabel}>📈 Best Avg Acceleration</ThemedText>
            <ThemedText style={styles.cardValueSmall}>{shownBestAvgAcceleration}</ThemedText>
            <ThemedText style={styles.cardSub}>Highest saved average</ThemedText>
          </ThemedView>
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>

      <Modal
        visible={historyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Workout History</ThemedText>
              <Pressable onPress={() => setHistoryVisible(false)}>
                <ThemedText style={styles.modalClose}>✕</ThemedText>
              </Pressable>
            </View>

            {recentWorkouts.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyStateText}>
                  No saved workouts yet.
                </ThemedText>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <ThemedText style={styles.sectionTitle}>Last 10 Workouts</ThemedText>

                {recentWorkouts.map((workout) => {
                  const active = selectedWorkout?.id === workout.id;

                  return (
                    <Pressable
                      key={workout.id}
                      style={[
                        styles.workoutRow,
                        active && styles.workoutRowActive,
                      ]}
                      onPress={() => setSelectedWorkout(workout)}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.workoutRowTitle}>
                          {formatWorkoutDate(workout.started_at)}
                        </ThemedText>
                        <ThemedText style={styles.workoutRowSub}>
                          {formatWorkoutTime(workout.started_at)}
                        </ThemedText>
                      </View>

                      <ThemedText style={styles.workoutRowDistance}>
                        {formatKm(workout.distance_m ?? 0)}
                      </ThemedText>
                    </Pressable>
                  );
                })}

                {selectedWorkout && (
                  <View style={styles.detailCard}>
                    <ThemedText style={styles.sectionTitle}>
                      Selected Workout Stats
                    </ThemedText>

                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Date</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {formatWorkoutDate(selectedWorkout.started_at)}
                      </ThemedText>
                    </View>

                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Start Time</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {formatWorkoutTime(selectedWorkout.started_at)}
                      </ThemedText>
                    </View>

                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Duration</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {formatDuration(selectedWorkout.duration_seconds)}
                      </ThemedText>
                    </View>

                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Distance</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {formatKm(selectedWorkout.distance_m ?? 0)}
                      </ThemedText>
                    </View>

                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Distance (m)</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {Math.round(selectedWorkout.distance_m ?? 0)} m
                      </ThemedText>
                    </View>

                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Avg Power</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {formatPower(selectedWorkout.avg_power_w ?? 0)}
                      </ThemedText>
                    </View>

                    <View style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Avg Acceleration</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {formatAcceleration(selectedWorkout.avg_acceleration ?? 0)}
                      </ThemedText>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgImage: { opacity: 0.28 },

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
    gap: 14,
  },
  logo: { width: 100, height: 100 },
  title: {
    fontSize: 30,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  subtitle: { fontSize: 16, opacity: 0.75 },

  rangeContainer: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  rangeRow: {
    flexDirection: 'row',
    backgroundColor: '#EAF7FB',
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  rangePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  rangePillActive: {
    backgroundColor: COLORS.aqua,
  },
  rangePillText: {
    fontSize: 14,
    opacity: 0.75,
  },
  rangePillTextActive: {
    opacity: 1,
    fontWeight: '700',
  },

  historyButton: {
    alignSelf: 'center',
    backgroundColor: COLORS.navy,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    marginTop: -4,
    marginBottom: 4,
  },
  historyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
    textAlign: 'center',
  },
  cardValue: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
    marginTop: 10,
    textAlign: 'center',
  },
  cardValueSmall: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    marginTop: 10,
    textAlign: 'center',
  },
  cardSub: {
    fontSize: 13,
    opacity: 0.65,
    marginTop: 6,
    textAlign: 'center',
  },

  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  chartTitle: { fontSize: 16, fontWeight: '700' },
  chartSubTitle: { fontSize: 13, opacity: 0.6 },

  chartArea: {
    height: 190,
    borderRadius: 14,
    backgroundColor: '#F7F8FB',
    position: 'relative',
    overflow: 'hidden',
  },
  gridH: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: '#E6EAF2',
  },
  gridV: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    width: 1,
    backgroundColor: '#E6EAF2',
  },
  barsRow: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 18,
    top: 28,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bar: {
    width: 12,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: '#0B0E1A',
    opacity: 0.9,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,14,26,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 40,
  },
  modalCard: {
    maxHeight: '90%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.ink,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 10,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F7F8FB',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E6EAF2',
  },
  workoutRowActive: {
    borderColor: COLORS.aqua,
    backgroundColor: '#EAF7FB',
  },
  workoutRowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  workoutRowSub: {
    fontSize: 13,
    opacity: 0.65,
    marginTop: 2,
  },
  workoutRowDistance: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailCard: {
    marginTop: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#F7F8FB',
    borderWidth: 1,
    borderColor: '#E6EAF2',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 7,
  },
  detailLabel: {
    fontSize: 14,
    opacity: 0.7,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  emptyState: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    opacity: 0.7,
  },
});