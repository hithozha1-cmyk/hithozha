import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, type } from '@/theme';

type Props = {
  icon: LucideIcon;
  title: string;
  message: string;
};

export function EmptyState({ icon: Icon, title, message }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.iconBox}>
        <Icon size={32} color={colors.accent} strokeWidth={1.7} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.tintBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: { ...type.heading, color: colors.text, textAlign: 'center' },
  message: { ...type.body, color: colors.muted, textAlign: 'center' },
});
