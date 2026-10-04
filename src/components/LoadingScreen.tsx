import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Logo } from '@/components/Logo';
import { colors, type } from '@/theme';

const useNative = Platform.OS !== 'web';
const SLOW_AFTER_MS = 8000;

/**
 * Shown while the app finds out who is signed in. It matches the native splash (same dark background and
 * icon) so there is no flash between the two, then breathes gently so it is clear the app is working.
 */
export function LoadingScreen() {
  const { t } = useTranslation();
  const pulse = useRef(new Animated.Value(0)).current;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
      ]),
    );
    const bouncing = Animated.loop(
      Animated.stagger(
        160,
        dots.map((dot) =>
          Animated.sequence([
            Animated.timing(dot, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
            Animated.timing(dot, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: useNative }),
            Animated.delay(480),
          ]),
        ),
      ),
    );
    breathing.start();
    bouncing.start();
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      breathing.stop();
      bouncing.stop();
      clearTimeout(timer);
    };
  }, [pulse, dots]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] });

  return (
    <View style={styles.screen} accessibilityRole="progressbar" accessibilityLabel={t('loading.label')}>
      <View style={styles.center}>
        <Animated.View style={[styles.halo, { opacity: glow, transform: [{ scale }] }]} />
        <Animated.Image source={require('../../assets/splash-icon.png')} style={[styles.icon, { transform: [{ scale }] }]} resizeMode="contain" />
        <Logo onDark size={34} />
        <Text style={styles.tagline}>{t('loading.tagline')}</Text>
        <View style={styles.dots}>
          {dots.map((dot, index) => (
            <Animated.View
              key={index}
              style={[styles.dot, { opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}
            />
          ))}
        </View>
      </View>
      <Text style={[styles.slow, !slow && styles.hidden]} accessibilityLiveRegion="polite">
        {t('loading.slow')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center', padding: 24 },
  center: { alignItems: 'center', gap: 14 },
  halo: { position: 'absolute', top: -18, width: 190, height: 190, borderRadius: 95, backgroundColor: colors.brand, opacity: 0.35 },
  icon: { width: 130, height: 130, marginBottom: 24 },
  tagline: { ...type.body, color: '#C9CAD9', textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 8, marginTop: 10, height: 14, alignItems: 'flex-end' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  slow: { ...type.small, color: '#C9CAD9', textAlign: 'center', position: 'absolute', bottom: 56, left: 24, right: 24 },
  hidden: { opacity: 0 },
});
