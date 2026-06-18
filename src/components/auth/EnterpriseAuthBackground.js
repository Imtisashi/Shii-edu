import React from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useRootLayout } from '../../contexts/RootLayoutContext';

const AUTH_DOODLES = [
  { accent: '#4F46E5', duration: 3600, left: '21%', mobile: { left: '2%', opacity: 0.34, size: 64, top: '11%' }, opacity: 0.46, rotate: -7, size: 86, top: '12%', type: 'notebook' },
  { accent: '#B45309', duration: 4100, left: '73%', mobile: { left: '80%', opacity: 0.32, size: 62, top: '7%' }, opacity: 0.5, rotate: 12, size: 82, top: '14%', type: 'pencilTrail' },
  { accent: '#0F766E', duration: 3900, left: '18%', mobile: { left: '1%', opacity: 0.26, size: 60, top: '76%' }, opacity: 0.38, rotate: 11, size: 76, top: '70%', type: 'marginNote' },
  { accent: '#312E81', duration: 4300, left: '76%', mobile: { left: '80%', opacity: 0.26, size: 64, top: '74%' }, opacity: 0.36, rotate: -14, size: 84, top: '68%', type: 'rulerCurve' },
  { accent: '#7C2D12', duration: 4700, left: '50%', mobile: { left: '43%', opacity: 0.16, size: 48, top: '4%' }, opacity: 0.24, rotate: 5, size: 64, top: '5%', type: 'countingBox' },
];

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mediaQuery.matches);

    const handleChange = (event) => setReduced(event.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return reduced;
}

function AuthDoodleShape({ accent, type }) {
  const strokeProps = {
    fill: 'none',
    stroke: accent,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  if (type === 'pencilTrail') {
    return (
      <Svg height="100%" viewBox="0 0 120 120" width="100%">
        <Path {...strokeProps} strokeWidth={4.5} d="M23 78 C37 61 51 48 69 31" />
        <Path {...strokeProps} strokeWidth={3} d="M69 31 L86 23 L79 40 Z" />
        <Path {...strokeProps} strokeWidth={3.5} d="M83 27 L93 17" />
        <Path {...strokeProps} strokeWidth={2.4} opacity={0.52} d="M25 91 C43 84 50 101 67 91 C77 84 81 88 91 82" />
      </Svg>
    );
  }

  if (type === 'rulerCurve') {
    return (
      <Svg height="100%" viewBox="0 0 120 120" width="100%">
        <Path {...strokeProps} strokeWidth={3} d="M21 76 C37 35 71 23 96 45 C77 53 57 64 42 91 C34 87 27 82 21 76 Z" />
        <Path {...strokeProps} strokeWidth={2.2} opacity={0.58} d="M42 61 L49 66 M52 49 L58 57 M64 40 L69 50 M78 38 L80 48" />
        <Path {...strokeProps} strokeWidth={2.4} opacity={0.38} d="M26 96 C42 104 72 103 91 91" />
      </Svg>
    );
  }

  if (type === 'marginNote') {
    return (
      <Svg height="100%" viewBox="0 0 120 120" width="100%">
        <Path {...strokeProps} strokeWidth={3} d="M34 19 L83 25 C90 26 94 31 93 38 L86 89 C85 96 79 101 72 99 L29 91 C23 90 19 84 21 78 L27 28 C28 22 30 20 34 19 Z" />
        <Path {...strokeProps} strokeWidth={2.1} opacity={0.54} d="M38 42 L73 47 M35 57 L70 62 M33 72 L58 77" />
        <Circle cx={38} cy={33} r={2.5} fill={accent} opacity={0.72} />
      </Svg>
    );
  }

  if (type === 'countingBox') {
    return (
      <Svg height="100%" viewBox="0 0 120 120" width="100%">
        <Path {...strokeProps} strokeWidth={3} d="M32 29 C47 22 70 22 87 30 C92 48 91 72 84 91 C64 97 43 94 27 86 C22 65 22 45 32 29 Z" />
        <Path {...strokeProps} strokeWidth={2.1} opacity={0.54} d="M42 42 L77 42 M40 56 L80 56 M39 70 L76 70" />
        <Path {...strokeProps} strokeWidth={2.1} opacity={0.54} d="M51 35 L48 82 M66 35 L65 84" />
      </Svg>
    );
  }

  return (
    <Svg height="100%" viewBox="0 0 120 120" width="100%">
      <Path {...strokeProps} strokeWidth={3.2} d="M25 34 C35 27 50 28 61 36 C70 29 86 27 96 34 L96 88 C84 82 71 82 61 91 C49 82 37 82 25 88 Z" />
      <Path {...strokeProps} strokeWidth={2.2} opacity={0.58} d="M61 36 L61 91 M35 45 C43 42 50 43 55 48 M35 58 C44 55 51 57 56 62 M68 47 C75 43 84 43 90 47 M68 61 C75 58 83 58 90 62" />
      <Path {...strokeProps} strokeWidth={2.2} opacity={0.38} d="M22 98 C38 105 51 105 63 98 C77 105 91 104 102 96" />
    </Svg>
  );
}

function AuthDoodleItem({ doodle, reducedMotion }) {
  const motion = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (reducedMotion) {
      motion.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          duration: doodle.duration,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(motion, {
          duration: doodle.duration,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [doodle.duration, motion, reducedMotion]);

  const animatedStyle = reducedMotion
    ? { transform: [{ rotate: `${doodle.rotate}deg` }] }
    : {
      transform: [
        {
          translateY: motion.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -9],
          }),
        },
        {
          rotate: motion.interpolate({
            inputRange: [0, 1],
            outputRange: [`${doodle.rotate}deg`, `${doodle.rotate + 4}deg`],
          }),
        },
      ],
    };

  return (
    <Animated.View
      pointerEvents="none"
      testID={`auth-doodle-${doodle.type}`}
      style={[
        styles.authDoodle,
        {
          height: doodle.size,
          left: doodle.left,
          opacity: doodle.opacity,
          top: doodle.top,
          width: doodle.size,
        },
        animatedStyle,
      ]}
    >
      <AuthDoodleShape accent={doodle.accent} type={doodle.type} />
    </Animated.View>
  );
}

function AuthDoodleLayer() {
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const isNarrow = width < 700;

  if (Platform.OS !== 'web') return null;

  return (
    <View pointerEvents="none" style={styles.authDoodleLayer} testID="auth-doodle-layer">
      {AUTH_DOODLES.map((doodle) => {
        const resolvedDoodle = isNarrow && doodle.mobile
          ? { ...doodle, ...doodle.mobile }
          : doodle;
        return (
          <AuthDoodleItem doodle={resolvedDoodle} key={`${doodle.type}-${doodle.left}-${doodle.top}`} reducedMotion={reducedMotion} />
        );
      })}
    </View>
  );
}

/**
 * @param {{ backgroundColor?: string, children: React.ReactNode }} props
 */
export default function EnterpriseAuthBackground({ backgroundColor = undefined, children }) {
  const { colors } = useRootLayout();
  const resolvedBackground = backgroundColor || colors.page;

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const body = document.body;
    const previousRootBackground = root.style.backgroundColor;
    const previousBodyBackground = body.style.backgroundColor;
    const previousEdgeBackground = root.style.getPropertyValue('--shii-edge-background');

    root.style.backgroundColor = resolvedBackground;
    body.style.backgroundColor = resolvedBackground;
    root.style.setProperty('--shii-edge-background', resolvedBackground);

    return () => {
      root.style.backgroundColor = previousRootBackground;
      body.style.backgroundColor = previousBodyBackground;
      if (previousEdgeBackground) {
        root.style.setProperty('--shii-edge-background', previousEdgeBackground);
      } else {
        root.style.removeProperty('--shii-edge-background');
      }
    };
  }, [resolvedBackground]);

  return (
    <View style={[styles.root, Platform.OS === 'web' && styles.webRoot, { backgroundColor: resolvedBackground }]}>
      <AuthDoodleLayer />
      <View style={styles.contentLayer}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  authDoodle: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    justifyContent: 'center',
    position: 'absolute',
  },
  authDoodleLayer: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  contentLayer: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  webRoot: {
    flexBasis: 'auto',
    flexGrow: 1,
    flexShrink: 0,
    minHeight: '100dvh',
    position: 'relative',
  },
});
