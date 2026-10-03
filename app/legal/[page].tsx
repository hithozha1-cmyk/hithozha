import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/Screen';
import { currentLanguage } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { BUSINESS, LEGAL_PAGES, legalContent, type LegalPage } from '@/legal/content';
import { colors, type } from '@/theme';

/** Terms, privacy, refunds and contact. Public: readable without signing in. */
export default function LegalScreen() {
  const { t } = useTranslation(); // re-renders when the language changes
  const router = useRouter();
  const { signedIn } = useAuth();
  const { page } = useLocalSearchParams<{ page: string }>();
  const key = (LEGAL_PAGES as string[]).includes(page) ? (page as LegalPage) : 'terms';
  const content = legalContent[currentLanguage()][key];

  // Signed-out people have no home screen to return to, so send them to the welcome screen.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(signedIn ? '/' : '/welcome'));

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title}>{content.title}</Text>

      <View style={styles.sections}>
        {content.sections.map(([heading, body]) => (
          <View key={heading} style={styles.section}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}

        {key === 'contact' ? (
          <View style={styles.section}>
            <Text style={styles.heading}>{BUSINESS.name}</Text>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${BUSINESS.email}`)} style={styles.linkRow}>
              <Text style={styles.link}>{BUSINESS.email}</Text>
            </Pressable>
            {BUSINESS.phone ? <Text style={styles.body}>{BUSINESS.phone}</Text> : null}
            {BUSINESS.address ? <Text style={styles.body}>{BUSINESS.address}</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.others}>
        {LEGAL_PAGES.filter((other) => other !== key).map((other) => (
          <Pressable key={other} accessibilityRole="link" onPress={() => router.replace({ pathname: '/legal/[page]', params: { page: other } })} style={styles.linkRow}>
            <Text style={styles.link}>{legalContent[currentLanguage()][other].title}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 12, paddingBottom: 8 },
  sections: { gap: 20, marginTop: 8 },
  section: { gap: 6 },
  heading: { ...type.subheading, color: colors.text },
  body: { ...type.body, color: colors.text },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  link: { ...type.bodyStrong, color: colors.primary },
  others: { marginTop: 28, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
});
