// app/(tabs)/settings.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { signInWithGoogle, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

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

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.primaryBtn,
        disabled && { opacity: 0.6 },
      ]}
    >
      <ThemedText style={styles.primaryBtnText}>{label}</ThemedText>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.secondaryBtn,
        disabled && { opacity: 0.6 },
      ]}
    >
      <ThemedText style={styles.secondaryBtnText}>{label}</ThemedText>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [name, setName] = useState('Group 27');
  const [weight, setWeight] = useState('75');
  const [age, setAge] = useState('28');

  const [user, setUser] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Load current user and subscribe to auth state changes
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setUser(data?.user ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  // When user changes, load their profile from Supabase
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setLoadingProfile(true);

      const { data, error } = await supabase
        .from('profile')
        .select('name, weight, age')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.log('Error loading profile:', error);
      } else if (data) {
        setName(data.name ?? 'Group 27');
        setWeight(
          data.weight !== null && data.weight !== undefined ? String(data.weight) : '75'
        );
        setAge(
          data.age !== null && data.age !== undefined ? String(data.age) : '28'
        );
      }

      setLoadingProfile(false);
    };

    loadProfile();
  }, [user?.id]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSavingProfile(true);

    const { error } = await supabase.from('profile').upsert({
      id: user.id,
      name,
      weight: weight ? Number(weight) : null,
      age: age ? Number(age) : null,
    });

    if (error) console.log('Error saving profile:', error);
    else console.log('Profile saved!');

    setSavingProfile(false);
  };

  const saveLabel =
    savingProfile ? 'Saving…' : loadingProfile ? 'Loading…' : 'Save Profile';

  return (
    <ImageBackground
      source={require('@/assets/images/rowing-background.png')}
      style={styles.bg}
      imageStyle={styles.bgImage}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={styles.screen}>
        {/* HEADER CARD (matches Dashboard/Progress) */}
        <ThemedView style={styles.header}>
          <View style={styles.headerTopRow}>
            <Image
              source={require('@/assets/images/aquacoach-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }}>
              <ThemedText type="title" style={styles.title}>
                Settings
              </ThemedText>
              <ThemedText style={styles.subtitle}>Manage your preferences</ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* PROFILE CARD */}
        <ThemedView style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.sectionDot, { backgroundColor: COLORS.aqua }]} />
            <ThemedText style={styles.cardHeaderText}>Profile</ThemedText>
          </View>

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

          {user ? (
            <View style={styles.actionsRow}>
              <PrimaryButton
                label={saveLabel}
                onPress={handleSaveProfile}
                disabled={savingProfile || loadingProfile}
              />
              <ThemedText style={styles.helperText}>
                Changes save to your account.
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.helperText}>
              Sign in below to save your profile.
            </ThemedText>
          )}
        </ThemedView>

        {/* ACCOUNT CARD */}
        <ThemedView style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.sectionDot, { backgroundColor: COLORS.coral }]} />
            <ThemedText style={styles.cardHeaderText}>Account</ThemedText>
          </View>

          {user ? (
            <View style={styles.authSection}>
              <ThemedText style={styles.label}>
                Signed in as {user.email ?? 'your account'}
              </ThemedText>
              <SecondaryButton label="Sign out" onPress={signOut} />
            </View>
          ) : (
            <View style={styles.authSection}>
              <ThemedText style={styles.label}>Connect your account</ThemedText>
              <PrimaryButton label="Sign in with Google" onPress={signInWithGoogle} />
            </View>
          )}
        </ThemedView>

        <View style={{ height: 8 }} />
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgImage: { opacity: 0.28 },

  screen: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 44,
    rowGap: 18,
  },

  // Header (same as Home/Progress)
  header: {
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    paddingVertical: 18,
    paddingHorizontal: 18,
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
    gap: 14,
  },
  logo: { width: 100, height: 100 },
  title: { fontSize: 30, marginBottom: 4, letterSpacing: -0.2 },
  subtitle: { fontSize: 16, opacity: 0.75 },

  // Cards (same family)
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  cardHeaderText: {
    fontSize: 18,
    fontWeight: '700',
  },

  field: { marginBottom: 12 },
  fieldRow: { flexDirection: 'row', columnGap: 12 },
  fieldHalf: { flex: 1 },

  label: { fontSize: 14, opacity: 0.7, marginBottom: 6 },

  input: {
    backgroundColor: COLORS.soft,
    borderRadius: 14,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E3E7EF',
    color: COLORS.ink,
  },

  helperText: {
    fontSize: 12,
    opacity: 0.65,
    marginTop: 10,
  },

  actionsRow: {
    marginTop: 6,
  },

  authSection: {
    marginTop: 4,
    rowGap: 10,
  },

  // Buttons
  primaryBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: COLORS.aqua,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.aqua,
  },
  primaryBtnText: {
    color: COLORS.ink,
    fontWeight: '800',
    fontSize: 16,
  },

  secondaryBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: {
    color: COLORS.ink,
    fontWeight: '700',
    fontSize: 16,
  },
});