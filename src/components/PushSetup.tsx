import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { hrefFromPushData, registerForPush, showPushesWhileOpen } from '@/lib/push';
import { useAuth } from '@/providers/AuthProvider';

function NativePushSetup() {
  const router = useRouter();
  const { signedIn, onboarded, needsVerification } = useAuth();
  const handled = useRef<string | null>(null);
  const lastResponse = Notifications.useLastNotificationResponse();
  const ready = signedIn && onboarded;

  useEffect(() => {
    showPushesWhileOpen();
  }, []);

  // Ask for permission and register this phone once the person is inside the app.
  useEffect(() => {
    if (ready) void registerForPush();
  }, [ready]);

  // Tapping a push (even one that opened the app from closed) goes to the right screen.
  useEffect(() => {
    if (!ready || needsVerification || !lastResponse) return;
    const id = lastResponse.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const href = hrefFromPushData(lastResponse.notification.request.content.data);
    if (href) router.push(href);
  }, [ready, needsVerification, lastResponse, router]);

  return null;
}

/** Phone push: registers this phone and handles taps. Does nothing on the website. */
export function PushSetup() {
  return Platform.OS === 'web' ? null : <NativePushSetup />;
}
