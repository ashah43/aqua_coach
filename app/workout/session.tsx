// app/workout/session.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

const Pill = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) => (
  <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
    <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>
      {label}
    </ThemedText>
  </Pressable>
);

/** Simple smooth curve (quadratic) builder for placeholder data */
function useSmoothPath(
  data: number[],
  width: number,
  height: number,
  padX = 16,
  padY = 16
) {
  return useMemo(() => {
    if (!data.length) return '';
    const w = width - padX * 2;
    const h = height - padY * 2;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = Math.max(1, max - min);

    const xs: number[] = [];
    const ys: number[] = [];
    const stepX = w / (data.length - 1);

    data.forEach((v, i) => {
      xs.push(padX + i * stepX);
      ys.push(padY + (1 - (v - min) / range) * h); // invert so bigger values are higher
    });

    let d = `M ${xs[0]} ${ys[0]}`;
    for (let i = 0; i < xs.length - 1; i++) {
      const x_mid = (xs[i] + xs[i + 1]) / 2;
      const y_mid = (ys[i] + ys[i + 1]) / 2;
      d += ` Q ${xs[i]} ${ys[i]} ${x_mid} ${y_mid}`;
    }
    d += ` T ${xs[xs.length - 1]} ${ys[ys.length - 1]}`;
    return d;
  }, [data, width, height, padX, padY]);
}

function CurveChart({ title, data }: { title: string; data: number[] }) {
  const WIDTH = 320;
  const HEIGHT = 180;
  const path = useSmoothPath(data, WIDTH, HEIGHT);

  return (
    <ThemedView style={styles.chartCard}>
      <ThemedText style={styles.chartTitle}>{title}</ThemedText>
      <View style={styles.chartArea}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          <Rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={12} fill="#F7F8FB" />
          {[0, 1, 2, 3].map(i => (
            <Line key={`h-${i}`} x1={16} x2={WIDTH - 16} y1={16 + i * 36} y2={16 + i * 36} stroke="#E6EAF2" strokeWidth={1} />
          ))}
          {[0, 1, 2, 3, 4].map(i => (
            <Line key={`v-${i}`} y1={16} y2={HEIGHT - 16} x1={16 + i * 64} x2={16 + i * 64} stroke="#E6EAF2" strokeWidth={1} />
          ))}
          <Path d={`${path} L ${WIDTH - 16} ${HEIGHT - 16} L ${16} ${HEIGHT - 16} Z`} fill="rgba(11,14,26,0.06)" />
          <Path d={path} stroke="#0B0E1A" strokeWidth={2.5} fill="none" />
        </Svg>
      </View>
    </ThemedView>
  );
}

export default function WorkoutSessionScreen() {
  const router = useRouter();

  // Existing toggles (kept)
  const [showPower, setShowPower] = useState(false);
  const [showRate, setShowRate] = useState(false);

  // Required/visible options
  const [showSplit, setShowSplit] = useState(true);
  const [showAvgPower, setShowAvgPower] = useState(true);
  const [showAccelGraph, setShowAccelGraph] = useState(true);
  const [showPowerGraph, setShowPowerGraph] = useState(true);

  // Placeholder curve data
  const accelCurve = [2, 8, 22, 34, 12, 3, 2, 2, 18, 28, 35, 14, 4, 3, 2];
  const powerCurve = [6, 10, 18, 26, 20, 14, 10, 22, 30, 20, 12, 18, 14, 26, 24];

  return (
    <>
      {/* Hide Expo Router header just for this screen */}
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.screen}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.backArrow}>‹</ThemedText>
          </Pressable>
          <ThemedText type="subtitle" style={styles.topTitle} />
          <Pressable style={styles.chartBtn}>
            <ThemedText style={styles.chartBtnText}>Chart</ThemedText>
          </Pressable>
        </View>

        <View style={styles.divider} />

        {/* SMALL controls now at the very top */}
        <View style={styles.controlsWrap}>
          <Pill
            label={(showSplit ? '✓ ' : '👁️ ') + 'Split'}
            active={showSplit}
            onPress={() => setShowSplit(v => !v)}
          />
          <Pill
            label={(showAvgPower ? '✓ ' : '👁️ ') + 'Avg Power'}
            active={showAvgPower}
            onPress={() => setShowAvgPower(v => !v)}
          />
          <Pill
            label={(showAccelGraph ? '✓ ' : '👁️ ') + 'Acceleration'}
            active={showAccelGraph}
            onPress={() => setShowAccelGraph(v => !v)}
          />
          <Pill
            label={(showPowerGraph ? '✓ ' : '👁️ ') + 'Power'}
            active={showPowerGraph}
            onPress={() => setShowPowerGraph(v => !v)}
          />
        </View>

        {/* Smaller metric cards */}
        <View style={styles.metricsRow}>
          <ThemedView style={styles.metricCardSm}>
            <ThemedText style={styles.metricLabelSm}>Time</ThemedText>
            <ThemedText style={styles.metricValueSm}>0:00</ThemedText>
            <View style={styles.progressBarTrackSm}>
              <View style={[styles.progressBarFill, { width: '0%' }]} />
            </View>
          </ThemedView>

          <ThemedView style={styles.metricCardSm}>
            <ThemedText style={styles.metricLabelSm}>Distance</ThemedText>
            <ThemedText style={styles.metricValueSm}>0m</ThemedText>
            <View style={styles.progressBarTrackSm}>
              <View style={[styles.progressBarFill, { width: '0%' }]} />
            </View>
          </ThemedView>
        </View>

        <View style={styles.metricsRow}>
          {showSplit && (
            <ThemedView style={styles.metricCardSm}>
              <ThemedText style={styles.metricLabelSm}>Split (per 500m)</ThemedText>
              <ThemedText style={styles.metricValueSm}>2:05 /500m</ThemedText>
              <View style={styles.progressBarTrackSm}>
                <View style={[styles.progressBarFill, { width: '42%' }]} />
              </View>
            </ThemedView>
          )}

          {showAvgPower && (
            <ThemedView style={styles.metricCardSm}>
              <ThemedText style={styles.metricLabelSm}>Average Power</ThemedText>
              <ThemedText style={styles.metricValueSm}>215 W</ThemedText>
              <View style={styles.progressBarTrackSm}>
                <View style={[styles.progressBarFill, { width: '65%' }]} />
              </View>
            </ThemedView>
          )}
        </View>

        {/* Curved charts */}
        {showAccelGraph && <CurveChart title="Acceleration Over Time" data={accelCurve} />}
        {showPowerGraph && <CurveChart title="Power Over Time" data={powerCurve} />}

        <View style={{ height: 28 }} />
      </ScrollView>
    </>
  );
}

const R = 18;

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    rowGap: 8,
  },

  // top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backArrow: { fontSize: 30, marginRight: 6, lineHeight: 30 },
  topTitle: { flex: 1, textAlign: 'left', marginLeft: 6, fontSize: 20 },
  chartBtn: {
    borderWidth: 1,
    borderColor: '#D9DCE3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  chartBtnText: { fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#ECEEF3' },

  // SMALLER top controls
  controlsWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 6,
  },
  pill: {
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9DCE3',
    paddingVertical: 6,     // smaller
    paddingHorizontal: 10,  // smaller
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  pillActive: { backgroundColor: '#0B0E1A', borderColor: '#0B0E1A' },
  pillText: { fontSize: 12, opacity: 0.9 },          // smaller text
  pillTextActive: { color: '#FFFFFF', opacity: 1, fontWeight: '600' },

  // METRICS — smaller version
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  metricCardSm: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: R,
    paddingVertical: 12,  // smaller
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  metricLabelSm: { fontSize: 13, opacity: 0.6, marginBottom: 6 },
  metricValueSm: { fontSize: 24, fontWeight: '600', marginBottom: 10, lineHeight: 26 },
  progressBarTrackSm: {
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E9ECF2',
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 999, backgroundColor: '#0B0E1A', opacity: 0.9 },

  // CHARTS
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: R,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  chartTitle: { textAlign: 'center', fontSize: 16, marginBottom: 12, fontWeight: '600' },
  chartArea: { height: 180, borderRadius: 14, overflow: 'hidden' },
});
