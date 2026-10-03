import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, layout, radius, type } from '@/theme';

export type SelectOption = { value: string; label: string };

type Props = {
  label?: string;
  placeholder: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string | null;
};

export function Select({ label, placeholder, value, options, onChange, error }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        accessibilityValue={{ text: selected?.label }}
        onPress={() => setOpen(true)}
        style={[styles.field, !!error && styles.errored]}
      >
        <Text style={[type.body, { color: selected ? colors.text : colors.muted, flex: 1 }]}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={20} color={colors.muted} strokeWidth={1.8} />
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel={t('common.cancel')} style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.sheetTitle}>{label ?? placeholder}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.background }]}
                >
                  <Text style={[type.body, { color: colors.text, flex: 1 }, active && { fontFamily: type.bodyStrong.fontFamily }]}>
                    {item.label}
                  </Text>
                  {active ? <Check size={20} color={colors.primary} strokeWidth={2.2} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { ...type.label, color: colors.text },
  field: {
    minHeight: layout.inputHeight,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errored: { borderColor: colors.danger },
  error: { ...type.small, color: colors.danger },
  backdrop: { flex: 1, backgroundColor: 'rgba(26,26,46,0.45)' },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    paddingTop: 16,
  },
  sheetTitle: { ...type.subheading, color: colors.text, paddingHorizontal: 20, paddingBottom: 8 },
  option: {
    minHeight: layout.minTouch + 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
