// app/(tabs)/progress.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useMemo, useState } from 'react';
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

type RangeKey = 'Week' | 'Month' | 'All';

const RANGE_LABEL: Record<RangeKey, string> = {
  Week: 'This Week',
  Month: 'This Month',
  All: 'All Time',
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

export default function ProgressScreen() {
  const [range, setRange] = useState<RangeKey>('Week');

  // Mock bars (same as your current)
  const bars = useMemo(() => [10, 22, 16, 28, 20, 32, 18, 26, 14, 24, 12, 30], []);

  return (
    <ImageBackground
      source={require('@/assets/images/rowing-background.png')}
      style={styles.bg}
      imageStyle={styles.bgImage}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={styles.screen}>
        {/* HEADER CARD (matches Home) */}
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

        {/* RANGE SELECTOR (same pill style as Home) */}
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

        {/* METRICS GRID (same card styling as Home) */}
        <View style={styles.grid}>
          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua }]} />
            <ThemedText style={styles.cardLabel}>📏 Total Distance</ThemedText>
            <ThemedText style={styles.cardValue}>0.0 km</ThemedText>
            <ThemedText style={styles.cardSub}>traveled</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua2 }]} />
            <ThemedText style={styles.cardLabel}>🚣 Total Sessions</ThemedText>
            <ThemedText style={styles.cardValue}>0</ThemedText>
            <ThemedText style={styles.cardSub}>completed</ThemedText>
          </ThemedView>
        </View>

        {/* CHART CARD (same card style + chart bg like Home) */}
        <ThemedView style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <ThemedText style={styles.chartTitle}>Distance Trend</ThemedText>
            <ThemedText style={styles.chartSubTitle}>{RANGE_LABEL[range]}</ThemedText>
          </View>

          <View style={styles.chartArea}>
            {/* Grid */}
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridH, { top: 18 + i * 36 }]} />
            ))}
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={`v-${i}`} style={[styles.gridV, { left: 18 + i * 62 }]} />
            ))}

            {/* Bars */}
            <View style={styles.barsRow}>
              {bars.map((h, idx) => (
                <View key={idx} style={[styles.bar, { height: 12 + h }]} />
              ))}
            </View>
          </View>
        </ThemedView>

        {/* SECONDARY STATS (same grid cards) */}
        <View style={styles.grid}>
          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.blue }]} />
            <ThemedText style={styles.cardLabel}>⚡ Best Power</ThemedText>
            <ThemedText style={styles.cardValue}>— W</ThemedText>
            <ThemedText style={styles.cardSub}>Peak output</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.coral }]} />
            <ThemedText style={styles.cardLabel}>🔁 Avg SPM</ThemedText>
            <ThemedText style={styles.cardValue}>—</ThemedText>
            <ThemedText style={styles.cardSub}>Stroke rate</ThemedText>
          </ThemedView>
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>
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

  // Header (copied style from your Home index)
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

  // Range selector (Home style)
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

  // Grid/cards (Home style)
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
  cardSub: {
    fontSize: 13,
    opacity: 0.65,
    marginTop: 6,
    textAlign: 'center',
  },

  // Chart card
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
});