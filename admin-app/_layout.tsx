import { AnekTamil_600SemiBold, AnekTamil_700Bold, AnekTamil_800ExtraBold } from '@expo-google-fonts/anek-tamil';
import { HindMadurai_400Regular, HindMadurai_500Medium, HindMadurai_600SemiBold } from '@expo-google-fonts/hind-madurai';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Enrol, NotAdmin, SignIn, Verify } from '@/admin/Access';
import { useAdminAccess } from '@/admin/adminAccess';
import '@/i18n';

/**
 * The admin site is a separate build of this project (see app.config.js and the README). It has
 * one screen, shown only to a signed-in admin who has also entered an authenticator code, and it
 * ships none of the public app's screens. Every admin action is still checked by the database.
 */
export default function AdminLayout() {
  const [fontsLoaded] = useFonts({
    AnekTamil_600SemiBold,
    AnekTamil_700Bold,
    AnekTamil_800ExtraBold,
    HindMadurai_400Regular,
    HindMadurai_500Medium,
    HindMadurai_600SemiBold,
  });
  const { access, factorId, reevaluate, signOut } = useAdminAccess();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.title = 'Hithozha admin';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  if (!fontsLoaded || access === 'loading') return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {access === 'signedOut' ? <SignIn /> : null}
      {access === 'notAdmin' ? <NotAdmin onSignOut={() => void signOut()} /> : null}
      {access === 'enrol' ? <Enrol onDone={() => void reevaluate()} onSignOut={() => void signOut()} /> : null}
      {access === 'verify' && factorId ? <Verify factorId={factorId} onDone={() => void reevaluate()} onSignOut={() => void signOut()} /> : null}
      {access === 'ready' ? (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
        </Stack>
      ) : null}
    </SafeAreaProvider>
  );
}
