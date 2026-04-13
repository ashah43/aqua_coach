// app/(tabs)/workout.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { BleManager, type Device } from 'react-native-ble-plx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const manager = new BleManager();

const COLORS = {
  navy: '#04507D',
  blue: '#4873A3',
  aqua: '#41C9E5',
  aqua2: '#6BC7E2',
  coral: '#FB8F6E',
  surface: '#FFFFFF',
  border: '#DAE0E7',
  ink: '#0B0E1A',
  soft: '#F7F8FB',
};

function digitsOnly(s: string) {
  return s.replace(/[^\d]/g, '');
}

function clampNumber(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function WorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [arduinoDevice, setArduinoDevice] = useState<Device | null>(null);
  const [bleStatus, setBleStatus] = useState<string>('Not connected');
  const [isScanning, setIsScanning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Workout Goals ----
  const [goalDurationMin, setGoalDurationMin] = useState(30);
  const [goalDistanceM, setGoalDistanceM] = useState(5000);
  const [goalPowerW, setGoalPowerW] = useState(200);
  const [goalSpm, setGoalSpm] = useState(20);

  // ---- Modal state ----
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [draftDuration, setDraftDuration] = useState('30');
  const [draftDistance, setDraftDistance] = useState('5000');
  const [draftPower, setDraftPower] = useState('200');
  const [draftSpm, setDraftSpm] = useState('20');

  const openEdit = () => {
    setDraftDuration(String(goalDurationMin));
    setDraftDistance(String(goalDistanceM));
    setDraftPower(String(goalPowerW));
    setDraftSpm(String(goalSpm));
    setIsEditOpen(true);
  };

  const cancelEdit = () => setIsEditOpen(false);

  const saveEdit = () => {
    const dMin = clampNumber(parseInt(digitsOnly(draftDuration) || '0', 10), 1, 600);
    const dist = clampNumber(parseInt(digitsOnly(draftDistance) || '0', 10), 50, 100000);
    const pwr = clampNumber(parseInt(digitsOnly(draftPower) || '0', 10), 10, 2000);
    const spm = clampNumber(parseInt(digitsOnly(draftSpm) || '0', 10), 10, 60);

    setGoalDurationMin(dMin);
    setGoalDistanceM(dist);
    setGoalPowerW(pwr);
    setGoalSpm(spm);

    setIsEditOpen(false);
  };

  // ---- BLE ----
  const handleConnectDevice = () => {
    if (arduinoDevice) {
      router.push('/workout/session2');
      return;
    }

    if (isScanning) {
      manager.stopDeviceScan();
      setIsScanning(false);
      setBleStatus('Not connected');
      return;
    }

    setIsScanning(true);
    setBleStatus('Scanning for device...');
    const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
      setBleStatus('Not connected');
      timeoutRef.current = null;
    }, 10000);

    manager.startDeviceScan([SERVICE_UUID], { allowDuplicates: false }, (error, device) => {
      if (error) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setBleStatus('Not connected');
        setIsScanning(false);
        return;
      }

      if (!device) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      manager.stopDeviceScan();
      setIsScanning(false);

      device
        .connect()
        .then((d) => d.discoverAllServicesAndCharacteristics())
        .then((d) => {
          setArduinoDevice(d);
          setBleStatus('Connected! Ready to start workout');
        })
        .catch(() => setBleStatus('Not connected'));
    });
  };

  useEffect(() => {
    return () => {
      manager.stopDeviceScan();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const showBleBanner = (isScanning || arduinoDevice) && bleStatus !== 'Not connected';

  return (
    <ImageBackground
      source={require('@/assets/images/rowing-background.png')}
      style={styles.bg}
      imageStyle={styles.bgImage}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={[styles.screen, { paddingTop: insets.top + 24 }]}>
        <ThemedView style={styles.hero}>
          <ThemedText style={styles.heroTitle}>Get ready to row</ThemedText>
          <ThemedText style={styles.heroText}>
            Track your performance with real-time metrics and stroke analysis.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <ThemedText style={styles.cardTitle}>Workout Goals</ThemedText>
            <Pressable onPress={openEdit} style={styles.editBtn}>
              <ThemedText style={styles.editBtnText}>Edit</ThemedText>
            </Pressable>
          </View>

          <View style={styles.grid}>
            <View style={[styles.cell, styles.brRight, styles.brBottom]}>
              <ThemedText style={styles.cellLabel}>Duration</ThemedText>
              <ThemedText style={styles.cellValue}>{goalDurationMin} min</ThemedText>
            </View>

            <View style={[styles.cell, styles.brBottom]}>
              <ThemedText style={styles.cellLabel}>Distance</ThemedText>
              <ThemedText style={styles.cellValue}>{goalDistanceM} m</ThemedText>
            </View>

            <View style={[styles.cell, styles.brRight]}>
              <ThemedText style={styles.cellLabel}>Target Power</ThemedText>
              <ThemedText style={styles.cellValue}>{goalPowerW} W</ThemedText>
            </View>

            <View style={styles.cell}>
              <ThemedText style={styles.cellLabel}>Stroke Rate</ThemedText>
              <ThemedText style={styles.cellValue}>{goalSpm} SPM</ThemedText>
            </View>
          </View>
        </ThemedView>

        {showBleBanner && (
          <ThemedView style={styles.bleStatusContainer}>
            <ThemedText style={styles.bleStatusText}>{bleStatus}</ThemedText>
          </ThemedView>
        )}

        <Pressable style={styles.cta} onPress={handleConnectDevice}>
          <ThemedText style={styles.ctaText}>
            {arduinoDevice ? 'Ready to Start Workout' : isScanning ? 'Scanning...' : 'Connect Device'}
          </ThemedText>
        </Pressable>

        <Pressable style={styles.ctaSecondary} onPress={() => router.push('/workout/session2')}>
          <ThemedText style={styles.ctaSecondaryText}>Continue without Device</ThemedText>
        </Pressable>
      </ScrollView>

      {/* ---- Modal ---- */}
      <Modal visible={isEditOpen} transparent animationType="fade" onRequestClose={cancelEdit}>
        <Pressable style={styles.modalBackdrop} onPress={cancelEdit} />

        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.modalTopRow}>
                <ThemedText style={styles.modalTitle}>Edit Goals</ThemedText>
                <Pressable onPress={cancelEdit}>
                  <ThemedText style={styles.closeText}>✕</ThemedText>
                </Pressable>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled">
                {[
                  ['Duration', draftDuration, setDraftDuration, 'min'],
                  ['Distance', draftDistance, setDraftDistance, 'm'],
                  ['Target Power', draftPower, setDraftPower, 'W'],
                  ['Stroke Rate', draftSpm, setDraftSpm, 'SPM'],
                ].map(([label, value, setter, unit]: any) => (
                  <View key={label} style={styles.formRow}>
                    <ThemedText style={styles.formLabel}>{label}</ThemedText>
                    <View style={styles.inputWrap}>
                      <TextInput
                        value={value}
                        onChangeText={(t) => setter(digitsOnly(t))}
                        keyboardType="number-pad"
                        style={styles.input}
                      />
                      <ThemedText style={styles.unit}>{unit}</ThemedText>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.modalBtns}>
                <Pressable style={styles.modalBtnGhost} onPress={cancelEdit}>
                  <ThemedText style={styles.modalBtnGhostText}>Cancel</ThemedText>
                </Pressable>

                <Pressable style={styles.modalBtn} onPress={saveEdit}>
                  <ThemedText style={styles.modalBtnText}>Save</ThemedText>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgImage: { opacity: 0.28 },
  screen: { paddingHorizontal: 22, paddingBottom: 40, rowGap: 18 },

  hero: { backgroundColor: COLORS.surface, borderRadius: 22, padding: 18 },
  heroTitle: { fontSize: 20, fontWeight: '800' },
  heroText: { fontSize: 16, opacity: 0.8 },

  card: { backgroundColor: COLORS.surface, borderRadius: 22, padding: 14 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.soft, borderRadius: 12 },
  editBtnText: { fontWeight: '800', color: COLORS.navy },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  cell: { width: '50%', padding: 14 },
  brRight: { borderRightWidth: 1, borderColor: '#eee' },
  brBottom: { borderBottomWidth: 1, borderColor: '#eee' },
  cellLabel: { fontSize: 14, opacity: 0.7 },
  cellValue: { fontSize: 22, fontWeight: '800' },

  cta: { backgroundColor: COLORS.aqua, padding: 16, borderRadius: 16, alignItems: 'center' },
  ctaText: { fontWeight: '900' },
  ctaSecondary: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 12,
  },
  
  ctaSecondaryText: {
    color: COLORS.ink,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  bleStatusContainer: { padding: 10, backgroundColor: '#EAF7FB', borderRadius: 12 },
  bleStatusText: { fontWeight: '800', color: COLORS.navy },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalContainer: { position: 'absolute', left: 16, right: 16, top: '20%' },
  modalSheet: { backgroundColor: '#fff', borderRadius: 20, padding: 16 },
  modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  closeText: { fontSize: 18, fontWeight: '900' },

  formRow: { marginBottom: 12 },
  formLabel: { fontSize: 14, opacity: 0.7 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FB', borderRadius: 14, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16 },
  unit: { marginLeft: 8, fontWeight: '800' },

  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtnGhost: { flex: 1, padding: 14, alignItems: 'center' },
  modalBtnGhostText: { fontWeight: '900' },
  modalBtn: { flex: 1, padding: 14, backgroundColor: COLORS.aqua, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { fontWeight: '900' },
});