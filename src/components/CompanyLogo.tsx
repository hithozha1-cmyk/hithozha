import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

type Props = {
  name?: string | null;
  uri?: string | null;
  size?: number;
};

/** Square logo with rounded corners; shows the first letter when there is no image. */
export function CompanyLogo({ name, uri, size = 56 }: Props) {
  const box = { width: size, height: size, borderRadius: size * 0.24 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, box]} contentFit="contain" accessibilityLabel={name ?? undefined} />;
  }
  const initial = Array.from((name ?? '').trim())[0]?.toUpperCase() ?? '?';
  return (
    <View style={[styles.fallback, box]} accessibilityLabel={name ?? undefined}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  fallback: { backgroundColor: colors.tintBlue, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.heading, color: colors.accent },
});
