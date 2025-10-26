// app/(tabs)/settings.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

export default function SettingsScreen() {
  const [name, setName] = useState('Group 27');
  const [weight, setWeight] = useState('75');
  const [age, setAge] = useState('28');

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>Settings</ThemedText>
        <ThemedText style={styles.subtitle}>Manage your preferences</ThemedText>
      </ThemedView>

      {/* Profile Card */}
      <ThemedView style={styles.card}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.cardHeaderIcon}>👤</ThemedText>
          <ThemedText style={styles.cardHeaderText}>Profile</ThemedText>
        </View>

        {/* Fields */}
        <View style={styles.field}>
          <ThemedText style={styles.label}>Name</ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            style={styles.input}
            placeholderTextColor="#A0A6B4"
          />
        </View>

        <View style={styles.fieldRow}>
          <View style={[styles.field, styles.fieldHalf]}>
            <ThemedText style={styles.label}>Weight (kg)</ThemedText>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="number-pad"
              style={styles.input}
              placeholder="75"
              placeholderTextColor="#A0A6B4"
            />
          </View>

          <View style={[styles.field, styles.fieldHalf]}>
            <ThemedText style={styles.label}>Age</ThemedText>
            <TextInput
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              style={styles.input}
              placeholder="28"
              placeholderTextColor="#A0A6B4"
            />
          </View>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const R = 22;

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 44,
    rowGap: 16,
  },

  header: {
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
  title: { fontSize: 28, marginBottom: 6 },
  subtitle: { fontSize: 16, opacity: 0.7 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: R,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardHeaderIcon: { fontSize: 18, marginRight: 8 },
  cardHeaderText: { fontSize: 18, fontWeight: '700' },

  field: { marginBottom: 12 },
  fieldRow: { flexDirection: 'row', columnGap: 12 },
  fieldHalf: { flex: 1 },

  label: { fontSize: 14, opacity: 0.65, marginBottom: 6 },

  input: {
    backgroundColor: '#F7F8FB',
    borderRadius: 14,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E3E7EF',
    color: '#0B0E1A',
  },
});
