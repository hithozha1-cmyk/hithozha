import { Stack } from 'expo-router';

import { OnboardingDraftProvider } from '@/providers/OnboardingDraft';

export default function OnboardingLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="role" />
        <Stack.Screen name="client-type" />
        <Stack.Screen name="company-profile" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="professional" />
      </Stack>
    </OnboardingDraftProvider>
  );
}
