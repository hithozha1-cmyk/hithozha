import type { LucideIcon } from 'lucide-react-native';
import type { ColorValue } from 'react-native';

type Props = {
  icon: LucideIcon;
  color: ColorValue;
  focused: boolean;
};

export function TabIcon({ icon: Icon, color, focused }: Props) {
  return <Icon size={22} color={color} strokeWidth={focused ? 2.1 : 1.8} />;
}
