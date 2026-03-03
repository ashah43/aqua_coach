// app/workout/session.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Buffer } from 'buffer';
import { Stack, useRouter } from 'expo-router';
import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { BleManager, type Device } from 'react-native-ble-plx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path, Rect } from 'react-native-svg';

// ---- Theme (match Dashboard) ----
const COLORS = {
  navy: '#04507D',
  blue: '#4873A3',
  aqua: '#41C9E5',
  aqua2: '#6BC7E2',
  coral: '#FB8F6E',
  surface: '#FFFFFF',
  border: '#DAE0E7',
  ink: '#0B0E1A',
  track: '#E9ECF2',
};

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
    <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>
      {label}
    </ThemedText>
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

function CurveChart({
  title,
  data,
  baseline,
}: {
  title: string;
  data: number[];
  baseline?: number[];
}) {
  const WIDTH = 320;
  const HEIGHT = 180;
  const path = useSmoothPath(data, WIDTH, HEIGHT);
  const baselinePath = baseline ? useSmoothPath(baseline, WIDTH, HEIGHT) : '';

  return (
    <ThemedView style={styles.chartCard}>
      <ThemedText style={styles.chartTitle}>{title}</ThemedText>
      <View style={styles.chartArea}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          <Rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={14} fill="#F7F8FB" />
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
              x1={16 + i * 72}
              x2={16 + i * 72}
              stroke="#E6EAF2"
              strokeWidth={1}
            />
          ))}

          {/* baseline first */}
          {baseline && (
            <Path d={baselinePath} stroke="rgba(200,0,0,0.3)" strokeWidth={2} fill="none" />
          )}

          {/* live data */}
          <Path
            d={`${path} L ${WIDTH - 16} ${HEIGHT - 16} L ${16} ${HEIGHT - 16} Z`}
            fill="rgba(11,14,26,0.06)"
          />
          <Path d={path} stroke={COLORS.ink} strokeWidth={2.5} fill="none" />
        </Svg>
      </View>
    </ThemedView>
  );
}

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // UI toggles (split + power metric are already “metric-only” toggles)
  const [showSplit, setShowSplit] = useState(true);
  const [showAvgPower, setShowAvgPower] = useState(true);

  // NEW: separate accel metric vs accel graph
  const [showAvgAccel, setShowAvgAccel] = useState(true);
  const [showAccelGraph, setShowAccelGraph] = useState(true);

  // Graph toggles
  const [showPowerGraph, setShowPowerGraph] = useState(true);

  // pace selection + pacer
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [selectedSplit, setSelectedSplit] = useState('2:00'); // default
  const [isPacerOn, setIsPacerOn] = useState(false);
  const pacerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live metrics
  const [distanceM, setDistanceM] = useState(0);
  const [accelMag, setAccelMag] = useState(0);
  const [accelAvg, setAccelAvg] = useState(0); // NEW: average accel
  const [elapsedMs, setElapsedMs] = useState(0);
  const [power, setPower] = useState(0);

  // average accel accumulator (refs so we don’t re-render constantly)
  const accelSumRef = useRef(0);
  const accelCountRef = useRef(0);

  // Realtime series (40 samples ~ 4 sec)
  const ACCEL_SAMPLES = 40;
  const [accelSeries, setAccelSeries] = useState<number[]>(
    Array(ACCEL_SAMPLES).fill(0)
  );

  const POWER_SAMPLES = 40;
  const [powerSeries, setPowerSeries] = useState<number[]>(
    Array(POWER_SAMPLES).fill(0)
  );

  // Baseline stroke curve (ideal)
  const [baselineSeries, setBaselineSeries] = useState<number[]>(
    Array(ACCEL_SAMPLES).fill(0)
  );

  const idealCurves: { pace: string; strokeRate: number; manpower: number }[] = [
    { pace: '2:00', strokeRate: 30, manpower: 350 },
    { pace: '2:30', strokeRate: 25, manpower: 300 },
    { pace: '3:00', strokeRate: 20, manpower: 250 },
  ];

  function generateIdealCurve(strokeRate: number, samples: number = 40): number[] {
    const curve: number[] = [];
    const strokeDuration = 60 / strokeRate; // seconds per stroke
    const samplesPerStroke = (strokeDuration / 4) * samples;

    for (let i = 0; i < samples; i++) {
      const positionInStroke = (i % samplesPerStroke) / samplesPerStroke;

      if (positionInStroke < 0.25) {
        const t = positionInStroke / 0.25;
        curve.push(0.3 + 2.2 * t * t);
      } else if (positionInStroke < 0.35) {
        curve.push(2.8);
      } else if (positionInStroke < 0.5) {
        const t = (positionInStroke - 0.35) / 0.15;
        curve.push(2.8 - 2.0 * t);
      } else if (positionInStroke < 0.6) {
        const t = (positionInStroke - 0.5) / 0.1;
        curve.push(0.8 - 1.2 * t);
      } else {
        const t = (positionInStroke - 0.6) / 0.4;
        curve.push(-0.4 - 0.3 * t);
      }
    }

    return curve;
  }

  useEffect(() => {
    const paceObj = idealCurves.find((c) => c.pace === selectedSplit);
    if (!paceObj) return;
    setBaselineSeries(generateIdealCurve(paceObj.strokeRate, ACCEL_SAMPLES));
  }, [selectedSplit]);

  // ✅ Pacer tick: vibration (no extra deps). This is the “does something” part.
  const pacerTick = () => {
    // short buzz; safe even if phone is silent
    Vibration.vibrate(12);
  };

  useEffect(() => {
    // always clear existing interval first
    if (pacerIntervalRef.current) {
      clearInterval(pacerIntervalRef.current);
      pacerIntervalRef.current = null;
    }

    if (!isPacerOn) return;

    const paceObj = idealCurves.find((p) => p.pace === selectedSplit);
    if (!paceObj) return;

    const intervalMs = Math.max(120, Math.round(60000 / paceObj.strokeRate));
    pacerIntervalRef.current = setInterval(() => {
      pacerTick();
    }, intervalMs);

    return () => {
      if (pacerIntervalRef.current) {
        clearInterval(pacerIntervalRef.current);
        pacerIntervalRef.current = null;
      }
    };
  }, [isPacerOn, selectedSplit]);

  useEffect(() => {
    setPowerSeries((prev) => {
      const next = prev.slice(1);
      next.push(power);
      return next;
    });
  }, [power]);

  // Start running
  const [isRunning, setIsRunning] = useState(true);

  // Done button (UI only)
  const handleDone = () => {
    setIsRunning(false);

    // stop pacer when leaving
    setIsPacerOn(false);
    setShowSplitOptions(false);

    router.back();
  };

  // --- Integration state ---
  const lastTsRef = useRef<number | null>(null);
  const vxRef = useRef(0);
  const vyRef = useRef(0);
  const sRef = useRef(0);

  // Low-pass state
  const axLpRef = useRef(0);
  const ayLpRef = useRef(0);

  // Stillness detector
  const stillAccumRef = useRef(0);

  // --- Tuning constants ---
  const SAMPLE_MS = 100;
  const ACC_DEADBAND = 0.08;
  const LPF_ALPHA = 0.85;
  const DAMP = 0.92;
  const STILL_EPS = 0.06;
  const STILL_MS = 180;
  const MIN_SPEED = 0.12;
  const SCALE = 0.18;

  // --- Arduino BLE ---
  const [arduinoDevice, setArduinoDevice] = useState<Device | null>(null);
  const [bleStatus, setBleStatus] = useState<string>('No device connected');

  useEffect(() => {
    const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
    const CHAR_UUID = 'abcdefab-cdef-1234-5678-1234567890ab';

    manager
      .connectedDevices([SERVICE_UUID])
      .then((devices: Device[]) => {
        if (devices.length > 0) {
          const device = devices[0];
          setArduinoDevice(device);
          setBleStatus('Connected! Listening...');

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

              // safety: you read index 2, so require length >= 3
              if (data.length >= 3) {
                const byte1 = data.readUInt8(1);
                const byte2 = data.readUInt8(2);
                const newPower = byte1 + byte2 * 256;
                setPower(newPower);
              }
            }
          );
        } else {
          setBleStatus('No device connected');
          setArduinoDevice(null);
        }
      })
      .catch((err: any) => {
        console.log('Error checking connected devices:', err);
        setBleStatus('No device connected');
      });

    return () => {
      manager.stopDeviceScan();
    };
  }, []);

  async function ensureMotionPermission() {
    const { status } = await DeviceMotion.getPermissionsAsync();
    if (status !== 'granted') {
      const res = await DeviceMotion.requestPermissionsAsync();
      if (res.status !== 'granted') throw new Error('Motion permission not granted');
    }
  }

  // Timer (pause/resume)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRunning) {
      const resumeStart = Date.now() - elapsedMs;
      interval = setInterval(() => {
        setElapsedMs(Date.now() - resumeStart);
      }, 250);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  // DeviceMotion listener
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

        const a =
          evt.acceleration ??
          evt.accelerationIncludingGravity ?? { x: 0, y: 0, z: 0 };
        let ax = a.x ?? 0;
        let ay = a.y ?? 0;

        const mag = Math.sqrt(ax * ax + ay * ay + (a.z ?? 0) ** 2);
        setAccelMag(mag);

        // update average accel
        accelSumRef.current += mag;
        accelCountRef.current += 1;
        setAccelAvg(accelSumRef.current / Math.max(1, accelCountRef.current));

        const now = Date.now();
        if (lastTsRef.current == null) {
          lastTsRef.current = now;
          return;
        }
        const dt = (now - lastTsRef.current) / 1000;
        lastTsRef.current = now;

        if (dt <= 0 || dt > 0.25) return;

        axLpRef.current = LPF_ALPHA * axLpRef.current + (1 - LPF_ALPHA) * ax;
        ayLpRef.current = LPF_ALPHA * ayLpRef.current + (1 - LPF_ALPHA) * ay;
        ax = axLpRef.current;
        ay = ayLpRef.current;

        if (Math.abs(ax) < ACC_DEADBAND) ax = 0;
        if (Math.abs(ay) < ACC_DEADBAND) ay = 0;

        vxRef.current += ax * dt;
        vyRef.current += ay * dt;

        vxRef.current *= DAMP;
        vyRef.current *= DAMP;

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

        let speed = Math.hypot(vxRef.current, vyRef.current);
        if (speed < MIN_SPEED) speed = 0;

        sRef.current += speed * dt * SCALE;
        setDistanceM(sRef.current);

        setAccelSeries((prev) => {
          const next = prev.slice(1);
          next.push(mag);
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
    const paceSecPer500 = elapsedSec * (500 / distanceM);
    const cappedPace = Math.min(paceSecPer500, 600);
    const mm = Math.floor(cappedPace / 60);
    const ss = Math.floor(cappedPace % 60).toString().padStart(2, '0');
    return `${mm}:${ss} /500m`;
  }, [showSplit, distanceM, elapsedSec]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ImageBackground
        source={require('@/assets/images/rowing-background.png')}
        style={styles.bg}
        imageStyle={styles.bgImage}
        resizeMode="cover"
      >
        <ScrollView
          contentContainerStyle={[styles.screen, { paddingTop: insets.top + 20 }]}
        >
          {/* Header card */}
          <ThemedView style={styles.header}>
            <View style={styles.headerTopRow}>
              <Image
                source={require('@/assets/images/aquacoach-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <ThemedText type="title" style={styles.headerTitle}>
                  Workout Session
                </ThemedText>
                <ThemedText style={styles.headerSubtitle}>
                  {arduinoDevice ? 'Device connected' : 'Phone sensors only'}
                </ThemedText>
              </View>

              <View style={styles.headerBtns}>
                <Pressable
                  style={[styles.headerBtn, !isRunning && { opacity: 0.7 }]}
                  onPress={() => setIsRunning((prev) => !prev)}
                >
                  <ThemedText style={styles.headerBtnText}>
                    {isRunning ? 'Pause' : 'Resume'}
                  </ThemedText>
                </Pressable>

                <Pressable style={[styles.headerBtn, styles.doneBtn]} onPress={handleDone}>
                  <ThemedText style={[styles.headerBtnText, styles.doneBtnText]}>
                    Done
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {!arduinoDevice && (
              <View style={styles.bleBanner}>
                <ThemedText style={styles.bleBannerText}>
                  {bleStatus}
                </ThemedText>
              </View>
            )}
          </ThemedView>

          {/* Back row */}
          <View style={styles.backRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <ThemedText style={styles.backArrow}>‹</ThemedText>
              <ThemedText style={styles.backLabel}>Back</ThemedText>
            </Pressable>
          </View>

          {/* Toggles */}
          <View style={styles.controlsWrap}>
            <Pill label="Split" active={showSplit} onPress={() => setShowSplit((v) => !v)} />
            <Pill
              label="Avg Power"
              active={showAvgPower}
              onPress={() => setShowAvgPower((v) => !v)}
            />

            {/* NEW: separate avg accel vs accel graph */}
            <Pill
              label="Avg Accel"
              active={showAvgAccel}
              onPress={() => setShowAvgAccel((v) => !v)}
            />
            <Pill
              label="Accel Graph"
              active={showAccelGraph}
              onPress={() => setShowAccelGraph((v) => !v)}
            />

            <Pill
              label="Power Graph"
              active={showPowerGraph}
              onPress={() => setShowPowerGraph((v) => !v)}
            />

            <Pill
              label={isPacerOn ? `Pacer: ${selectedSplit}` : 'Pacer'}
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
          </View>

          {showSplitOptions && (
            <View style={styles.splitOptionsRow}>
              {['2:00', '2:30', '3:00'].map((opt) => (
                <Pill
                  key={opt}
                  label={opt}
                  active={selectedSplit === opt}
                  onPress={() => {
                    setSelectedSplit(opt);
                    setIsPacerOn(true); // ✅ this now actually vibrates on interval
                    setShowSplitOptions(false);
                  }}
                />
              ))}
            </View>
          )}

          {/* Metrics */}
          <View style={styles.metricsRow}>
            <ThemedView style={styles.metricCardSm}>
              <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua }]} />
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
              <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua2 }]} />
              <ThemedText style={styles.metricLabelSm}>Distance</ThemedText>
              <ThemedText style={styles.metricValueSm}>{distanceText}</ThemedText>
              <View style={styles.progressBarTrackSm}>
                <View style={[styles.progressBarFill, { width: '100%' }]} />
              </View>
            </ThemedView>
          </View>

          <View style={styles.metricsRow}>
            {showSplit && (
              <ThemedView style={styles.metricCardSm}>
                <View style={[styles.cardAccent, { backgroundColor: COLORS.blue }]} />
                <ThemedText style={styles.metricLabelSm}>Split (per 500m)</ThemedText>
                <ThemedText style={styles.metricValueSm}>{splitText}</ThemedText>
                <View style={styles.progressBarTrackSm}>
                  <View style={[styles.progressBarFill, { width: '100%' }]} />
                </View>
              </ThemedView>
            )}

            {showAvgAccel && (
              <ThemedView style={styles.metricCardSm}>
                <View style={[styles.cardAccent, { backgroundColor: COLORS.coral }]} />
                <ThemedText style={styles.metricLabelSm}>Avg Acceleration</ThemedText>
                <ThemedText style={styles.metricValueSm}>
                  {accelAvg.toFixed(2)} m/s²
                </ThemedText>
                <View style={styles.progressBarTrackSm}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(accelAvg * 10, 100)}%` },
                    ]}
                  />
                </View>
              </ThemedView>
            )}
          </View>

          <View style={styles.metricsRow}>
            {showAvgPower && (
              <ThemedView style={styles.metricCardSm}>
                <View style={[styles.cardAccent, { backgroundColor: COLORS.navy }]} />
                <ThemedText style={styles.metricLabelSm}>Power</ThemedText>
                <ThemedText style={styles.metricValueSm}>{power.toFixed(0)} W</ThemedText>
                <View style={styles.progressBarTrackSm}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min((power / 300) * 100, 100)}%` },
                    ]}
                  />
                </View>
              </ThemedView>
            )}
          </View>

          {/* Live charts */}
          {showAccelGraph && (
            <CurveChart
              title="Acceleration Over Time"
              data={accelSeries}
              baseline={baselineSeries}
            />
          )}
          {showPowerGraph && <CurveChart title="Power Over Time" data={powerSeries} />}

          <View style={{ height: 28 }} />
        </ScrollView>
      </ImageBackground>
    </>
  );
}

const R = 22;

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgImage: { opacity: 0.28 },

  screen: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 44,
    rowGap: 16,
  },

  // Header (Dashboard-style)
  header: {
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 16,
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
    gap: 12,
  },
  logo: { width: 56, height: 56 },
  headerTitle: { fontSize: 22, letterSpacing: -0.2 },
  headerSubtitle: { fontSize: 14, opacity: 0.7, marginTop: 2 },

  headerBtns: {
    flexDirection: 'column',
    gap: 8,
  },

  headerBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  headerBtnText: { fontWeight: '700', color: COLORS.ink },

  doneBtn: {
    backgroundColor: COLORS.aqua,
    borderColor: COLORS.aqua,
  },
  doneBtnText: {
    color: '#FFFFFF',
  },

  bleBanner: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#EAF7FB',
    borderWidth: 1,
    borderColor: '#CFEFF6',
  },
  bleBannerText: { color: COLORS.navy, fontWeight: '600', fontSize: 13 },

  // Back row
  backRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  backArrow: { fontSize: 28, lineHeight: 28, color: COLORS.ink },
  backLabel: { fontSize: 14, opacity: 0.7 },

  // pills
  controlsWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  splitOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    minWidth: 86,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  pillActive: { backgroundColor: COLORS.aqua, borderColor: COLORS.aqua },
  pillText: { fontSize: 13, opacity: 0.85, color: COLORS.ink },
  pillTextActive: { color: '#FFFFFF', opacity: 1, fontWeight: '700' },

  // metrics
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  metricCardSm: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: R,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 6,
    width: '100%',
  },
  metricLabelSm: { fontSize: 13, opacity: 0.65, marginBottom: 8 },
  metricValueSm: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 26,
    letterSpacing: 0,
  },
  progressBarTrackSm: {
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.track,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.ink,
    opacity: 0.9,
  },

  // charts
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: R,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  chartTitle: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  chartArea: { height: 180, borderRadius: 14, overflow: 'hidden' },
});