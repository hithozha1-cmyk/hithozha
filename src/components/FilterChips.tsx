import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, layout, radius, type } from '@/theme';

export type FilterOption = { value: string | null; label: string };

type Props = {
  options: FilterOption[];
  selected: string | null;
  onChange: (value: string | null) => void;
  accessibilityLabel: string;
};

/** A scrolling row where exactly one option is picked; `null` means "all". */
export function FilterChips({ options, selected, onChange, accessibilityLabel }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value ?? 'all'}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[type.label, { color: active ? colors.onDark : colors.text }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: layout.screenPadding },
  chip: {
    minHeight: 40,
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
