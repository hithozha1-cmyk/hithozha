import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import {
  fetchFlaggedMessages,
  fetchPayoutsDue,
  fetchPendingCompanies,
  markPaidOut,
  setCompanyVerification,
  type FlaggedMessage,
  type PayoutDue,
  type PendingCompany,
} from '@/lib/admin';
import { formatINR } from '@/lib/money';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, type } from '@/theme';

type Tab = 'companies' | 'chats' | 'payouts';
const TABS: Tab[] = ['companies', 'chats', 'payouts'];

/** For admins only: verify companies, read flagged chats, and record freelancer payouts. */
export default function AdminScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('companies');
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [chats, setChats] = useState<FlaggedMessage[]>([]);
  const [payouts, setPayouts] = useState<PayoutDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([fetchPendingCompanies(), fetchFlaggedMessages(), fetchPayoutsDue()]);
    setCompanies(a ?? []);
    setChats(b ?? []);
    setPayouts(c ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) void load();
    }, [isAdmin, load]),
  );

  if (!isAdmin) return <Redirect href="/" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const act = (id: string, task: () => Promise<boolean>) => {
    setBusyId(id);
    setError(null);
    void task().then(async (ok) => {
      if (!ok) setError(t('admin.failed'));
      await load();
      setBusyId(null);
    });
  };
  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const counts: Record<Tab, number> = { companies: companies.length, chats: chats.length, payouts: payouts.length };

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title}>{t('admin.title')}</Text>

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>
              {t(`admin.tabs.${value}`)} ({counts[value]})
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.list}>
          {tab === 'companies' &&
            companies.map((c) => (
              <Card key={c.id} style={styles.card}>
                <Text style={styles.cardTitle}>{c.name}</Text>
                <Text style={styles.line}>{t('admin.owner', { name: c.owner_name ?? '' })}</Text>
                {c.gst_number ? <Text style={styles.line}>{t('company.verify.submittedGst', { value: c.gst_number })}</Text> : null}
                {c.udyam_number ? <Text style={styles.line}>{t('company.verify.submittedUdyam', { value: c.udyam_number })}</Text> : null}
                <Button title={t('admin.verify')} onPress={() => act(c.id, () => setCompanyVerification(c.id, 'verified'))} loading={busyId === c.id} />
                <Button variant="outline" title={t('admin.reject')} onPress={() => act(c.id, () => setCompanyVerification(c.id, 'rejected'))} disabled={busyId === c.id} />
              </Card>
            ))}

          {tab === 'chats' &&
            chats.map((m) => (
              <Card key={m.id} style={styles.card}>
                <Text style={styles.cardTitle}>{m.sender_name}</Text>
                <Text style={styles.line}>{m.violation_types.join(', ')} · {when(m.created_at)}</Text>
                <Text style={styles.quote}>{m.original_body}</Text>
              </Card>
            ))}

          {tab === 'payouts' &&
            payouts.map((p) => (
              <Card key={p.order_id} style={styles.card}>
                <Text style={styles.cardTitle}>{t('admin.payoutLine', { amount: formatINR(p.earnings_paise), name: p.freelancer_name ?? '' })}</Text>
                <Text style={styles.line}>{p.title}</Text>
                <Button title={t('admin.markPaid')} onPress={() => act(p.order_id, () => markPaidOut(p.order_id))} loading={busyId === p.order_id} />
              </Card>
            ))}

          {counts[tab] === 0 ? <Text style={styles.empty}>{t('admin.nothing')}</Text> : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 12, paddingBottom: 14 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: radius.card, backgroundColor: '#E8E8EF', gap: 4 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: colors.card },
  tabText: { ...type.caption, color: colors.muted, textAlign: 'center' },
  tabTextActive: { color: colors.text },
  loader: { marginTop: 40 },
  list: { gap: 12, marginTop: 16 },
  card: { gap: 8 },
  cardTitle: { ...type.subheading, color: colors.text },
  line: { ...type.small, color: colors.muted },
  quote: { ...type.body, color: colors.text, backgroundColor: colors.tintRedSoft, padding: 12, borderRadius: radius.input },
  empty: { ...type.body, color: colors.muted, textAlign: 'center', paddingVertical: 40 },
  error: { ...type.small, color: colors.danger, marginTop: 12 },
});
