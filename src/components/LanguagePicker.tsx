import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RadioCard } from '@/components/RadioCard';
import { useAuth } from '@/providers/AuthProvider';
import { currentLanguage, setAppLanguage } from '@/i18n';
import type { Language } from '@/lib/types';

const LANGUAGES: Language[] = ['ta', 'en'];

/** Switches the app language; also saves it to the profile when signed in. */
export function LanguagePicker() {
  const { t } = useTranslation();
  const { session, changeLanguage } = useAuth();
  const active = currentLanguage();

  const choose = (language: Language) => {
    if (session) {
      void changeLanguage(language);
    } else {
      void setAppLanguage(language);
    }
  };

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {LANGUAGES.map((language) => (
        <View key={language} style={styles.cell}>
          <RadioCard title={t(`language.${language}`)} selected={active === language} onPress={() => choose(language)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1 },
});
