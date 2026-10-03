import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChips } from '@/components/FilterChips';
import { Input } from '@/components/Input';
import { StatusChip } from '@/components/StatusChip';
import { useCategories } from '@/hooks/useCategories';
import { saveCategory } from '@/lib/admin';
import { categoryIcon } from '@/lib/categoryIcons';
import type { Category } from '@/lib/types';
import { colors, type } from '@/theme';

import { Empty, ErrorLine, Loading } from './ui';

const ICONS = ['video', 'monitor', 'pen-tool', 'megaphone', 'camera', 'book-open', 'file-text', 'mic', 'shapes'];
const SLUG = /^[a-z0-9-]{2,40}$/;

type Draft = { id: string | null; slug: string; nameEn: string; nameTa: string; icon: string; sort: string; active: boolean };
const BLANK: Draft = { id: null, slug: '', nameEn: '', nameTa: '', icon: 'shapes', sort: '99', active: true };

function Editor({ draft, onDone }: { draft: Draft; onDone: (saved: boolean) => void }) {
  const { t } = useTranslation();
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((previous) => ({ ...previous, [key]: value }));

  const save = async () => {
    if (!SLUG.test(d.slug) || d.nameEn.trim().length < 2 || d.nameTa.trim().length < 2) {
      setError(t('admin.categories.invalid'));
      return;
    }
    setBusy(true);
    setError(null);
    const r = await saveCategory({ id: d.id, slug: d.slug, nameEn: d.nameEn.trim(), nameTa: d.nameTa.trim(), icon: d.icon, sort: Number.parseInt(d.sort, 10) || 0, active: d.active });
    setBusy(false);
    if (r.ok) onDone(true);
    else setError(t('admin.failed'));
  };

  return (
    <Card style={styles.card}>
      <Input label={t('admin.categories.slug')} value={d.slug} onChangeText={(v) => set('slug', v.toLowerCase())} autoCapitalize="none" autoCorrect={false} />
      <Input label={t('admin.categories.nameEn')} value={d.nameEn} onChangeText={(v) => set('nameEn', v)} />
      <Input label={t('admin.categories.nameTa')} value={d.nameTa} onChangeText={(v) => set('nameTa', v)} />
      <Input label={t('admin.categories.sort')} value={d.sort} onChangeText={(v) => set('sort', v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
      <FilterChips accessibilityLabel={t('admin.categories.icon')} selected={d.icon} onChange={(v) => set('icon', v ?? 'shapes')} options={ICONS.map((value) => ({ value, label: value }))} />
      <View style={styles.switchRow}>
        <Text style={styles.name}>{t('admin.categories.active')}</Text>
        <Switch value={d.active} onValueChange={(v) => set('active', v)} accessibilityLabel={t('admin.categories.active')} />
      </View>
      <ErrorLine text={error} />
      <Button title={t('admin.categories.save')} onPress={() => void save()} loading={busy} />
      <Button variant="outline" title={t('common.cancel')} onPress={() => onDone(false)} disabled={busy} />
    </Card>
  );
}

export function Categories() {
  const { t, i18n } = useTranslation();
  const { categories, loading, error, reload } = useCategories(true);
  const [editing, setEditing] = useState<Draft | null>(null);

  const finish = (saved: boolean) => {
    setEditing(null);
    if (saved) void reload();
  };
  const edit = (c: Category) =>
    setEditing({ id: c.id, slug: c.slug, nameEn: c.name_en, nameTa: c.name_ta, icon: c.icon, sort: String(c.sort_order), active: c.is_active !== false });

  if (editing) return <Editor draft={editing} onDone={finish} />;

  return (
    <View style={styles.wrap}>
      <Text style={styles.sub}>{t('admin.categories.hint')}</Text>
      <Button title={t('admin.categories.add')} onPress={() => setEditing(BLANK)} />
      {error ? <ErrorLine text={t('admin.failed')} /> : null}
      {loading ? <Loading /> : null}
      {categories.map((c) => {
        const Icon = categoryIcon(c.icon);
        return (
          <Card key={c.id} style={styles.row}>
            <Icon size={22} color={colors.accent} strokeWidth={2} />
            <View style={styles.rowText}>
              <Text style={styles.name}>{i18n.language === 'ta' ? c.name_ta : c.name_en}</Text>
              <Text style={styles.sub}>{c.name_en} · {c.name_ta} · {c.slug}</Text>
            </View>
            {c.is_active === false ? <StatusChip label={t('admin.categories.hidden')} /> : null}
            <Button variant="outline" title={t('admin.categories.edit')} onPress={() => edit(c)} style={styles.editButton} />
          </Card>
        );
      })}
      {!loading && categories.length === 0 && !error ? <Empty text={t('admin.nothing')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...type.bodyStrong, color: colors.text },
  sub: { ...type.small, color: colors.muted },
  editButton: { minHeight: 44, paddingHorizontal: 14 },
});
