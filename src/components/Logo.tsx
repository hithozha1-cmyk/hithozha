import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

type Props = {
  onDark?: boolean;
  size?: number;
};

export function Logo({ onDark = false, size = 28 }: Props) {
  return (
    <View accessibilityRole="image" accessibilityLabel="hithozha" style={styles.row}>
      <Text style={[styles.text, { fontSize: size, color: onDark ? colors.onDark : colors.night }]}>hi</Text>
      <Text style={[styles.text, { fontSize: size, color: colors.brand }]}>thozha</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  text: { fontFamily: fonts.headingHeavy, letterSpacing: -0.5 },
});
