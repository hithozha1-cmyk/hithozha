import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { Platform } from 'react-native';

import { NOTIFICATION_KINDS, notificationHref, type NotificationKind } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

export type PushResult = 'registered' | 'unsupported' | 'denied' | 'no_project' | 'error';

// The token this phone registered, so signing out can take it back.
let registeredToken: string | null = null;

/** How a push is shown while the app is open: as a banner, like any other app. */
export function showPushesWhileOpen(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export type PushOutcome = { result: PushResult; detail?: string };

const shorten = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, 60);

/**
 * Asks permission (once), gets this phone's push token and gives it to the database.
 * Does nothing on the website or an emulator, and never throws: push is a bonus, not a requirement.
 * The outcome says what happened, so the Profile screen can tell the person what to fix.
 */
export async function registerForPushDetailed(): Promise<PushOutcome> {
  if (Platform.OS === 'web' || !Device.isDevice) return { result: 'unsupported' };
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Hithozha',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return { result: 'denied' };

    let token: string;
    if (Platform.OS === 'android') {
      // Android: the phone's own Firebase (FCM) token; send-push talks to Firebase directly.
      const device = await Notifications.getDevicePushTokenAsync();
      if (typeof device.data !== 'string') return { result: 'error', detail: 'token type' };
      token = device.data;
    } else {
      // iPhone (later): an Expo push token, which needs the Expo project id.
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return { result: 'no_project' };
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    }
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    if (error) return { result: 'error', detail: `database ${error.code ?? error.message.slice(0, 40)}` };
    registeredToken = token;
    return { result: 'registered' };
  } catch (error) {
    return { result: 'error', detail: shorten(error) };
  }
}

export const registerForPush = async (): Promise<PushResult> => (await registerForPushDetailed()).result;

/** Stops pushes to this phone for the person who is signing out. */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  try {
    await supabase.rpc('unregister_push_token', { p_token: token });
  } catch {
    /* signing out must never be blocked by this */
  }
}

/** Where tapping a push should go. The payload is sent by our server, but it is still checked. */
export function hrefFromPushData(data: unknown): Href | null {
  if (!data || typeof data !== 'object') return null;
  const { kind, ...rest } = data as Record<string, unknown>;
  if (typeof kind !== 'string' || !(NOTIFICATION_KINDS as readonly string[]).includes(kind)) return null;
  return notificationHref({ kind: kind as NotificationKind, data: rest });
}
