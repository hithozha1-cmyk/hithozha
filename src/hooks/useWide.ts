import { Platform, useWindowDimensions } from 'react-native';

/** Window width from which the website switches to its desktop layout. Phones never do. */
export const WIDE_BREAKPOINT = 900;

/** True on the website when the window is wide enough for the desktop layout. */
export function useWide(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
}
