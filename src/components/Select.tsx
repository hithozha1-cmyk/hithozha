import { Check, ChevronDown, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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

/** Long lists (e.g. the 346 service subcategories) get a search box; short ones don't need it. */
const SEARCH_THRESHOLD = 8;

export function Select({ label, placeholder, value, options, onChange, error }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const showSearch = options.length > SEARCH_THRESHOLD;
  const filtered = useMemo(
    () => (showSearch && query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options),
    [options, query, showSearch],
  );

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

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setOpen(false);
          setQuery('');
        }}
      >
        <Pressable
          accessibilityLabel={t('common.cancel')}
          style={styles.backdrop}
          onPress={() => {
            setOpen(false);
            setQuery('');
          }}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.sheetTitle}>{label ?? placeholder}</Text>
          {showSearch ? (
            <View style={styles.searchRow}>
              <Search size={18} color={colors.muted} strokeWidth={1.8} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('common.search')}
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                accessibilityLabel={t('common.search')}
                autoCorrect={false}
              />
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                    setQuery('');
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.background,
  },
  searchInput: { ...type.body, color: colors.text, flex: 1, paddingVertical: 0 },
  option: {
    minHeight: layout.minTouch + 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
