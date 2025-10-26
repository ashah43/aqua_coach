// app/(tabs)/progress.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

const RangePill = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) => (
  <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
    <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>{label}</ThemedText>
  </Pressable>
);

export default function ProgressScreen() {
  const [range, setRange] = useState<'Week' | 'Month' | 'All'>('Week');
  const bars = [10, 22, 16, 28, 20, 32, 18, 26, 14, 24, 12, 30];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {/* Hero */}
      <ThemedView style={styles.hero}>
        <ThemedText type="title" style={styles.title}>Progress</ThemedText>
        <ThemedText style={styles.subtitle}>Track Your Rowing Performance</ThemedText>

        <View style={styles.pillsRow}>
          {(['Week', 'Month', 'All'] as const).map(p => (
            <RangePill key={p} label={p} active={range === p} onPress={() => setRange(p)} />
          ))}
        </View>
      </ThemedView>

      {/* Top stats */}
      <View style={styles.topRow}>
        <ThemedView style={styles.statCard}>
          <ThemedText style={styles.cardLabelTop}>Total Distance</ThemedText>
          <ThemedText style={styles.bigValue}>0.0 km</ThemedText>
          <ThemedText style={styles.cardLabelBottom}>0 m total</ThemedText>
        </ThemedView>

        <ThemedView style={styles.statCard}>
          <ThemedText style={styles.cardLabelTop}>Total Sessions</ThemedText>
          <ThemedText style={styles.bigValue}>0</ThemedText>
          <ThemedText style={styles.cardLabelBottom}>Workouts Completed</ThemedText>
        </ThemedView>
      </View>

      {/* Trend chart */}
      <ThemedView style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <ThemedText style={styles.chartTitle}>Distance Trend</ThemedText>
          <ThemedText style={styles.chartSubTitle}>
            {range === 'Week' ? 'This Week' : range === 'Month' ? 'This Month' : 'All Time'}
          </ThemedText>
        </View>

        <View style={styles.chartArea}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={`h-${i}`} style={[styles.gridH, { top: 18 + i * 36 }]} />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={`v-${i}`} style={[styles.gridV, { left: 18 + i * 62 }]} />
          ))}

          <View style={styles.barsRow}>
            {bars.map((h, idx) => (
              <View key={idx} style={[styles.bar, { height: 12 + h }]} />
            ))}
          </View>
        </View>
      </ThemedView>

      {/* Secondary stats */}
      <View style={styles.bottomRow}>
        <ThemedView style={styles.smallCard}>
          <ThemedText style={styles.smallLabel}>Best Power</ThemedText>
          <ThemedText style={styles.smallValue}>— W</ThemedText>
        </ThemedView>

        <ThemedView style={styles.smallCard}>
          <ThemedText style={styles.smallLabel}>Avg SPM</ThemedText>
          <ThemedText style={styles.smallValue}>—</ThemedText>
        </ThemedView>
      </View>
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
    paddingVertical: 20,         // +2 for a touch more air
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
  pillsRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9DDE4',
    backgroundColor: '#FFFFFF',
  },
  pillActive: { backgroundColor: '#0B0E1A', borderColor: '#0B0E1A' },
  pillText: { fontSize: 14, opacity: 0.85 },
  pillTextActive: { color: '#FFFFFF', fontWeight: '600', opacity: 1 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: R,
    paddingVertical: 20,         // +2
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

  // >>> Key change: lighter weight + explicit lineHeight + no negative letterSpacing
  bigValue: {
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 34,
    marginBottom: 6,
    letterSpacing: 0,
  },

  cardLabelBottom: { fontSize: 15, opacity: 0.6 },

  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: R,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EAF0',
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
    fontSize: 20,
    fontWeight: '600',   // lighter weight to avoid squish
    lineHeight: 24,
    letterSpacing: 0,
  },
});
