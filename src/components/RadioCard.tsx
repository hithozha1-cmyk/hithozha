import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, type } from '@/theme';

type Props = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
};

export function RadioCard({ title, description, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.selected]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.dot} /> : null}
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    minHeight: 60,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  selected: { borderColor: colors.primary },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioSelected: { borderColor: colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  text: { flex: 1, gap: 4 },
  title: { ...type.subheading, color: colors.text },
  description: { ...type.small, color: colors.muted },
});
