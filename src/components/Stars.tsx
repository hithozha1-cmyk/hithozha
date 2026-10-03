import { Star } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';

const STAR_COLOR = '#F5A623';

type Props = {
  value: number;
  /** When given, the stars are tappable and fill up to the tapped one. */
  onChange?: (rating: number) => void;
  size?: number;
};

export function Stars({ value, onChange, size = 16 }: Props) {
  const { t } = useTranslation();
  const rounded = Math.round(value);

  return (
    <View style={styles.row} accessibilityRole={onChange ? 'radiogroup' : 'image'} accessibilityLabel={t('reviews.stars', { count: rounded })}>
      {[1, 2, 3, 4, 5].map((rating) => {
        const filled = rating <= rounded;
        const star = (
          <Star size={size} color={filled ? STAR_COLOR : colors.inputBorder} fill={filled ? STAR_COLOR : 'transparent'} strokeWidth={1.8} />
        );
        if (!onChange) return <View key={rating}>{star}</View>;
        return (
          <Pressable
            key={rating}
            accessibilityRole="radio"
            accessibilityLabel={t('reviews.stars', { count: rating })}
            accessibilityState={{ checked: rating === rounded }}
            onPress={() => onChange(rating)}
            style={styles.tap}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
