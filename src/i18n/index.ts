import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { Language } from '@/lib/types';
import en from './en.json';
import ta from './ta.json';

const STORAGE_KEY = 'hz.language';
const DEFAULT_LANGUAGE: Language = 'ta';

export const isLanguage = (value: unknown): value is Language => value === 'ta' || value === 'en';

void i18n.use(initReactI18next).init({
  resources: { ta: { translation: ta }, en: { translation: en } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

// True when the user picked a language on this device (as opposed to the default).
let explicitChoice = false;

export async function loadStoredLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) {
      explicitChoice = true;
      await i18n.changeLanguage(stored);
    }
  } catch {
    // Storage unavailable: keep the default language.
  }
}

export const hasExplicitLanguage = (): boolean => explicitChoice;

export async function setAppLanguage(language: Language): Promise<void> {
  explicitChoice = true;
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, language);
  } catch {
    // The in-memory choice still applies for this session.
  }
}

export const currentLanguage = (): Language => (isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE);

export default i18n;
