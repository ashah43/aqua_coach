// app/workout/ArduinoSession.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Buffer } from 'buffer';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx'; //npx expo install expo-bluetooth

import Svg, { Line, Path, Rect } from 'react-native-svg';

const manager = new BleManager();

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

/** Smooth SVG path */
function useSmoothPath(data: number[], width: number, height: number, padX = 16, padY = 16) {
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
            <Line
              key={`h-${i}`}
              x1={16}
              x2={WIDTH - 16}
              y1={16 + i * 36}
              y2={16 + i * 36}
              stroke="#E6EAF2"
              strokeWidth={1}
            />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <Line
              key={`v-${i}`}
              y1={16}
              y2={HEIGHT - 16}
              x1={16 + i * 64}
              x2={16 + i * 64}
              stroke="#E6EAF2"
              strokeWidth={1}
            />
          ))}
          <Path d={`${path} L ${WIDTH - 16} ${HEIGHT - 16} L ${16} ${HEIGHT - 16} Z`} fill="rgba(11,14,26,0.06)" />
          <Path d={path} stroke="#0B0E1A" strokeWidth={2.5} fill="none" />
        </Svg>
      </View>
    </ThemedView>
  );
}

export default function ArduinoSessionScreen() {
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

  // Acceleration series for chart
  const ACCEL_SAMPLES = 64;
  const [accelSeries, setAccelSeries] = useState<number[]>(Array(ACCEL_SAMPLES).fill(0));

  const [isRunning, setIsRunning] = useState(true);

  // --- Integration state ---
  const lastTsRef = useRef<number | null>(null);
  const vxRef = useRef(0);
  const vyRef = useRef(0);
  const sRef = useRef(0);

  // Stillness detector
  const stillAccumRef = useRef(0);

  // --- Tuning constants ---
  const SAMPLE_MS = 50; // 20 Hz
  const ACC_DEADBAND = 0.08;
  const DAMP = 0.92;
  const STILL_EPS = 0.06;
  const STILL_MS = 180;
  const MIN_SPEED = 0.12;
  const SCALE = 0.18;

  // --- Arduino BLE ---
  const [arduinoDevice, setArduinoDevice] = useState<Device | null>(null);
  const [accelData, setAccelData] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    // Scan & connect
    const scan = manager.startDeviceScan(null, null, (error, device) => {
      if (error) return;
      if (device?.name === 'Nano33BLE') {
        manager.stopDeviceScan();
        device.connect()
          .then((d) => d.discoverAllServicesAndCharacteristics())
          .then((d) => {
            setArduinoDevice(d);
            const serviceUUID = '180F';
            const charUUID = '2A19';
            d.monitorCharacteristicForService(serviceUUID, charUUID, (err, char) => {
              if (char?.value) {
                const decoded = Buffer.from(char.value, 'base64').toString('ascii');
                const [x, y, z] = decoded.split(',').map(Number);
                setAccelData({ x, y, z });
              }
            });
          });
      }
    });

    return () => {
      manager.stopDeviceScan();
    };
  }, []);

  // Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning) {
      const resumeStart = Date.now() - elapsedMs;
      interval = setInterval(() => setElapsedMs(Date.now() - resumeStart), 250);
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  // Integration & charts
  useEffect(() => {
    if (!isRunning) return;
    const tick = () => {
      const now = Date.now();
      if (lastTsRef.current == null) {
        lastTsRef.current = now;
        return;
      }
      const dt = (now - lastTsRef.current) / 1000;
      lastTsRef.current = now;
      if (dt <= 0 || dt > 0.25) return;

      let ax = accelData.x;
      let ay = accelData.y;

      // Deadband
      if (Math.abs(ax) < ACC_DEADBAND) ax = 0;
      if (Math.abs(ay) < ACC_DEADBAND) ay = 0;

      // Integrate
      vxRef.current += ax * dt;
      vyRef.current += ay * dt;

      vxRef.current *= DAMP;
      vyRef.current *= DAMP;

      // Zero velocity update
      const aMag = Math.hypot(ax, ay);
      if (aMag < STILL_EPS) {
        stillAccumRef.current += dt * 1000;
        if (stillAccumRef.current >= STILL_MS) {
          vxRef.current = 0;
          vyRef.current = 0;
        }
      } else stillAccumRef.current = 0;

      // Speed floor
      let speed = Math.hypot(vxRef.current, vyRef.current);
      if (speed < MIN_SPEED) speed = 0;

      // Distance
      sRef.current += speed * dt * SCALE;
      setDistanceM(sRef.current);

      // Update chart
      setAccelSeries((prev) => {
        const next = prev.slice(1);
        next.push(Math.hypot(ax, ay, accelData.z));
        return next;
      });
      setAccelMag(Math.hypot(ax, ay, accelData.z));
    };

    const interval = setInterval(tick, SAMPLE_MS);
    return () => clearInterval(interval);
  }, [isRunning, accelData]);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const distanceText = `${distanceM.toFixed(1)}m`;

  const splitText = useMemo(() => {
    if (!showSplit) return '';
    if (distanceM < 1 || elapsedSec === 0) return '—';
    const paceSecPer500 = (elapsedMs / 1000) * (500 / distanceM);
    const mm = Math.floor(paceSecPer500 / 60);
    const ss = Math.floor(paceSecPer500 % 60).toString().padStart(2, '0');
    return `${mm}:${ss} /500m`;
  }, [showSplit, distanceM, elapsedMs, elapsedSec]);

  const powerCurve = [6, 10, 18, 26, 20, 14, 10, 22, 30, 20, 12, 18, 14, 26, 24];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.backArrow}>‹</ThemedText>
          </Pressable>
          <ThemedText type="subtitle" style={styles.topTitle} />
          <Pressable
            style={[styles.chartBtn, !isRunning && { backgroundColor: '#F3F3F3' }]}
            onPress={() => setIsRunning((prev) => !prev)}
          >
            <ThemedText style={styles.chartBtnText}>{isRunning ? 'Pause' : 'Resume'}</ThemedText>
          </Pressable>
        </View>

        <View style={styles.divider} />

        {/* Pills */}
        <View style={styles.controlsWrap}>
          <Pill label={(showSplit ? '✓ ' : '👁️ ') + 'Split'} active={showSplit} onPress={() => setShowSplit(v => !v)} />
          <Pill label={(showAvgPower ? '✓ ' : '👁️ ') + 'Avg Power'} active={showAvgPower} onPress={() => setShowAvgPower(v => !v)} />
          <Pill label={(showAccelGraph ? '✓ ' : '👁️ ') + 'Acceleration'} active={showAccelGraph} onPress={() => setShowAccelGraph(v => !v)} />
          <Pill label={(showPowerGraph ? '✓ ' : '👁️ ') + 'Power'} active={showPowerGraph} onPress={() => setShowPowerGraph(v => !v)} />
        </View>

        {/* Metrics */}
        <View style={styles.metricsRow}>
          <ThemedView style={styles.metricCardSm}>
            <ThemedText style={styles.metricLabelSm}>Time</ThemedText>
            <ThemedText style={styles.metricValueSm}>{`${Math.floor(elapsedSec / 60)}:${(elapsedSec % 60).toString().padStart(2, '0')}`}</ThemedText>
            <View style={styles.progressBarTrackSm}><View style={[styles.progressBarFill, { width: '100%' }]} /></View>
          </ThemedView>

          <ThemedView style={styles.metricCardSm}>
            <ThemedText style={styles.metricLabelSm}>Distance</ThemedText>
            <ThemedText style={styles.metricValueSm}>{distanceText}</ThemedText>
            <View style={styles.progressBarTrackSm}><View style={[styles.progressBarFill, { width: '100%' }]} /></View>
          </ThemedView>
        </View>

        <View style={styles.metricsRow}>
          {showSplit && (
            <ThemedView style={styles.metricCardSm}>
              <ThemedText style={styles.metricLabelSm}>Split (per 500m)</ThemedText>
              <ThemedText style={styles.metricValueSm}>{splitText}</ThemedText>
              <View style={styles.progressBarTrackSm}><View style={[styles.progressBarFill, { width: '100%' }]} /></View>
            </ThemedView>
          )}
          {showAccelGraph && (
            <ThemedView style={styles.metricCardSm}>
              <ThemedText style={styles.metricLabelSm}>Acceleration</ThemedText>
              <ThemedText style={styles.metricValueSm}>{accelMag.toFixed(2)} m/s²</ThemedText>
              <View style={styles.progressBarTrackSm}>
                <View style={[styles.progressBarFill, { width: `${Math.min(accelMag * 10, 100)}%` }]} />
              </View>
            </ThemedView>
          )}
        </View>

        <View style={styles.metricsRow}>
          {showAvgPower && (
            <ThemedView style={styles.metricCardSm}>
              <ThemedText style={styles.metricLabelSm}>Average Power</ThemedText>
              <ThemedText style={styles.metricValueSm}>215 W</ThemedText>
              <View style={styles.progressBarTrackSm}><View style={[styles.progressBarFill, { width: '65%' }]} /></View>
            </ThemedView>
          )}
        </View>

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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backArrow: { fontSize: 30, marginRight: 6, lineHeight: 30 },
  topTitle: { flex: 1, textAlign: 'left', marginLeft: 6, fontSize: 20 },
  chartBtn: { borderWidth: 1, borderColor: '#D9DCE3', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  chartBtnText: { fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#ECEEF3' },
  controlsWrap: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4, marginBottom: 6 },
  pill: { minWidth: 70, alignItems: 'center', borderWidth: 1, borderColor: '#D9DCE3', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FFFFFF' },
  pillActive: { backgroundColor: '#0B0E1A', borderColor: '#0B0E1A' },
  pillText: { fontSize: 12, opacity: 0.9 },
  pillTextActive: { color: '#FFFFFF', opacity: 1, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', columnGap: 12 },
  metricCardSm: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: R, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E8EAF0', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  metricLabelSm: { fontSize: 13, opacity: 0.6, marginBottom: 6 },
  metricValueSm: { fontSize: 24, fontWeight: '600', marginBottom: 10, lineHeight: 26 },
  progressBarTrackSm: { height: 5, borderRadius: 999, backgroundColor: '#E9ECF2', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 999, backgroundColor: '#0B0E1A', opacity: 0.9 },
  chartCard: { backgroundColor: '#FFFFFF', borderRadius: R, padding: 14, borderWidth: 1, borderColor: '#E8EAF0', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  chartTitle: { textAlign: 'center', fontSize: 16, marginBottom: 12, fontWeight: '600' },
  chartArea: { height: 180, borderRadius: 14, overflow: 'hidden' },
});
