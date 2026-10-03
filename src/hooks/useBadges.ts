import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { NO_BADGES, fetchBadges, onBadgesChanged, type Badges } from '@/lib/badges';
import { supabase } from '@/lib/supabase';

/** Live counts for the tab badges: refreshed on new messages, order changes and app resume. */
export function useBadges(): Badges {
  const [badges, setBadges] = useState<Badges>(NO_BADGES);

  const refresh = useCallback(() => {
    void fetchBadges().then(setBadges);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('tab-badges')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh)
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    const stopListening = onBadgesChanged(refresh);
    return () => {
      void supabase.removeChannel(channel);
      appState.remove();
      stopListening();
    };
  }, [refresh]);

  return badges;
}
