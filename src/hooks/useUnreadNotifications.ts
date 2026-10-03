import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { fetchUnreadCount, onUnreadChanged, subscribeToNotifications } from '@/lib/notifications';
import { useAuth } from '@/providers/AuthProvider';

/** The number on the bell: updates live as notifications arrive and when the app comes back to the front. */
export function useUnreadNotifications(): number {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    void fetchUnreadCount().then(setCount);
  }, []);

  useEffect(() => {
    if (!userId) return;
    refresh();
    const stopRealtime = subscribeToNotifications(userId, refresh);
    const appState = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    const stopListening = onUnreadChanged(refresh);
    return () => {
      stopRealtime();
      appState.remove();
      stopListening();
    };
  }, [userId, refresh]);

  return count;
}
