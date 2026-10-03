import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, layout } from '@/theme';

type Props = {
  children: ReactNode;
  /** Wrap the content in a scroll view (default true). */
  scroll?: boolean;
  /** Apply the standard horizontal padding (default true). */
  padded?: boolean;
  /** Pinned below the content, above the keyboard. */
  footer?: ReactNode;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll = true, padded = true, footer, edges, contentStyle }: Props) {
  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, padded && styles.padded, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, padded && styles.padded, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.root} edges={edges ?? ['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {body}
        {footer ? <View style={[styles.footer, padded && styles.padded]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingTop: 16, paddingBottom: 24 },
  padded: { paddingHorizontal: layout.screenPadding },
  footer: { paddingTop: 12, paddingBottom: 16 },
});
