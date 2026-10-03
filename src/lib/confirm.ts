import { Alert, Platform } from 'react-native';

type Options = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** Shows the confirm button in red on iOS. Default true; pass false for a positive action. */
  destructive?: boolean;
};

/** A confirm dialog that works on web too (Alert.alert is a no-op there). */
export function confirmAction({ title, message, confirmLabel, cancelLabel, onConfirm, destructive = true }: Options): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
