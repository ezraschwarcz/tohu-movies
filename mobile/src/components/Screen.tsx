import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, space } from '@/lib/theme';

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export function Message({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: colors.bg,
  },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  body: {
    color: colors.ink2,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: space.sm,
  },
});
