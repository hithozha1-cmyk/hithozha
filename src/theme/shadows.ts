import type { ViewStyle } from 'react-native';

// Elevation this app never had before: surfaces visibly lift off the background instead of
// relying on a border to separate them.
export const shadows = {
  soft: {
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  medium: {
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.24,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 9,
  },
} satisfies Record<string, ViewStyle>;
