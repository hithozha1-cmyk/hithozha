import { useFocusEffect, useRouter } from 'expo-router';
import { MessageCircle, WifiOff } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { fetchConversations, type Conversation } from '@/lib/chat';
import { useAuth } from '@/providers/AuthProvider';
import { colors, layout, radius, type } from '@/theme';

function ConversationRow({ conversation, userId }: { conversation: Conversation; userId: string }) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const other = conversation.client_id === userId ? conversation.freelancer : conversation.client;
  const when = conversation.last_message_at
    ? new Date(conversation.last_message_at).toLocaleDateString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short' })
    : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={other?.full_name ?? ''}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: conversation.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar name={other?.full_name} uri={other?.avatar_url} size={48} />
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {other?.full_name}
          </Text>
          <Text style={styles.when}>{when}</Text>
        </View>
        <Text style={styles.job} numberOfLines={1}>
          {conversation.job?.title}
        </Text>
        {conversation.lastMessage ? (
          <Text style={styles.preview} numberOfLines={1}>
            {conversation.lastMessage}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    const result = await fetchConversations();
    setFailed(result === null);
    if (result) setConversations(result);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const empty = failed ? (
    <EmptyState icon={WifiOff} title={t('messages.errorTitle')} message={t('common.genericError')} />
  ) : (
    <EmptyState icon={MessageCircle} title={t('messages.emptyTitle')} message={t('messages.emptyBody')} />
  );

  return (
    <Screen scroll={false} edges={['top']} padded={false}>
      <Text style={styles.title}>{t('tabs.messages')}</Text>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationRow conversation={item} userId={userId} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.list}
          onRefresh={() => void load(true)}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: colors.text, paddingHorizontal: layout.screenPadding, paddingTop: 16, paddingBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, paddingHorizontal: layout.screenPadding, paddingBottom: 24 },
  separator: { height: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    minHeight: 72,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pressed: { backgroundColor: colors.background },
  rowText: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { ...type.subheading, color: colors.text, flex: 1 },
  when: { ...type.caption, color: colors.muted },
  job: { ...type.small, color: colors.accent },
  preview: { ...type.small, color: colors.muted },
});
