// app/(tabs)/workout.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

export default function WorkoutScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.screen}>
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

      <Pressable
        style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.98 }] }]}
        onPress={() => router.push('/workout/session')}
        hitSlop={6}
      >
        <ThemedText style={styles.ctaText}>Start Workout</ThemedText>
      </Pressable>

      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const R = 22; // shared corner radius

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 22,
    paddingTop: 24,
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
});
