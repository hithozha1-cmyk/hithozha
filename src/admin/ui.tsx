import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { ReasonAction } from '@/components/ReasonAction';
import { PAGE_SIZE, type Result } from '@/lib/admin';
import { colors, radius, type } from '@/theme';

/** Formats a timestamp for the admin lists in the person's language. */
export function useWhen() {
  const { i18n } = useTranslation();
  return (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
}

/** Loads a list a page at a time. Search or filter changes pass new deps and start again from the top. */
export function usePaged<T>(fetchPage: (offset: number) => Promise<Result<T[]>>, deps: unknown[]) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const latest = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(async (append: boolean, from: number) => {
    const ticket = ++latest.current;
    setLoading(true);
    const result = await fetchRef.current(from);
    if (ticket !== latest.current) return;
    if (!result.ok) {
      setFailed(true);
    } else {
      setFailed(false);
      setItems((previous) => (append ? [...previous, ...result.data] : result.data));
      setMore(result.data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(false, 0), deps);

  return {
    items,
    loading,
    failed,
    more,
    reload: () => load(false, 0),
    loadMore: () => load(true, items.length),
  };
}

export function Loading() {
  return <ActivityIndicator color={colors.primary} style={styles.loader} />;
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {text}
    </Text>
  ) : null;
}

export function LoadMore({ more, loading, onPress }: { more: boolean; loading: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return more ? <Button variant="outline" title={t('admin.loadMore')} onPress={onPress} loading={loading} /> : null;
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 40 },
  empty: { ...type.body, color: colors.muted, textAlign: 'center', paddingVertical: 40 },
  error: { ...type.small, color: colors.danger },
  field: { gap: 2 },
  fieldLabel: { ...type.caption, color: colors.muted },
  fieldValue: { ...type.body, color: colors.text },
});

export { ReasonAction };
