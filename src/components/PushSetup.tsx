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
    // Pushes sent straight through Firebase carry our fields in remoteMessage.data.
    const { content, trigger } = lastResponse.notification.request;
    const remote = (trigger as { remoteMessage?: { data?: unknown } } | null)?.remoteMessage?.data;
    const href = hrefFromPushData(content.data && Object.keys(content.data).length > 0 ? content.data : remote);
    if (href) router.push(href);
  }, [ready, needsVerification, lastResponse, router]);

  return null;
}

/** Phone push: registers this phone and handles taps. Does nothing on the website. */
export function PushSetup() {
  return Platform.OS === 'web' ? null : <NativePushSetup />;
}
