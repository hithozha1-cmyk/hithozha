import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useWide } from '@/hooks/useWide';

/** Scale the whole website down on desktop so the mobile-tuned UI doesn't look oversized. Mobile (web or native) is never touched. */
const DESKTOP_SCALE = '0.85';

export function DesktopScale() {
  const wide = useWide();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.zoom = wide ? DESKTOP_SCALE : '1';
  }, [wide]);

  return null;
}
