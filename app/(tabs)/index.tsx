// app/(tabs)/index.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
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

const MOCK_STATS: Record<
  RangeKey,
  { sessions: string; distance: string; avgTime: string; avgPower: string }
> = {
  day: { sessions: '2', distance: '6.1 km', avgTime: '28 m', avgPower: '228 W' },
  week: {
    sessions: '12',
    distance: '24.5 km',
    avgTime: '32 m',
    avgPower: '215 W',
  },
  month: {
    sessions: '41',
    distance: '92.3 km',
    avgTime: '30 m',
    avgPower: '221 W',
  },
};

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [range, setRange] = useState<RangeKey>('week');

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

  const meta = user?.user_metadata as any;
  const displayName = meta?.full_name || meta?.name || user?.email || '';

  const stats = MOCK_STATS[range];

  return (
    <ImageBackground
      source={require('@/assets/images/rowing-background.png')}
      style={styles.bg}
      imageStyle={styles.bgImage}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={styles.screen}>
        {/* HEADER CARD */}
        <ThemedView style={styles.header}>
          <View style={styles.headerTopRow}>
            <Image
              source={require('@/assets/images/aquacoach-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View>
              <ThemedText type="title" style={styles.title}>
                Dashboard
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Welcome back, {displayName}
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* RANGE SELECTOR — BELOW HEADER & CENTERED */}
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

        {/* METRICS GRID */}
        <View style={styles.grid}>
          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua }]} />
            <ThemedText style={styles.cardLabel}>🚣 Sessions</ThemedText>
            <ThemedText style={styles.cardValue}>{stats.sessions}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua2 }]} />
            <ThemedText style={styles.cardLabel}>📏 Distance</ThemedText>
            <ThemedText style={styles.cardValue}>{stats.distance}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.blue }]} />
            <ThemedText style={styles.cardLabel}>⏱️ Avg Time</ThemedText>
            <ThemedText style={styles.cardValue}>{stats.avgTime}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.coral }]} />
            <ThemedText style={styles.cardLabel}>⚡Avg Power</ThemedText>
            <ThemedText style={styles.cardValue}>{stats.avgPower}</ThemedText>
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
    gap: 14,
  },

  logo: {
    width: 100,
    height: 100,
  },

  title: {
    fontSize: 30,
    marginBottom: 4,
    letterSpacing: -0.2,
  },

  subtitle: {
    fontSize: 16,
    opacity: 0.75,
  },

  /* RANGE SELECTOR */
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

  /* GRID */
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
});