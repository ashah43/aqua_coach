import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
//import { bleManager } from '@/lib/ble';
import { supabase } from '@/lib/supabase';
import { Buffer } from 'buffer';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { BleManager, Device, LogLevel } from 'react-native-ble-plx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path, Rect } from 'react-native-svg';

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
const R = 22;
const BLE_LOG_TAG = '[BLE_SESSION2]';

/** Fixed vertical range for the acceleration chart (m/s²); does not auto-rescale. */
const ACCEL_CHART_Y_MIN = -9;
const ACCEL_CHART_Y_MAX = 6;
/** Low-pass gravity estimate so stroke axis stays stable while rowing. */
const GRAVITY_LPF_ALPHA = 0.96;
/** Light smoothing on signed “along boat” accel for the graph. */
const ALONG_BOAT_LPF_ALPHA = 0.55;
/** Flip to -1 if drive and recovery appear inverted for your mount. */
const BOAT_ACCEL_SIGN = -1;

type Vec3 = { x: number; y: number; z: number };

const dot3 = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

const norm3 = (v: Vec3) => Math.hypot(v.x, v.y, v.z);

const normalize3 = (v: Vec3): Vec3 | null => {
  const n = norm3(v);
  if (n < 1e-6) return null;
  const s = 1 / n;
  return { x: v.x * s, y: v.y * s, z: v.z * s };
};

/**
 * Unit vector along the hull in the horizontal (water) plane, in device coordinates.
 * Assumes the phone’s +Y axis points roughly toward the bow when foot-mounted.
 */
function strokeAxisFromGravity(gravityInDevice: Vec3): Vec3 | null {
  const g = normalize3(gravityInDevice);
  if (!g) return null;
  const ey: Vec3 = { x: 0, y: 1, z: 0 };
  const d = dot3(ey, g);
  let vx = ey.x - d * g.x;
  let vy = ey.y - d * g.y;
  let vz = ey.z - d * g.z;
  let len = Math.hypot(vx, vy, vz);
  if (len < 0.08) {
    const ex: Vec3 = { x: 1, y: 0, z: 0 };
    const d2 = dot3(ex, g);
    vx = ex.x - d2 * g.x;
    vy = ex.y - d2 * g.y;
    vz = ex.z - d2 * g.z;
    len = Math.hypot(vx, vy, vz);
  }
  if (len < 1e-6) return null;
  return { x: vx / len, y: vy / len, z: vz / len };
}

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

function useSmoothPath(
  data: number[],
  width: number,
  height: number,
  padX = 16,
  padY = 16,
  yDomain?: { min: number; max: number }
) {
  return useMemo(() => {
    if (!data.length) return '';
    const w = width - padX * 2;
    const h = height - padY * 2;
    const min = yDomain?.min ?? Math.min(...data);
    const max = yDomain?.max ?? Math.max(...data);
    const range = Math.max(1e-3, max - min);

    const xs: number[] = [];
    const ys: number[] = [];
    const stepX = w / Math.max(1, data.length - 1);

    data.forEach((v, i) => {
      const clamped =
        yDomain != null ? Math.min(yDomain.max, Math.max(yDomain.min, v)) : v;
      xs.push(padX + i * stepX);
      ys.push(padY + (1 - (clamped - min) / range) * h);
    });

    let d = `M ${xs[0]} ${ys[0]}`;
    for (let i = 0; i < xs.length - 1; i++) {
      const xMid = (xs[i] + xs[i + 1]) / 2;
      const yMid = (ys[i] + ys[i + 1]) / 2;
      d += ` Q ${xs[i]} ${ys[i]} ${xMid} ${yMid}`;
    }
    d += ` T ${xs[xs.length - 1]} ${ys[xs.length - 1]}`;
    return d;
  }, [data, width, height, padX, padY, yDomain]);
}

function CurveChart({
  title,
  data,
  yDomain,
  showZeroLine,
}: {
  title: string;
  data: number[];
  yDomain?: { min: number; max: number };
  showZeroLine?: boolean;
}) {
  const WIDTH = 320;
  const HEIGHT = 180;
  const PAD = 16;
  const path = useSmoothPath(data, WIDTH, HEIGHT, PAD, PAD, yDomain);

  const yZeroPx = useMemo(() => {
    if (!showZeroLine || !yDomain) return null;
    const h = HEIGHT - PAD * 2;
    const range = yDomain.max - yDomain.min;
    if (range <= 0) return null;
    if (!(yDomain.min < 0 && yDomain.max > 0)) return null;
    return PAD + (1 - (0 - yDomain.min) / range) * h;
  }, [showZeroLine, yDomain, HEIGHT]);

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

          {yZeroPx != null ? (
            <Line
              x1={16}
              x2={WIDTH - 16}
              y1={yZeroPx}
              y2={yZeroPx}
              stroke={COLORS.blue}
              strokeWidth={1.25}
              strokeDasharray="6 5"
            />
          ) : null}

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

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const Rm = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Rm * c;
}

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ useSensor?: string }>();

  // Testing mode: default to sensor ON when opening this screen directly.
  // Pass useSensor='false' in route params only when you explicitly want BLE disabled.
  const useSensor = params.useSensor !== 'false';
  const supportsBlePower = useSensor;

  const [showSplit, setShowSplit] = useState(true);
  const [showAvgPower, setShowAvgPower] = useState(true);
  const [showAccelGraph, setShowAccelGraph] = useState(true);
  const [showPowerGraph, setShowPowerGraph] = useState(true);
  const [showMotionDistance, setShowMotionDistance] = useState(true);
  const [showGpsDistance, setShowGpsDistance] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const [motionDistanceM, setMotionDistanceM] = useState(0);
  const [gpsDistanceM, setGpsDistanceM] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [power, setPower] = useState(0);
  const [strokeRateSpm, setStrokeRateSpm] = useState(0);

  const ACCEL_SAMPLES = 40;
  const POWER_SAMPLES = 40;

  const [accelSeries, setAccelSeries] = useState<number[]>(
    Array(ACCEL_SAMPLES).fill(0)
  );
  const [powerSeries, setPowerSeries] = useState<number[]>(
    Array(POWER_SAMPLES).fill(0)
  );

  const [isRunning, setIsRunning] = useState(true);

  const lastTsRef = useRef<number | null>(null);
  const vxRef = useRef(0);
  const vyRef = useRef(0);
  const sRef = useRef(0);

  const gravLpRef = useRef<Vec3>({ x: 0, y: 0, z: 0 });
  const strokeAxisRef = useRef<Vec3>({ x: 0, y: 1, z: 0 });
  const alongLpRef = useRef(0);
  const strokePhaseHighRef = useRef(false);
  const strokeLastPeakMsRef = useRef<number | null>(null);
  const strokeIntervalsMsRef = useRef<number[]>([]);
  const strokeRateLpRef = useRef(0);
  const strokeRateIntRef = useRef(0);

  const axLpRef = useRef(0);
  const ayLpRef = useRef(0);
  const stillAccumRef = useRef(0);

  const SAMPLE_MS = 100;
  const ACC_DEADBAND = 0.08;
  const LPF_ALPHA = 0.85;
  const DAMP = 0.92;
  const STILL_EPS = 0.06;
  const STILL_MS = 180;
  const MIN_SPEED = 0.12;
  const SCALE = 0.18;
  const STROKE_ON_THRESHOLD = 0.42;
  const STROKE_OFF_THRESHOLD = -0.05;
  const STROKE_MIN_INTERVAL_MS = 700;
  const STROKE_MAX_INTERVAL_MS = 4000;
  const STROKE_WINDOW = 6;
  const STROKE_RATE_LPF_ALPHA = 0.65;

  const gpsLastRef = useRef<(Location.LocationObjectCoords & { timestamp?: number }) | null>(
    null
  );
  const gpsDistanceRef = useRef(0);

  const [arduinoDevice, setArduinoDevice] = useState<Device | null>(null);
  const [bleStatus, setBleStatus] = useState<string>('Scanning for device...');

  const pushPowerSample = (sample: number) => {
    setPower(sample);
    setPowerSeries((prev) => {
      const next = prev.slice(1);
      next.push(sample);
      return next;
    });
  };

  const publishStrokeRate = (spm: number) => {
    const rounded = Math.max(0, Math.round(spm));
    if (rounded === strokeRateIntRef.current) return;
    strokeRateIntRef.current = rounded;
    setStrokeRateSpm(rounded);
  };

 const handleDone = async () => {
  setIsRunning(false);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.log('No signed-in user found:', userError);
    return;
  }

  const { error } = await supabase
    .from('workouts')
    .insert({
      user_id: user.id,
      started_at: new Date(Date.now() - elapsedMs).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: Math.floor(elapsedMs / 1000),
      distance_m: motionDistanceM,
      avg_power_w: power,
    });

  if (error) {
    console.log('Error saving workout:', error);
    return;
  }

  router.back();
};

  async function ensureMotionPermission() {
    const { status } = await DeviceMotion.getPermissionsAsync();
    if (status !== 'granted') {
      const res = await DeviceMotion.requestPermissionsAsync();
      if (res.status !== 'granted') throw new Error('Motion permission not granted');
    }
  }

  async function ensureLocationPermission() {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const res = await Location.requestForegroundPermissionsAsync();
      if (res.status !== 'granted') throw new Error('Location permission not granted');
    }
  }

  // BLE scan/auto-connect in session screen so "continue without device" can still connect later.
  useEffect(() => {
    if (!useSensor) {
      setBleStatus('');
      setArduinoDevice(null);
      manager.stopDeviceScan();
      return;
    }

    const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
    const CHAR_UUID = 'abcdefab-cdef-1234-5678-1234567890ab';
    const SCAN_TIMEOUT_MS = 10000;
    const RETRY_DELAY_MS = 1500;

    let cancelled = false;
    let scanTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let monitorSub: { remove: () => void } | null = null;

    const clearTimers = () => {
      if (scanTimeout) {
        clearTimeout(scanTimeout);
        scanTimeout = null;
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
    };

    const scheduleRetry = (status: string) => {
      if (cancelled) return;
      setArduinoDevice(null);
      setBleStatus(status);
      console.warn(`${BLE_LOG_TAG} ${status}`);
      clearTimers();
      retryTimeout = setTimeout(() => {
        if (!cancelled) {
          startScan();
        }
      }, RETRY_DELAY_MS);
    };

    const startScan = () => {
      if (cancelled) return;
      manager.setLogLevel(LogLevel.Verbose);
      manager.stopDeviceScan();
      setBleStatus('Scanning for force sensor...');
      console.log(`${BLE_LOG_TAG} Start scan`, {
        serviceUuid: SERVICE_UUID,
        charUuid: CHAR_UUID,
      });

      scanTimeout = setTimeout(() => {
        manager.stopDeviceScan();
        scheduleRetry('No device yet. Retrying scan...');
      }, SCAN_TIMEOUT_MS);

      manager.startDeviceScan([SERVICE_UUID], { allowDuplicates: false }, async (error, device) => {
        if (cancelled) return;

        if (error) {
          console.error(`${BLE_LOG_TAG} Scan error`, error);
          manager.stopDeviceScan();
          scheduleRetry('Scan failed. Retrying...');
          return;
        }

        if (!device) return;

        clearTimers();
        manager.stopDeviceScan();
        setBleStatus('Device found! Connecting...');
        console.log(`${BLE_LOG_TAG} Device matched`, {
          id: device.id,
          name: device.name,
          localName: device.localName,
        });

        try {
          const connected = await device.connect();
          await connected.discoverAllServicesAndCharacteristics();

          if (cancelled) return;

          setArduinoDevice(connected);
          setBleStatus('Connected! Listening for power...');
          console.log(`${BLE_LOG_TAG} Connected`, {
            id: connected.id,
            name: connected.name,
            localName: connected.localName,
          });

          connected.onDisconnected(() => {
            monitorSub?.remove();
            monitorSub = null;
            scheduleRetry('Disconnected. Reconnecting...');
          });

          monitorSub = connected.monitorCharacteristicForService(
            SERVICE_UUID,
            CHAR_UUID,
            (err, char) => {
              if (err) {
                console.error(`${BLE_LOG_TAG} Characteristic stream error`, err);
                scheduleRetry('Data stream error. Reconnecting...');
                return;
              }

              if (!char?.value) return;
              const data = Buffer.from(char.value, 'base64');
              console.log(`${BLE_LOG_TAG} Packet received`, {
                rawBase64: char.value,
                length: data.length,
              });
              if (data.length >= 3) {
                const byte1 = data.readUInt8(1);
                const byte2 = data.readUInt8(2);
                const newPower = byte1 + byte2 * 256;
                if (!isNaN(newPower)) pushPowerSample(newPower);
                console.warn(`${BLE_LOG_TAG} Power bytes b1=${byte1} b2=${byte2} PowerW=${newPower}`);
              }
            }
          );
        } catch (connectErr) {
          console.error(`${BLE_LOG_TAG} Connection error`, connectErr);
          scheduleRetry('Connection failed. Retrying...');
        }
      });
    };

    startScan();

    return () => {
      cancelled = true;
      clearTimers();
      monitorSub?.remove();
      manager.stopDeviceScan();
    };
  }, [useSensor]);

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

  useEffect(() => {
    if (!isRunning) return;

    let removed = false;
    let motionSub: { remove: () => void } | null = null;

    (async () => {
      try {
        await ensureMotionPermission();
      } catch {
        return;
      }

      DeviceMotion.setUpdateInterval(SAMPLE_MS);

      motionSub = DeviceMotion.addListener((evt: DeviceMotionMeasurement) => {
        if (removed) return;
        const now = Date.now();

        const inc = evt.accelerationIncludingGravity ?? { x: 0, y: 0, z: 0 };
        const user = evt.acceleration
          ? {
              x: evt.acceleration.x ?? 0,
              y: evt.acceleration.y ?? 0,
              z: evt.acceleration.z ?? 0,
            }
          : null;

        let ax = user?.x ?? inc.x ?? 0;
        let ay = user?.y ?? inc.y ?? 0;

        if (user) {
          const gravMeas: Vec3 = {
            x: inc.x - user.x,
            y: inc.y - user.y,
            z: inc.z - user.z,
          };
          const ga = GRAVITY_LPF_ALPHA;
          gravLpRef.current = {
            x: ga * gravLpRef.current.x + (1 - ga) * gravMeas.x,
            y: ga * gravLpRef.current.y + (1 - ga) * gravMeas.y,
            z: ga * gravLpRef.current.z + (1 - ga) * gravMeas.z,
          };

          const axis = strokeAxisFromGravity(gravLpRef.current);
          if (axis) strokeAxisRef.current = axis;

          const alongRaw = BOAT_ACCEL_SIGN * dot3(user, strokeAxisRef.current);
          alongLpRef.current =
            ALONG_BOAT_LPF_ALPHA * alongLpRef.current +
            (1 - ALONG_BOAT_LPF_ALPHA) * alongRaw;

          const along = alongLpRef.current;
          if (!strokePhaseHighRef.current && along >= STROKE_ON_THRESHOLD) {
            const lastPeak = strokeLastPeakMsRef.current;
            if (lastPeak != null) {
              const interval = now - lastPeak;
              if (interval >= STROKE_MIN_INTERVAL_MS && interval <= STROKE_MAX_INTERVAL_MS) {
                const nextIntervals = [...strokeIntervalsMsRef.current, interval].slice(
                  -STROKE_WINDOW
                );
                strokeIntervalsMsRef.current = nextIntervals;
                const avgInterval =
                  nextIntervals.reduce((sum, ms) => sum + ms, 0) / nextIntervals.length;
                const rawSpm = 60000 / avgInterval;
                strokeRateLpRef.current =
                  STROKE_RATE_LPF_ALPHA * strokeRateLpRef.current +
                  (1 - STROKE_RATE_LPF_ALPHA) * rawSpm;
                publishStrokeRate(strokeRateLpRef.current);
              }
            }
            strokeLastPeakMsRef.current = now;
            strokePhaseHighRef.current = true;
          } else if (strokePhaseHighRef.current && along <= STROKE_OFF_THRESHOLD) {
            strokePhaseHighRef.current = false;
          }

          const sinceLastPeak = strokeLastPeakMsRef.current
            ? now - strokeLastPeakMsRef.current
            : Number.POSITIVE_INFINITY;
          if (sinceLastPeak > STROKE_MAX_INTERVAL_MS * 1.6) {
            strokeIntervalsMsRef.current = [];
            strokeRateLpRef.current = 0;
            publishStrokeRate(0);
          }

          setAccelSeries((prev) => {
            const next = prev.slice(1);
            next.push(alongLpRef.current);
            return next;
          });
        } else {
          setAccelSeries((prev) => {
            const next = prev.slice(1);
            next.push(alongLpRef.current);
            return next;
          });
        }

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
        setMotionDistanceM(sRef.current);
      });
    })();

    return () => {
      removed = true;
      motionSub?.remove();
    };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;

    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        await ensureLocationPermission();
      } catch {
        return;
      }

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, //this is updating the location every second
          distanceInterval: 1, //this is updating the location every 1 meter
        },
        (loc) => {
          if (cancelled) return;

          const coords = loc.coords;
          const prev = gpsLastRef.current;

          if (prev) {
            const delta = haversineMeters(
              prev.latitude,
              prev.longitude,
              coords.latitude,
              coords.longitude
            );

            const prevTimestamp = prev.timestamp ?? loc.timestamp - 1000;
            const dtSec = Math.max(0.5, (loc.timestamp - prevTimestamp) / 1000);
            const impliedSpeed = delta / dtSec;

            if (
              coords.accuracy != null && coords.accuracy <= 12 &&
              delta > 0.5 &&
              delta < 8 &&
              impliedSpeed < 4
            ) {
              gpsDistanceRef.current += delta;
              setGpsDistanceM(gpsDistanceRef.current);
            }
          }

          gpsLastRef.current = {
            ...coords,
            timestamp: loc.timestamp,
          };
        }
      );
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [isRunning]);

  const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const splitDistanceM = gpsDistanceM; //chose gps because it is more acurate right now

  const splitText = useMemo(() => {
    if (!showSplit) return '';
    if (splitDistanceM < 1 || elapsedSec === 0) return '—';

    const paceSecPer500 = elapsedSec * (500 / splitDistanceM);

    if (!Number.isFinite(paceSecPer500)) return '—';

    const mm = Math.floor(paceSecPer500 / 60);
    const ss = Math.floor(paceSecPer500 % 60)
      .toString()
      .padStart(2, '0');

    return `${mm}:${ss} /500m`;
  }, [showSplit, splitDistanceM, elapsedSec]);

  const showDistanceCards = showMotionDistance || showGpsDistance;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <Modal
        visible={showInfo}
        animationType="fade"
        transparent
        onRequestClose={() => setShowInfo(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Workout Metrics</ThemedText>
              <Pressable onPress={() => setShowInfo(false)} style={styles.modalCloseBtn}>
                <ThemedText style={styles.modalCloseText}>✕</ThemedText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.modalSectionTitle}>Time</ThemedText>
              <ThemedText style={styles.modalBody}>
                Time shows how long the workout session has been running.
              </ThemedText>

              <ThemedText style={styles.modalSectionTitle}>Split (per 500m)</ThemedText>
              <ThemedText style={styles.modalBody}>
                Split is an estimated pace. It uses the current elapsed time and the
                motion-based distance to estimate how long 500 meters would take at the
                current rate.
              </ThemedText>

              <ThemedText style={styles.modalSectionTitle}>Motion Distance</ThemedText>
              <ThemedText style={styles.modalBody}>
                Motion distance is estimated from phone motion data. The app smooths
                accelerometer readings, estimates velocity, and accumulates distance over
                time.
              </ThemedText>

              <ThemedText style={styles.modalSectionTitle}>GPS Distance</ThemedText>
              <ThemedText style={styles.modalBody}>
                GPS distance is calculated from location updates using the distance between
                consecutive coordinates. Indoors, this may drift or jump more than usual.
              </ThemedText>

              <ThemedText style={styles.modalSectionTitle}>Power</ThemedText>
              <ThemedText style={styles.modalBody}>
                Power is read from the connected force sensor over BLE. If no sensor is
                connected, this value will stay near zero.
              </ThemedText>

              <ThemedText style={styles.modalSectionTitle}>Acceleration Graph</ThemedText>
              <ThemedText style={styles.modalBody}>
                The graph shows hull-aligned acceleration from device motion (user acceleration
                projected on the boat axis using gravity). The vertical scale is fixed (not
                auto-zoomed) so you can compare strokes; values outside the range clip at the
                edges. The dashed line is zero along the stroke axis. If drive and recovery look
                inverted, change BOAT_ACCEL_SIGN in the session code.
              </ThemedText>

              <ThemedText style={styles.modalSectionTitle}>Power Graph</ThemedText>
              <ThemedText style={styles.modalBody}>
                This graph shows recent live power readings over time from the BLE force
                sensor.
              </ThemedText>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ImageBackground
        source={require('@/assets/images/rowing-background.png')}
        style={styles.bg}
        imageStyle={styles.bgImage}
        resizeMode="cover"
      >
        <ScrollView
          contentContainerStyle={[styles.screen, { paddingTop: insets.top + 20 }]}
        >
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
                  {useSensor
                    ? arduinoDevice
                      ? 'Force sensor connected'
                      : 'Workout in progress'
                    : 'Workout in progress'}
                </ThemedText>
              </View>

              <Pressable style={styles.infoBtn} onPress={() => setShowInfo(true)}>
                <ThemedText style={styles.infoBtnText}>?</ThemedText>
              </Pressable>

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

            {useSensor && !!bleStatus && (
              <View style={styles.bleBanner}>
                <ThemedText style={styles.bleBannerText}>{bleStatus}</ThemedText>
              </View>
            )}
          </ThemedView>

          <View style={styles.backRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <ThemedText style={styles.backArrow}>‹</ThemedText>
              <ThemedText style={styles.backLabel}>Back</ThemedText>
            </Pressable>
          </View>

          <View style={styles.controlsWrap}>
            <Pill
              label="Split"
              active={showSplit}
              onPress={() => setShowSplit((v) => !v)}
            />
            {supportsBlePower && (
              <Pill
                label="Power"
                active={showAvgPower}
                onPress={() => setShowAvgPower((v) => !v)}
              />
            )}
            <Pill
              label="Accel Graph"
              active={showAccelGraph}
              onPress={() => setShowAccelGraph((v) => !v)}
            />
            {supportsBlePower && (
              <Pill
                label="Power Graph"
                active={showPowerGraph}
                onPress={() => setShowPowerGraph((v) => !v)}
              />
            )}
            <Pill
              label="Motion Dist"
              active={showMotionDistance}
              onPress={() => setShowMotionDistance((v) => !v)}
            />
            <Pill
              label="GPS Dist"
              active={showGpsDistance}
              onPress={() => setShowGpsDistance((v) => !v)}
            />
          </View>

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

            {showSplit ? (
              <ThemedView style={styles.metricCardSm}>
                <View style={[styles.cardAccent, { backgroundColor: COLORS.blue }]} />
                <ThemedText style={styles.metricLabelSm}>Split (per 500m)</ThemedText>
                <ThemedText style={styles.metricValueSm}>{splitText}</ThemedText>
                <View style={styles.progressBarTrackSm}>
                  <View style={[styles.progressBarFill, { width: '100%' }]} />
                </View>
              </ThemedView>
            ) : (
              <View style={styles.metricSpacer} />
            )}
          </View>

          <ThemedView style={styles.metricCardFull}>
            <View style={[styles.cardAccent, { backgroundColor: COLORS.navy }]} />
            <ThemedText style={styles.metricLabelSm}>Stroke Rate</ThemedText>
            <ThemedText style={styles.metricValueSm}>{strokeRateSpm} spm</ThemedText>
            <View style={styles.progressBarTrackSm}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min((strokeRateSpm / 40) * 100, 100)}%` },
                ]}
              />
            </View>
          </ThemedView>

          {showDistanceCards && (
            <>
              {showMotionDistance && showGpsDistance ? (
                <View style={styles.metricsRow}>
                  <ThemedView style={styles.metricCardSm}>
                    <View style={[styles.cardAccent, { backgroundColor: COLORS.coral }]} />
                    <ThemedText style={styles.metricLabelSm}>Motion Distance</ThemedText>
                    <ThemedText style={styles.metricValueSm}>
                      {motionDistanceM.toFixed(1)}m
                    </ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.metricCardSm}>
                    <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua2 }]} />
                    <ThemedText style={styles.metricLabelSm}>GPS Distance</ThemedText>
                    <ThemedText style={styles.metricValueSm}>
                      {gpsDistanceM.toFixed(1)}m
                    </ThemedText>
                  </ThemedView>
                </View>
              ) : showMotionDistance ? (
                <ThemedView style={styles.metricCardFull}>
                  <View style={[styles.cardAccent, { backgroundColor: COLORS.coral }]} />
                  <ThemedText style={styles.metricLabelSm}>Motion Distance</ThemedText>
                  <ThemedText style={styles.metricValueSm}>
                    {motionDistanceM.toFixed(1)}m
                  </ThemedText>
                </ThemedView>
              ) : showGpsDistance ? (
                <ThemedView style={styles.metricCardFull}>
                  <View style={[styles.cardAccent, { backgroundColor: COLORS.aqua2 }]} />
                  <ThemedText style={styles.metricLabelSm}>GPS Distance</ThemedText>
                  <ThemedText style={styles.metricValueSm}>
                    {gpsDistanceM.toFixed(1)}m
                  </ThemedText>
                </ThemedView>
              ) : null}
            </>
          )}

          {supportsBlePower && showAvgPower ? (
            <ThemedView style={styles.metricCardFull}>
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
          ) : null}

          {showAccelGraph && (
            <CurveChart
              title="Acceleration along boat"
              data={accelSeries}
              yDomain={{ min: ACCEL_CHART_Y_MIN, max: ACCEL_CHART_Y_MAX }}
              showZeroLine
            />
          )}
          {supportsBlePower && showPowerGraph && (
            <CurveChart title="Power Over Time" data={powerSeries} />
          )}

          <View style={{ height: 28 }} />
        </ScrollView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgImage: { opacity: 0.28 },

  screen: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 44,
    rowGap: 16,
  },

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

  infoBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: {
    color: COLORS.ink,
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 18,
  },

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

  controlsWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
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
  metricCardFull: {
    width: '100%',
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
  metricSpacer: {
    width: '48%',
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
    marginBottom: 8,
    lineHeight: 26,
    letterSpacing: 0,
  },
  progressBarTrackSm: {
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.track,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.ink,
    opacity: 0.9,
  },

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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,14,26,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    maxHeight: '78%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F5F8',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
    marginTop: 12,
    marginBottom: 4,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.ink,
    opacity: 0.78,
  },
});