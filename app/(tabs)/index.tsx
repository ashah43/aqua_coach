// app/(tabs)/index.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Dashboard
        </ThemedText>
        <ThemedText style={styles.subtitle}>Welcome Back, Group 27!</ThemedText>
      </ThemedView>

      <View style={styles.grid}>
        <ThemedView style={styles.card}>
          <ThemedText style={styles.cardLabelTop}>This{'\n'}Week</ThemedText>
          <ThemedText style={styles.cardValue}>12</ThemedText>
          <ThemedText style={styles.cardLabelBottom}>Sessions</ThemedText>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText style={styles.cardLabelTop}>Distance</ThemedText>
          <ThemedText style={styles.cardValue}>24.5km</ThemedText>
          <ThemedText style={styles.cardLabelBottom}>This Week</ThemedText>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText style={styles.cardLabelTop}>Avg{'\n'}Time</ThemedText>
          <ThemedText style={styles.cardValue}>32m
          </ThemedText>
          <ThemedText style={styles.cardLabelBottom}>Per{'\n'}Session</ThemedText>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText style={styles.cardLabelTop}>Avg{'\n'}Power</ThemedText>
          <ThemedText style={styles.cardValue}>215W</ThemedText>
          <ThemedText style={styles.cardLabelBottom}>This Week</ThemedText>
        </ThemedView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 44,
    rowGap: 18,
  },

  header: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingVertical: 40,
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEEFF2',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  title: {
    fontSize: 30,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 17,
    opacity: 0.7,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  card: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEEFF2',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    minHeight: 150,
  },
  cardLabelTop: {
    fontSize: 15,
    opacity: 0.6,
    lineHeight: 20,
  },
  cardValue: {
    fontSize: 36,
    fontWeight: '600',      // lighter than 700 to avoid chunky numerals
    lineHeight: 40,         // keeps vertical spacing comfy
    marginVertical: 10,
    letterSpacing: 0,       // remove extra compression
    // NOTE: intentionally NOT using fontVariant: ['tabular-nums'] to avoid squished digits on iOS
  },
  cardLabelBottom: {
    fontSize: 15,
    opacity: 0.6,
    lineHeight: 20,
  },
});
