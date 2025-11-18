// app/workout/session.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Stack, useRouter } from 'expo-router';
import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';
import { useEffect, useMemo, useRef, useState } from 'react';
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
    <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>{label}</ThemedText>
  </Pressable>
);

/** Build a smooth-ish SVG path from a small array of numbers */
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
    const range = Math.max(1e-6, max - min);

    const xs: number[] = [];
    const ys: number[] = [];
    const stepX = w / Math.max(1, data.length - 1);

    data.forEach((v, i) => {
      xs.push(padX + i * stepX);
      ys.push(padY + (1 - (v - min) / range) * h);
    });

    let d = `M ${xs[0]} ${ys[0]}`;
    for (let i = 0; i < xs.length - 1; i++) {
      const xMid = (xs[i] + xs[i + 1]) / 2;
      const yMid = (ys[i] + ys[i + 1]) / 2;
      d += ` Q ${xs[i]} ${ys[i]} ${xMid} ${yMid}`;
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
          {[0, 1, 2, 3].map((i) => (
            <Line key={`h-${i}`} x1={16} x2={WIDTH - 16} y1={16 + i * 36} y2={16 + i * 36} stroke="#E6EAF2" strokeWidth={1} />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
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

  // UI toggles
  const [showPowerGraph, setShowPowerGraph] = useState(true);
  const [showAccelGraph, setShowAccelGraph] = useState(true);
  const [showSplit, setShowSplit] = useState(true);
  const [showAvgPower, setShowAvgPower] = useState(true);

  // Live metrics
  const [distanceM, setDistanceM] = useState(0);
  const [accelMag, setAccelMag] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Realtime acceleration series (forward/back axis) for the chart
  const ACCEL_SAMPLES = 64;
  const [accelSeries, setAccelSeries] = useState<number[]>(
    Array(ACCEL_SAMPLES).fill(0)
  );

  // Start “running” when this screen opens (since you navigate here from Start)
  const [isRunning, setIsRunning] = useState(true);


  // --- Integration state ---
  const lastTsRef = useRef<number | null>(null);
  const vxRef = useRef(0);
  const vyRef = useRef(0);
  const sRef = useRef(0);
  const startMsRef = useRef<number | null>(null);

  // Low-pass state
  const axLpRef = useRef(0);
  const ayLpRef = useRef(0);

  // Stillness detector
  const stillAccumRef = useRef(0);

  // --- Tuning constants (adjust to taste) ---
  const SAMPLE_MS = 50;           // 20 Hz
  const ACC_DEADBAND = 0.08;      // m/s^2 ignore tiny accel
  const LPF_ALPHA = 0.85;         // low-pass smoothing (higher = smoother)
  const DAMP = 0.92;              // velocity decay
  const STILL_EPS = 0.06;         // "quiet enough" accel
  const STILL_MS = 180;           // ms quiet before zeroing velocity
  const MIN_SPEED = 0.12;         // m/s floor for speed
  const SCALE = 0.18;             // convert speed→meters (feel/calibration)

  // Permissions (iOS)
  async function ensureMotionPermission() {
    const { status } = await DeviceMotion.getPermissionsAsync();
    if (status !== 'granted') {
      const res = await DeviceMotion.requestPermissionsAsync();
      if (res.status !== 'granted') throw new Error('Motion permission not granted');
    }
  }

  // Simple elapsed timer
  // ✅ Improved timer that pauses/resumes without resetting
useEffect(() => {
  let interval: ReturnType<typeof setInterval> | null = null;


  if (isRunning) {
    // Resume timing — keep previous elapsed
    const resumeStart = Date.now() - elapsedMs;
    interval = setInterval(() => {
      setElapsedMs(Date.now() - resumeStart);
    }, 250);
  }

  return () => {
    if (interval) clearInterval(interval);
  };
}, [isRunning]);


  // DeviceMotion listener with smoothing, deadband, ZUPT, damping, scaling
  useEffect(() => {
    if (!isRunning) return;

    let removed = false;

    (async () => {
      try {
        await ensureMotionPermission();
      } catch {
        return;
      }

      DeviceMotion.setUpdateInterval(SAMPLE_MS);

      const sub = DeviceMotion.addListener((evt: DeviceMotionMeasurement) => {
        if (removed) return;

        const a = evt.acceleration ?? evt.accelerationIncludingGravity ?? { x: 0, y: 0, z: 0 };
        let ax = a.x ?? 0;
        let ay = a.y ?? 0;

        // Compute magnitude (absolute acceleration intensity)
        const mag = Math.sqrt(ax * ax + ay * ay + (a.z ?? 0) ** 2);
        setAccelMag(mag);


        const now = Date.now();
        if (lastTsRef.current == null) {
          lastTsRef.current = now;
          return;
        }
        let dt = (now - lastTsRef.current) / 1000;
        lastTsRef.current = now;

        if (dt <= 0 || dt > 0.25) return; // ignore weird gaps

        // 1) Low-pass accel
        axLpRef.current = LPF_ALPHA * axLpRef.current + (1 - LPF_ALPHA) * ax;
        ayLpRef.current = LPF_ALPHA * ayLpRef.current + (1 - LPF_ALPHA) * ay;
        ax = axLpRef.current;
        ay = ayLpRef.current;

        // 2) Deadband tiny motions
        if (Math.abs(ax) < ACC_DEADBAND) ax = 0;
        if (Math.abs(ay) < ACC_DEADBAND) ay = 0;

        // 3) Integrate accel → velocity
        vxRef.current += ax * dt;
        vyRef.current += ay * dt;

        // 4) Damping
        vxRef.current *= DAMP;
        vyRef.current *= DAMP;

        // 5) Zero-velocity update when still
        const aMag = Math.hypot(ax, ay);
        if (aMag < STILL_EPS) {
          stillAccumRef.current += dt * 1000;
          if (stillAccumRef.current >= STILL_MS) {
            vxRef.current = 0;
            vyRef.current = 0;
          }
        } else {
          stillAccumRef.current = 0;
        }

        // Speed with floor
        let speed = Math.hypot(vxRef.current, vyRef.current);
        if (speed < MIN_SPEED) speed = 0;

        // 6) Integrate speed → distance with scale
        sRef.current += speed * dt * SCALE;
        setDistanceM(sRef.current);

        // Update acceleration chart (use forward/back signed accel)
        setAccelSeries((prev) => {
          const next = prev.slice(1);
          next.push(mag); // show fore-aft accel; swap to aMag if you prefer magnitude - swapped to mag
          return next;
        });
      });

      return () => {
        removed = true;
        sub.remove();
      };
    })();

    return () => {
      removed = true;
    };
  }, [isRunning]);

  // Derived UI text
  const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const distanceText = `${distanceM.toFixed(1)}m`;

  const splitText = useMemo(() => {
    if (!showSplit) return '';
    if (distanceM < 1 || elapsedMs === 0) return '—';

    const paceSecPer500 = (elapsedMs / 1000) * (500 / distanceM);
    const mm = Math.floor(paceSecPer500 / 60);
    const ss = Math.floor(paceSecPer500 % 60).toString().padStart(2, '0');

    return `${mm}:${ss} /500m`;
  }, [showSplit, distanceM, elapsedMs]);


  // Placeholder power curve (kept)
  const powerCurve = [6, 10, 18, 26, 20, 14, 10, 22, 30, 20, 12, 18, 14, 26, 24];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.screen}>
        {/* Top bar */}
          <View style={styles.topBar}>
    <Pressable onPress={() => router.back()} hitSlop={12}>
      <ThemedText style={styles.backArrow}>‹</ThemedText>
    </Pressable>
    <ThemedText type="subtitle" style={styles.topTitle} />
    <Pressable
      style={[styles.chartBtn, !isRunning && { backgroundColor: '#F3F3F3' }]}
      onPress={() => setIsRunning((prev) => !prev)}
    >
      <ThemedText style={styles.chartBtnText}>
        {isRunning ? 'Pause' : 'Resume'}
      </ThemedText>
    </Pressable>
  </View>


        <View style={styles.divider} />

{/* Pills */}
<View style={styles.controlsWrap}>
  <Pill
    label={(showSplit ? '✓ ' : '👁️ ') + 'Split'}
    active={showSplit}
    onPress={() => setShowSplit((v) => !v)}
  />
  <Pill
    label={(showAvgPower ? '✓ ' : '👁️ ') + 'Avg Power'}
    active={showAvgPower}
    onPress={() => setShowAvgPower((v) => !v)}
  />
  <Pill
    label={(showAccelGraph ? '✓ ' : '👁️ ') + 'Acceleration'}
    active={showAccelGraph}
    onPress={() => setShowAccelGraph((v) => !v)}
  />
  <Pill
    label={(showPowerGraph ? '✓ ' : '👁️ ') + 'Power'}
    active={showPowerGraph}
    onPress={() => setShowPowerGraph((v) => !v)}
  />
</View>

{/* Metrics */}
<View style={styles.metricsRow}>
  {/* Row 1 — Time + Distance */}
  <ThemedView style={styles.metricCardSm}>
    <ThemedText style={styles.metricLabelSm}>Time</ThemedText>
    <ThemedText style={styles.metricValueSm}>
      {`${Math.floor(elapsedSec / 60)}:${(elapsedSec % 60)
        .toString()
        .padStart(2, '0')}`}
    </ThemedText>
    <View style={styles.progressBarTrackSm}>
      <View style={[styles.progressBarFill, { width: '100%' }]} />
    </View>
  </ThemedView>

  <ThemedView style={styles.metricCardSm}>
    <ThemedText style={styles.metricLabelSm}>Distance</ThemedText>
    <ThemedText style={styles.metricValueSm}>{distanceText}</ThemedText>
    <View style={styles.progressBarTrackSm}>
      <View style={[styles.progressBarFill, { width: '100%' }]} />
    </View>
  </ThemedView>
</View>

{/* Row 2 — Split + Acceleration */}
<View style={styles.metricsRow}>
  {showSplit && (
    <ThemedView style={styles.metricCardSm}>
      <ThemedText style={styles.metricLabelSm}>Split (per 500m)</ThemedText>
      <ThemedText style={styles.metricValueSm}>{splitText}</ThemedText>
      <View style={styles.progressBarTrackSm}>
        <View style={[styles.progressBarFill, { width: '100%' }]} />
      </View>
    </ThemedView>
  )}

  {showAccelGraph && (
    <ThemedView style={styles.metricCardSm}>
      <ThemedText style={styles.metricLabelSm}>Acceleration</ThemedText>
      <ThemedText style={styles.metricValueSm}>
        {accelMag.toFixed(2)} m/s²
      </ThemedText>
      <View style={styles.progressBarTrackSm}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${Math.min(accelMag * 10, 100)}%` },
          ]}
        />
      </View>
    </ThemedView>
  )}
</View>

{/* Row 3 — Average Power */}
<View style={styles.metricsRow}>
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

        {/* Live charts */}
        {showAccelGraph && <CurveChart title="Acceleration Over Time" data={accelSeries} />}
        {showPowerGraph && <CurveChart title="Power Over Time" data={powerCurve} />}

        <View style={{ height: 28 }} />
      </ScrollView>
    </>
  );
}

const R = 18;

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30, rowGap: 8 },

  // top bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backArrow: { fontSize: 30, marginRight: 6, lineHeight: 30 },
  topTitle: { flex: 1, textAlign: 'left', marginLeft: 6, fontSize: 20 },
  chartBtn: { borderWidth: 1, borderColor: '#D9DCE3', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  chartBtnText: { fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#ECEEF3' },

  // pills
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  pillActive: { backgroundColor: '#0B0E1A', borderColor: '#0B0E1A' },
  pillText: { fontSize: 12, opacity: 0.9 },
  pillTextActive: { color: '#FFFFFF', opacity: 1, fontWeight: '600' },

  // metrics
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', columnGap: 12 },
  metricCardSm: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: R,
    paddingVertical: 12,
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
  progressBarTrackSm: { height: 5, borderRadius: 999, backgroundColor: '#E9ECF2', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 999, backgroundColor: '#0B0E1A', opacity: 0.9 },

  // charts
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
