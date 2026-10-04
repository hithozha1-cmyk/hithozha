import {
  AnekTamil_600SemiBold,
  AnekTamil_700Bold,
  AnekTamil_800ExtraBold,
} from '@expo-google-fonts/anek-tamil';
import { HindMadurai_400Regular, HindMadurai_500Medium, HindMadurai_600SemiBold } from '@expo-google-fonts/hind-madurai';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PushSetup } from '@/components/PushSetup';
import { Screen } from '@/components/Screen';
import '@/i18n';
import { loadStoredLanguage } from '@/i18n';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { WifiOff } from 'lucide-react-native';

void SplashScreen.preventAutoHideAsync();

function Gate({ ready }: { ready: boolean }) {
  const { t } = useTranslation();
  const { signedIn, loading, profileError, onboarded, needsVerification, refreshProfile } = useAuth();
  const settled = ready && !loading;

  useEffect(() => {
    if (settled || (ready && profileError)) {
      void SplashScreen.hideAsync();
    }
  }, [settled, ready, profileError]);

  if (!ready) return null;

  if (signedIn && profileError) {
    return (
      <Screen scroll={false} footer={<Button title={t('common.retry')} onPress={() => void refreshProfile()} />}>
        <EmptyState icon={WifiOff} title={t('profile.loadFailedTitle')} message={t('profile.loadFailedBody')} />
      </Screen>
    );
  }

  if (loading) return null;

  return (
    <>
      <PushSetup />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded && needsVerification}>
          <Stack.Screen name="verification" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded && !needsVerification}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="company/[id]" />
          <Stack.Screen name="company/edit" />
          <Stack.Screen name="company/verify" />
          <Stack.Screen name="jobs/new" />
          <Stack.Screen name="jobs/[id]" />
          <Stack.Screen name="jobs/apply/[id]" />
          <Stack.Screen name="jobs/proposals/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="orders/[id]" />
          <Stack.Screen name="orders/review/[id]" />
          <Stack.Screen name="freelancer/[id]" />
          <Stack.Screen name="account/edit-profile" />
          <Stack.Screen name="account/freelancer" />
          <Stack.Screen name="account/earnings" />
          <Stack.Screen name="account/packages" />
          <Stack.Screen name="account/verify-identity" />
          <Stack.Screen name="jobs/mine" />
          <Stack.Screen name="jobs/edit/[id]" />
          <Stack.Screen name="notifications" />
        </Stack.Protected>
        {/*
          Public: Razorpay and new visitors can read these without an account. Keep this LAST: on a phone
          (no web address to go by) the app opens the first screen that is allowed, so listing it first
          made every signed-out visitor land on the Terms page with nowhere to go back to.
        */}
        <Stack.Screen name="legal/[page]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    AnekTamil_600SemiBold,
    AnekTamil_700Bold,
    AnekTamil_800ExtraBold,
    HindMadurai_400Regular,
    HindMadurai_500Medium,
    HindMadurai_600SemiBold,
  });
  const [languageLoaded, setLanguageLoaded] = useState(false);

  useEffect(() => {
    void loadStoredLanguage().finally(() => setLanguageLoaded(true));
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Gate ready={fontsLoaded && languageLoaded} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
