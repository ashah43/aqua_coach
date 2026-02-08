// app/(tabs)/workout.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const manager = new BleManager();

export default function WorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [arduinoDevice, setArduinoDevice] = useState<Device | null>(null);
  const [bleStatus, setBleStatus] = useState<string>('Not connected');
  const [isScanning, setIsScanning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connect to Arduino device
  const handleConnectDevice = () => {
    if (arduinoDevice) {
      // Already connected, navigate to workout
      router.push('/workout/session2');
      return;
    }

    if (isScanning) {
      // Stop scanning if already scanning
      manager.stopDeviceScan();
      setIsScanning(false);
      setBleStatus('Not connected');
      return;
    }

    setIsScanning(true);
    setBleStatus('Scanning for device...');
    const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set timeout to stop scanning after 5 seconds
    timeoutRef.current = setTimeout(() => {
      console.log('Scan timeout - no device found after 5 seconds');
      manager.stopDeviceScan();
      setIsScanning(false);
      setBleStatus('Not connected');
      timeoutRef.current = null;
    }, 5000);

    const subscription = manager.startDeviceScan(
      [SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.log('Scan error:', error);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setBleStatus('Not connected');
          setIsScanning(false);
          return;
        }

        if (!device) return;

        // Device found - clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        console.log('Found device:', device.name, device.id);
        setBleStatus('Device found! Connecting...');
        manager.stopDeviceScan();
        setIsScanning(false);

        device.connect()
          .then(d => d.discoverAllServicesAndCharacteristics())
          .then(d => {
            setArduinoDevice(d);
            setBleStatus('Connected! Ready to start workout');
            console.log('Connected to Arduino device');
          })
          .catch(err => {
            console.log('Connection error:', err);
            setBleStatus('Not connected');
          });
      }
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      manager.stopDeviceScan();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={[styles.screen, { paddingTop: insets.top + 24 }]}>
      <ThemedView style={styles.hero}>
        <ThemedText style={styles.heroTitle}>Get ready to row</ThemedText>
        <ThemedText style={styles.heroText}>
          Track your performance with real-time metrics and stroke analysis.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText style={styles.cardTitle}>Workout Goals</ThemedText>

        <View style={styles.grid}>
          <View style={[styles.cell, styles.brRight, styles.brBottom]}>
            <ThemedText style={styles.cellLabel}>Duration</ThemedText>
            <ThemedText style={styles.cellValue}>30 min</ThemedText>
          </View>
          <View style={[styles.cell, styles.brBottom]}>
            <ThemedText style={styles.cellLabel}>Distance</ThemedText>
            <ThemedText style={styles.cellValue}>5000 m</ThemedText>
          </View>
          <View style={[styles.cell, styles.brRight]}>
            <ThemedText style={styles.cellLabel}>Target Power</ThemedText>
            <ThemedText style={styles.cellValue}>200 W</ThemedText>
          </View>
          <View style={styles.cell}>
            <ThemedText style={styles.cellLabel}>Stroke Rate</ThemedText>
            <ThemedText style={styles.cellValue}>20 SPM</ThemedText>
          </View>
          <View style={styles.cell}>
            <ThemedText style={styles.cellLabel}>Edit</ThemedText>
            
          </View>
        </View>
      </ThemedView>

      {/* BLE Status - only show when scanning or connected */}
      {(isScanning || arduinoDevice) && bleStatus !== 'Not connected' && (
        <ThemedView style={[
          styles.bleStatusContainer,
          arduinoDevice && styles.bleStatusContainerConnected
        ]}>
          <ThemedText style={[
            styles.bleStatusText,
            arduinoDevice && styles.bleStatusTextConnected
          ]}>
            {bleStatus}
          </ThemedText>
        </ThemedView>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.cta,
          pressed && { transform: [{ scale: 0.98 }] },
          !arduinoDevice && isScanning && styles.ctaScanning,
          arduinoDevice && styles.ctaConnected
        ]}
        onPress={handleConnectDevice}
        hitSlop={6}
        disabled={isScanning && !arduinoDevice}
      >
        <ThemedText style={styles.ctaText}>
          {arduinoDevice 
            ? 'Ready to Start Workout' 
            : isScanning 
            ? 'Scanning...' 
            : 'Connect Device'}
        </ThemedText>
      </Pressable>

      {/* Continue without device option */}
      <Pressable
        style={({ pressed }) => [
          styles.ctaSecondary,
          pressed && { transform: [{ scale: 0.98 }] }
        ]}
        onPress={() => router.push('/workout/session2')}
        hitSlop={6}
      >
        <ThemedText style={styles.ctaSecondaryText}>
          Continue without Device
        </ThemedText>
      </Pressable>

      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const R = 22; // shared corner radius

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 22,
    paddingBottom: 40,
    rowGap: 18,
  },

  // Hero
  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: R + 4,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#EEF1F5',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  heroText: {
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.75,
  },

  // Goals card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: R,
    paddingTop: 14,
    paddingBottom: 4,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 8,
  },
  grid: {
    marginTop: 4,
    borderRadius: R - 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F2F6',
  },
  cell: {
    width: '50%',
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  brRight: { borderRightWidth: 1, borderRightColor: '#F0F2F6' },
  brBottom: { borderBottomWidth: 1, borderBottomColor: '#F0F2F6' },

  // layout for two-by-two grid
  // (use row wrap without gaps so borders meet cleanly)
  // we place exactly 4 children so this is sufficient:
  gridRow: { flexDirection: 'row' },

  cellLabel: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 6,
  },
  cellValue: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: 0,
  },

  // CTA
  cta: {
    alignSelf: 'stretch',
    backgroundColor: '#0B0E1A',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ctaScanning: {
    backgroundColor: '#FF9800',
  },
  ctaConnected: {
    backgroundColor: '#4CAF50',
  },
  ctaSecondary: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0B0E1A',
    marginTop: 12,
  },
  ctaSecondaryText: {
    color: '#0B0E1A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bleStatusContainer: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  bleStatusContainerConnected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  bleStatusText: {
    color: '#E65100',
    fontWeight: '600',
    fontSize: 14,
  },
  bleStatusTextConnected: {
    color: '#2E7D32',
  },
});
