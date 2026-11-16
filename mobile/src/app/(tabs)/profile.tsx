import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '@/components/Button';
import { Loading } from '@/components/Screen';
import { useAuth } from '@/lib/auth';
import { SITE_URL } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

export default function ProfileScreen() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.display_name ?? '');
  }, [profile]);

  if (loading) return <Loading />;

  if (!user) {
    return (
      <View style={styles.signedOut}>
        <Text style={styles.h1}>Watching is free</Text>
        <Text style={styles.body}>
          No account needed. Join free to comment, keep a watchlist, and pick up where you left off on any device.
        </Text>
        <Button label="Sign in or join free" onPress={() => router.push('/sign-in')} />
      </View>
    );
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || !user) return;
    setBusy(true);
    setNote(null);
    const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', user.id);
    setBusy(false);
    if (error) {
      setNote('Could not save your name. Try again.');
      return;
    }
    await refreshProfile();
    setNote('Saved.');
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarLetter}>{(profile?.display_name || user.email || '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.h1} numberOfLines={1}>
            {profile?.display_name || 'Member'}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </View>

      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        maxLength={60}
        placeholder="The name shown on your comments"
        placeholderTextColor={colors.ink2}
      />
      <Button label="Save name" onPress={() => void save()} busy={busy} />
      {note ? <Text style={styles.muted}>{note}</Text> : null}

      <View style={styles.group}>
        <Button
          kind="ghost"
          label="Photo, bio and email settings"
          onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/profile`)}
        />
        <Button kind="ghost" label="Privacy Policy" onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/privacy`)} />
        <Button kind="ghost" label="Terms of Service" onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/terms`)} />
        <Button
          kind="danger"
          label="Sign out"
          onPress={() =>
            Alert.alert('Sign out?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md },
  signedOut: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: space.xl, gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.panel2 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  avatarLetter: { color: colors.accentInk, fontSize: 30, fontWeight: '900' },
  h1: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  body: { color: colors.ink2, fontSize: 16, lineHeight: 23 },
  muted: { color: colors.ink2, fontSize: 14 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    color: colors.ink,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  group: { marginTop: space.xl, gap: space.md },
});
