import { LogOut } from 'lucide-react-native';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { IdentityPanel } from '@/components/IdentityPanel';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

/**
 * The holding screen for a new freelancer: send the ID photo and selfie, then wait here until an
 * admin decides. An approval email arrives and this screen lets them in by itself; a rejection
 * email explains why and they can send new photos.
 */
export default function VerificationGateScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  return (
    <Screen footer={<Button variant="outline" title={t('profile.signOut')} icon={<LogOut size={20} color={colors.text} strokeWidth={1.8} />} onPress={() => void signOut()} />}>
      <Text style={styles.title}>{t('identity.gateTitle')}</Text>
      <Text style={styles.body}>{t('identity.gateIntro')}</Text>
      <IdentityPanel />
      <LanguagePicker />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: colors.text, paddingTop: 8 },
  body: { ...type.body, color: colors.muted, marginTop: 8 },
});
