import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronLeft, FileText, Paperclip, Send, ShieldCheck, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { markConversationRead } from '@/lib/badges';
import {
  fetchConversation,
  fetchMessages,
  sendMessage,
  subscribeToMessages,
  type Conversation,
  type Message,
  type OutgoingFile,
} from '@/lib/chat';
import { chatFileUrl, pickChatFile, uploadChatFile } from '@/lib/chatFiles';
import { useAuth } from '@/providers/AuthProvider';
import { colors, layout, radius, type } from '@/theme';

const MAX_LENGTH = 2000;

const formatBytes = (bytes: number): string => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

function Attachment({ message, mine }: { message: Message; mine: boolean }) {
  const { t } = useTranslation();
  const [opening, setOpening] = useState(false);
  const path = message.file_path;
  if (!path) return null;

  const open = async () => {
    setOpening(true);
    const url = await chatFileUrl(path);
    setOpening(false);
    if (url) await WebBrowser.openBrowserAsync(url);
  };

  return (
    <Pressable accessibilityRole="button" onPress={() => void open()} disabled={opening} style={[styles.file, mine ? styles.fileMine : styles.fileTheirs]}>
      <FileText size={22} color={mine ? colors.onDark : colors.text} strokeWidth={1.8} />
      <View style={styles.fileText}>
        <Text style={[styles.fileName, { color: mine ? colors.onDark : colors.text }]} numberOfLines={1}>
          {message.file_name}
        </Text>
        <Text style={[styles.fileMeta, { color: mine ? colors.onDarkMuted : colors.muted }]}>
          {opening ? t('chat.opening') : message.file_size ? formatBytes(message.file_size) : ''}
        </Text>
      </View>
    </Pressable>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Attachment message={message} mine={mine} />
        {message.body ? <Text style={[styles.bubbleText, { color: mine ? colors.onDark : colors.text }]}>{message.body}</Text> : null}
        {message.was_redacted ? (
          <Text style={[styles.redacted, { color: mine ? colors.onDarkMuted : colors.muted }]}>{t('chat.redactedBadge')}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [pendingFile, setPendingFile] = useState<OutgoingFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  // New messages can arrive twice (our own send result and the live feed), so merge by id.
  const addMessage = useCallback((incoming: Message) => {
    setMessages((current) => (current.some((m) => m.id === incoming.id) ? current : [...current, incoming]));
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchConversation(id), fetchMessages(id)]).then(([conv, list]) => {
      if (!active) return;
      setConversation(conv);
      setMessages(list ?? []);
      setLoading(false);
    });
    void markConversationRead(id);
    const stop = subscribeToMessages(id, (message) => {
      addMessage(message);
      if (message.sender_id !== userId) void markConversationRead(id);
    });
    return () => {
      active = false;
      stop();
    };
  }, [id, addMessage, userId]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const send = async () => {
    const body = text.trim();
    if ((!body && !pendingFile) || sending) return;
    setSending(true);
    setError(null);
    const saved = await sendMessage(id, body, pendingFile ?? undefined);
    setSending(false);
    if (!saved) {
      setError(t('chat.sendFailed'));
      return;
    }
    setText('');
    setPendingFile(null);
    addMessage(saved);
  };

  const attach = async () => {
    setError(null);
    const picked = await pickChatFile();
    if (picked.status === 'cancelled') return;
    if (picked.status === 'tooLarge') {
      setError(t('chat.attachTooLarge'));
      return;
    }
    if (picked.status === 'error') {
      setError(t('chat.attachFailed'));
      return;
    }
    setAttaching(true);
    const uploaded = await uploadChatFile(id, picked.file);
    setAttaching(false);
    if (uploaded.status === 'error') {
      setError(t('chat.attachFailed'));
      return;
    }
    setPendingFile({ path: uploaded.path, name: uploaded.name, size: uploaded.size, mime: uploaded.mime });
  };

  const other = conversation ? (conversation.client_id === userId ? conversation.freelancer : conversation.client) : null;

  const header = (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      {conversation ? (
        <>
          <Avatar name={other?.full_name} uri={other?.avatar_url} size={40} />
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {other?.full_name}
            </Text>
            <Text style={styles.headerJob} numberOfLines={1}>
              {conversation.job?.title}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <Screen scroll={false} padded={false}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!conversation) {
    return (
      <Screen scroll={false} padded={false}>
        {header}
        <EmptyState icon={ShieldCheck} title={t('chat.notFoundTitle')} message={t('chat.notFoundBody')} />
      </Screen>
    );
  }

  return (
    <Screen
      scroll={false}
      padded={false}
      footer={
        <View style={styles.inputArea}>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {pendingFile ? (
            <View style={styles.pendingFile}>
              <FileText size={18} color={colors.text} strokeWidth={1.8} />
              <Text style={styles.pendingFileName} numberOfLines={1}>
                {pendingFile.name}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('chat.removeAttachment')} onPress={() => setPendingFile(null)} style={styles.pendingFileRemove}>
                <X size={16} color={colors.muted} strokeWidth={2} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chat.attach')}
              disabled={attaching || sending}
              onPress={() => void attach()}
              style={[styles.attachButton, (attaching || sending) && styles.sendDisabled]}
            >
              {attaching ? <ActivityIndicator color={colors.text} /> : <Paperclip size={20} color={colors.text} strokeWidth={2} />}
            </Pressable>
            <TextInput
              accessibilityLabel={t('chat.inputPlaceholder')}
              placeholder={t('chat.inputPlaceholder')}
              placeholderTextColor={colors.muted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={MAX_LENGTH}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              disabled={sending || (text.trim().length === 0 && !pendingFile)}
              onPress={() => void send()}
              style={[styles.sendButton, (sending || (text.trim().length === 0 && !pendingFile)) && styles.sendDisabled]}
            >
              {sending ? <ActivityIndicator color={colors.onDark} /> : <Send size={20} color={colors.onDark} strokeWidth={2} />}
            </Pressable>
          </View>
        </View>
      }
    >
      {header}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Bubble message={item} mine={item.sender_id === userId} />}
        ListHeaderComponent={
          <View style={styles.note} accessibilityRole="text">
            <ShieldCheck size={18} color={colors.accent} strokeWidth={1.9} />
            <Text style={styles.noteText}>{t('chat.safetyNote')}</Text>
          </View>
        }
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 1 },
  headerName: { ...type.subheading, color: colors.text },
  headerJob: { ...type.small, color: colors.muted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: layout.screenPadding, gap: 8, flexGrow: 1 },
  note: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    marginBottom: 8,
    borderRadius: radius.card,
    backgroundColor: colors.tintBlue,
  },
  noteText: { ...type.small, color: colors.accent, flex: 1 },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, gap: 4 },
  bubbleMine: { backgroundColor: colors.night, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { ...type.body },
  redacted: { ...type.caption },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radius.input, backgroundColor: colors.background },
  fileMine: { backgroundColor: 'rgba(255,255,255,0.14)' },
  fileTheirs: { backgroundColor: colors.background },
  fileText: { flex: 1, gap: 1 },
  fileName: { ...type.label },
  fileMeta: { ...type.caption },
  inputArea: { paddingHorizontal: 12, gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, backgroundColor: colors.card },
  pendingFile: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: radius.input, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  pendingFileName: { ...type.small, color: colors.text, flex: 1 },
  pendingFileRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: {
    ...type.body,
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
  },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.5 },
  error: { ...type.small, color: colors.danger },
});
