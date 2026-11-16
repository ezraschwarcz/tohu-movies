import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors } from '@/lib/theme';

export default function Button({
  label,
  onPress,
  kind = 'primary',
  busy = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const off = busy || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        kind === 'primary' ? styles.primary : styles.ghost,
        (pressed || off) && { opacity: 0.6 },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={kind === 'primary' ? colors.accentInk : colors.ink} />
      ) : (
        <Text
          style={[
            styles.label,
            kind === 'primary' && { color: colors.accentInk },
            kind === 'danger' && { color: colors.danger },
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  ghost: { borderWidth: 1, borderColor: colors.line },
  label: { color: colors.ink, fontSize: 15, fontWeight: '800' },
});
