import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import Button from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

/** The same email-first sign-in as the website: type an email, get a
 *  code, type the code. It signs in an existing member or creates a new
 *  account, and the account is the same one tohumovies.com uses. */
export default function SignInScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  function explain(message: string): string {
    if (/rate limit|too many|security purposes/i.test(message)) {
      return 'Too many emails were requested just now. Wait a minute and try again.';
    }
    if (/expired|invalid/i.test(message)) {
      return 'That code is wrong or has expired. Check it, or send a new one.';
    }
    return message || 'Something went wrong. Try again.';
  }

  async function send() {
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: true,
        data: {
          display_name: `Viewer ${Math.floor(1000 + Math.random() * 9000)}`,
          signup_source: `app-${Platform.OS}`,
        },
      },
    });
    setBusy(false);
    if (err) {
      setError(explain(err.message));
      return;
    }
    setCode('');
    setStep('code');
    setWait(30);
  }

  async function verify() {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) {
      setError('Enter the code from the email.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    setBusy(false);
    if (err || !data.session) {
      setError(explain(err?.message ?? ''));
      return;
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        {step === 'email' ? (
          <>
            <Text style={styles.body}>
              Watching is always free with no account. Add your email to comment, keep a watchlist, and pick up where you left off. No password needed.
            </Text>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.ink2}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="go"
              onSubmitEditing={() => void send()}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Continue with email" onPress={() => void send()} busy={busy} />
            <Text style={styles.fine}>
              We email you a sign-in code. New here? This creates your free account. By continuing you agree to the Terms and Privacy Policy on tohumovies.com.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.body}>We sent a code to {email.trim()}. Type it here.</Text>
            <Text style={styles.label}>Code from the email</Text>
            <TextInput
              style={[styles.input, styles.code]}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
              placeholder="123456"
              placeholderTextColor={colors.ink2}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoFocus
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Continue" onPress={() => void verify()} busy={busy} />
            <Button
              kind="ghost"
              label={wait > 0 ? `Send again in ${wait}s` : 'Send the code again'}
              onPress={() => void send()}
              disabled={wait > 0 || busy}
            />
            <Button kind="ghost" label="Use a different email" onPress={() => setStep('email')} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.xl, gap: space.md },
  body: { color: colors.ink2, fontSize: 16, lineHeight: 23, marginBottom: space.sm },
  label: { color: colors.ink, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  input: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    color: colors.ink,
    paddingHorizontal: 14,
    fontSize: 17,
  },
  code: { fontSize: 26, letterSpacing: 8, textAlign: 'center', height: 60 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  fine: { color: colors.ink2, fontSize: 12.5, lineHeight: 18 },
});
