import type { ViewStyle } from 'react-native';

// Barely-there elevation, in the Stripe/Linear vein: depth as a hint, never a drop shadow.
export const shadows = {
  soft: {
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  medium: {
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
} satisfies Record<string, ViewStyle>;
