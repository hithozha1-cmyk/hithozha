import type { TextStyle } from 'react-native';

export const fonts = {
  headingSemi: 'AnekTamil_600SemiBold',
  heading: 'AnekTamil_700Bold',
  headingHeavy: 'AnekTamil_800ExtraBold',
  body: 'HindMadurai_400Regular',
  bodyMedium: 'HindMadurai_500Medium',
  bodySemi: 'HindMadurai_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 42 },
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 36 },
  heading: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 30 },
  subheading: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 26 },
  button: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;
