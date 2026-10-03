import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

type Props = {
  name?: string | null;
  uri?: string | null;
  size?: number;
};

const BACKGROUNDS = [colors.accent, colors.primaryPressed, colors.night, '#165C35', '#7A2E8A'];

function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0])[0] ?? '';
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function backgroundFor(name?: string | null): string {
  let hash = 0;
  for (const char of name ?? '') hash = (hash * 31 + char.codePointAt(0)!) % 997;
  return BACKGROUNDS[hash % BACKGROUNDS.length];
}

export function Avatar({ name, uri, size = 48 }: Props) {
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={box} contentFit="cover" accessibilityLabel={name ?? undefined} />;
  }
  return (
    <View style={[styles.fallback, box, { backgroundColor: backgroundFor(name) }]} accessibilityLabel={name ?? undefined}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.heading, color: colors.onDark },
});
