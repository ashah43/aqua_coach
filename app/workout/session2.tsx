// app/workout/session.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Buffer } from 'buffer';
import { Stack, useRouter } from 'expo-router';
import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path, Rect } from 'react-native-svg';

//adding pacer audio


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
    const range = Math.max(1e-3, max - min);

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


/*unction CurveChart({ title, data }: { title: string; data: number[] }) {
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
*/

function CurveChart({ title, data, baseline }: { title: string; data: number[]; baseline?: number[] }) {
  const WIDTH = 320;
  const HEIGHT = 180;
  const path = useSmoothPath(data, WIDTH, HEIGHT);
  const baselinePath = baseline ? useSmoothPath(baseline, WIDTH, HEIGHT) : '';

  return (
    <ThemedView style={styles.chartCard}>
      <ThemedText style={styles.chartTitle}>{title}</ThemedText>
      <View style={styles.chartArea}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          <Rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={12} fill="#F7F8FB" />
          {[0, 1, 2, 3].map((i) => (
            <Line key={`h-${i}`} x1={16} x2={WIDTH - 16} y1={16 + i * 36} y2={16 + i * 36} stroke="#E6EAF2" strokeWidth={1} />
          ))}
          {/* Vertical grid lines: 1-second intervals (40 samples = 4 seconds, so 10 samples per second, 72px per second) */}
          {[0, 1, 2, 3, 4].map((i) => (
            <Line key={`v-${i}`} y1={16} y2={HEIGHT - 16} x1={16 + i * 72} x2={16 + i * 72} stroke="#E6EAF2" strokeWidth={1} />
          ))}

          {/* baseline first */}
          {baseline && <Path d={baselinePath} stroke="rgba(200,0,0,0.3)" strokeWidth={2} fill="none" />}

          {/* live data */}
          <Path d={`${path} L ${WIDTH - 16} ${HEIGHT - 16} L ${16} ${HEIGHT - 16} Z`} fill="rgba(11,14,26,0.06)" />
          <Path d={path} stroke="#0B0E1A" strokeWidth={2.5} fill="none" />
        </Svg>
      </View>
    </ThemedView>
  );
}




export default function WorkoutSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // UI toggles
  const [showPowerGraph, setShowPowerGraph] = useState(true);
  const [showAccelGraph, setShowAccelGraph] = useState(true);
  const [showSplit, setShowSplit] = useState(true);
  const [showAvgPower, setShowAvgPower] = useState(true);


  //adding UI toggle for selecting a pace you want to workout at
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [selectedSplit, setSelectedSplit] = useState('2:00'); // default


  // Live metrics
  const [distanceM, setDistanceM] = useState(0);
  const [accelMag, setAccelMag] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [power, setPower] = useState(0); // new: BLE power output

  // Realtime acceleration series (forward/back axis) for the chart
  // 40 samples × 100ms = 4 seconds (enough to show a complete rowing stroke at slower speeds)
  const ACCEL_SAMPLES = 40;
  const [accelSeries, setAccelSeries] = useState<number[]>(
    Array(ACCEL_SAMPLES).fill(0)
  );

  //realtime power
  const POWER_SAMPLES = 40;
  const [powerSeries, setPowerSeries] = useState<number[]>(Array(POWER_SAMPLES).fill(0));

  // Baseline stroke curve (ideal acceleration for current pace)
const [baselineSeries, setBaselineSeries] = useState<number[]>(Array(ACCEL_SAMPLES).fill(0));

// Generate ideal baseline based on pace
// Define the ideal curves per pace
const idealCurves: { pace: string; strokeRate: number; manpower: number }[] = [
  { pace: '2:00', strokeRate: 30, manpower: 350 },
  { pace: '2:30', strokeRate: 25, manpower: 300 },
  { pace: '3:00', strokeRate: 20, manpower: 250 },
];

//pacer
const [isPacerOn, setIsPacerOn] = useState(false);
const pacerIntervalRef = useRef<number | null>(null);


/*
//adding a pacer function
async function playTick() {
  try {
    // small haptic (never fails)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // optional: beep sound
    const { sound } = await Audio.Sound.createAsync(
      require('@/assets/pacer-beep.wav')
    );
    await sound.playAsync();
    setTimeout(() => sound.unloadAsync(), 500);
  } catch (err) {
    console.log("Pacer error:", err);
  }
}
  */

// Generate ideal acceleration curve from stroke rate
function generateIdealCurve(strokeRate: number, samples: number = 40): number[] {
  const curve: number[] = [];
  const strokeDuration = 60 / strokeRate; // seconds per stroke
  const samplesPerStroke = (strokeDuration / 4) * samples; // quarter strokes for phases

  for (let i = 0; i < samples; i++) {
    const positionInStroke = (i % samplesPerStroke) / samplesPerStroke;

    if (positionInStroke < 0.25) {
      const t = positionInStroke / 0.25;
      curve.push(0.3 + 2.2 * t * t); // acceleration ramps up
    } else if (positionInStroke < 0.35) {
      curve.push(2.8); // peak
    } else if (positionInStroke < 0.5) {
      const t = (positionInStroke - 0.35) / 0.15;
      curve.push(2.8 - 2.0 * t); // deceleration
    } else if (positionInStroke < 0.6) {
      const t = (positionInStroke - 0.5) / 0.1;
      curve.push(0.8 - 1.2 * t); // follow-through
    } else {
      const t = (positionInStroke - 0.6) / 0.4;
      curve.push(-0.4 - 0.3 * t); // recovery
    }
  }

  return curve;
}

// Hook to update baselineSeries whenever the pace changes
useEffect(() => {
  const paceObj = idealCurves.find((c) => c.pace === selectedSplit);
  if (!paceObj) return;

  const newBaseline = generateIdealCurve(paceObj.strokeRate, ACCEL_SAMPLES);
  setBaselineSeries(newBaseline);
}, [selectedSplit]);


//Hook to start and stop the metronome
useEffect(() => {
  if (!isPacerOn) {
    if (pacerIntervalRef.current) clearInterval(pacerIntervalRef.current);
    pacerIntervalRef.current = null;
    return;
  }

  const paceObj = idealCurves.find(p => p.pace === selectedSplit);
  if (!paceObj) return;

  const intervalMs = 60000 / paceObj.strokeRate; // ms per stroke

  /*if (pacerIntervalRef.current) clearInterval(pacerIntervalRef.current);
  pacerIntervalRef.current = setInterval(() => {
    playTick();
  }, intervalMs);
*/
  return () => {
    if (pacerIntervalRef.current) clearInterval(pacerIntervalRef.current);
    pacerIntervalRef.current = null;
  };
}, [isPacerOn, selectedSplit]);


  useEffect(() => {
    setPowerSeries((prev) => {
      const next = prev.slice(1);
      next.push(power); // add latest power reading
      return next;
    });
  }, [power]);

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
  const SAMPLE_MS = 100;           // 20 Hz
  const ACC_DEADBAND = 0.08;      // m/s^2 ignore tiny accel
  const LPF_ALPHA = 0.85;         // low-pass smoothing (higher = smoother)
  const DAMP = 0.92;              // velocity decay
  const STILL_EPS = 0.06;         // "quiet enough" accel
  const STILL_MS = 180;           // ms quiet before zeroing velocity
  const MIN_SPEED = 0.12;         // m/s floor for speed
  const SCALE = 0.18;             // convert speed→meters (feel/calibration)

 
  // --- Arduino BLE ---
  // Device connection is optional - workout can proceed without it
  const [arduinoDevice, setArduinoDevice] = useState<Device | null>(null);
  const [bleStatus, setBleStatus] = useState<string>('No device connected');
  
  useEffect(() => {
    const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
    const CHAR_UUID = 'abcdefab-cdef-1234-5678-1234567890ab';

    // Check for already connected devices (optional - workout works without it)
    manager.connectedDevices([SERVICE_UUID])
      .then((devices: Device[]) => {
        if (devices.length > 0) {
          console.log('Found already connected device:', devices[0].name);
          const device = devices[0];
          setArduinoDevice(device);
          setBleStatus('Connected! Listening...');
          
          // Start monitoring
          device.monitorCharacteristicForService(
            SERVICE_UUID,
            CHAR_UUID,
            (err: any, char: any) => {
              if (err) {
                console.log('Notify error:', err);
                return;
              }

              if (!char?.value) return;

              const data = Buffer.from(char.value, 'base64');
              const newPower = data.readUInt16LE(0);

              console.log('Power:', newPower);
              setPower(newPower);
            }
          );
        } else {
          // No device connected - workout can continue without it
          console.log('No device connected - workout will proceed without BLE data');
          setBleStatus('No device connected');
          setArduinoDevice(null);
        }
      })
      .catch((err: any) => {
        console.log('Error checking connected devices:', err);
        setBleStatus('No device connected');
        // Continue without device - don't block the workout
      });

    return () => {
      manager.stopDeviceScan();
    };
  }, []);

  // Permissions (iOS)
  async function ensureMotionPermission() {
    const { status } = await DeviceMotion.getPermissionsAsync();
    if (status !== 'granted') {
      const res = await DeviceMotion.requestPermissionsAsync();
      if (res.status !== 'granted') throw new Error('Motion permission not granted');
    }
  }




  // Simple elapsed timer
  // Improved timer that pauses/resumes without resetting
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
    if (distanceM < 1 || elapsedSec === 0) return '—';
    // Calculate split: time per 500m
    const paceSecPer500 = elapsedSec * (500 / distanceM);
    // Cap at reasonable maximum (10:00 per 500m) to avoid showing unrealistic values
    const cappedPace = Math.min(paceSecPer500, 600); // 600 seconds = 10 minutes
    const mm = Math.floor(cappedPace / 60);
    const ss = Math.floor(cappedPace % 60).toString().padStart(2, '0');
    return `${mm}:${ss} /500m`;
  }, [showSplit, distanceM, elapsedSec]);


  // Placeholder power curve (kept)
  //const powerCurve = [6, 10, 18, 26, 20, 14, 10, 22, 30, 20, 12, 18, 14, 26, 24];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={[styles.screen, { paddingTop: insets.top + 20 }]}>
         {/* BLE status at the top - only show if not connected */}
  {!arduinoDevice && (
    <ThemedView style={styles.bleStatusContainer}>
      <ThemedText style={styles.bleStatusText}>
        {bleStatus} - Workout will use phone sensors only
      </ThemedText>
    </ThemedView>
  )}

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
    label={'Split'}
    active={showSplit}
    onPress={() => setShowSplit((v) => !v)}
  />
  <Pill
    label={'Avg Power'}
    active={showAvgPower}
    onPress={() => setShowAvgPower((v) => !v)}
  />
  <Pill
    label={'Acceleration'}
    active={showAccelGraph}
    onPress={() => setShowAccelGraph((v) => !v)}
  />
  <Pill
    label={'Power'}
    active={showPowerGraph}
    onPress={() => setShowPowerGraph((v) => !v)}
  />
  <Pill
    label={'Pacer'}
    active={isPacerOn || showSplitOptions}
    onPress={() => {
      if (showSplitOptions) {
        setShowSplitOptions(false);
        return;
      }
      if (isPacerOn) {
        setIsPacerOn(false);
        setShowSplitOptions(false);
        return;
      }
      setShowSplitOptions(true);
    }}
  />
  {showSplitOptions && (
  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
    {['2:00', '2:30', '3:00'].map((opt) => (
      <Pill
        key={opt}
        label={opt}
        active={selectedSplit === opt}
        onPress={() => {
          setSelectedSplit(opt);
          setIsPacerOn(true);
          setShowSplitOptions(false); // hide options after selecting
        }}
      />
    ))}
  </View>
  
)}


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

{/* Row 3 —  Power per stroke*/}
<View style={styles.metricsRow}>
          {showAvgPower && (
            <ThemedView style={styles.metricCardSm}>
              <ThemedText style={styles.metricLabelSm}>Power</ThemedText>
              <ThemedText style={styles.metricValueSm}>{power.toFixed(0)} W</ThemedText>
              <View style={styles.progressBarTrackSm}><View style={[styles.progressBarFill, { width: `${Math.min(power / 300 * 100, 100)}%` }]} /></View>
            </ThemedView>
          )}
        </View>

        {/* Live charts */}
        {showAccelGraph && <CurveChart title="Acceleration Over Time" data={accelSeries} baseline={baselineSeries} />}
        {showPowerGraph && <CurveChart title="Power Over Time" data={powerSeries} />}


        <View style={{ height: 28 }} />
      </ScrollView>
    </>
  );
}

const R = 18;

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingBottom: 30, rowGap: 8 },

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

  bleStatusContainer: {
  padding: 12,
  marginBottom: 10,
  borderRadius: 8,
  backgroundColor: '#FFF3E0',
  alignItems: 'center',
},
bleStatusText: {
  color: '#E65100',
  fontWeight: '600',
},

});
