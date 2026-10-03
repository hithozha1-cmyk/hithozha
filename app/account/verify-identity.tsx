import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IdentityPanel } from '@/components/IdentityPanel';
import { Screen } from '@/components/Screen';
import { colors, type } from '@/theme';

/** Identity check from the Profile tab (for people who can already use the app). */
export default function VerifyIdentityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title}>{t('identity.title')}</Text>
      <Text style={styles.body}>{t('identity.intro')}</Text>
      <IdentityPanel />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 8 },
  body: { ...type.body, color: colors.muted, marginTop: 8 },
});
