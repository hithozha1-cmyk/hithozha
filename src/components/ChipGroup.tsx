import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, type } from '@/theme';

export type ChipOption = { value: string; label: string };

type Props = {
  options: ChipOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

export function ChipGroup({ options, selected, onChange }: Props) {
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            onPress={() => toggle(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[type.label, { color: active ? colors.onDark : colors.text }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.night, borderColor: colors.night },
});
