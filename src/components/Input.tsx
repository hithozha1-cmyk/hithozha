import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, layout, radius, type } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  multiline?: boolean;
  /** Rendered inside the field on the right, e.g. a show/hide button. */
  trailing?: ReactNode;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, multiline, trailing, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          style={[
            styles.input,
            multiline && styles.multiline,
            !!trailing && styles.withTrailing,
            focused && styles.focused,
            !!error && styles.errored,
            style,
          ]}
          {...rest}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { ...type.label, color: colors.text },
  input: {
    ...type.body,
    minHeight: layout.inputHeight,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: 14,
  },
  multiline: { minHeight: 110, paddingTop: 12, paddingBottom: 12 },
  withTrailing: { paddingRight: 52 },
  trailing: { position: 'absolute', right: 4, top: 0, bottom: 0, justifyContent: 'center' },
  focused: { borderColor: colors.primary },
  errored: { borderColor: colors.danger },
  error: { ...type.small, color: colors.danger },
});
