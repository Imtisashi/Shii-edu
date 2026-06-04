import { Easing, Animated } from 'react-native';

export const EASING = {
  strongEaseOut: Easing.bezier(0.32, 0.72, 0, 1),
  sharpEaseOut: Easing.bezier(0.32, 0.72, 0, 1),
  mechanicalEase: Easing.bezier(0.32, 0.72, 0, 1),
  measuredEaseInOut: Easing.bezier(0.32, 0.72, 0, 1),
};

export const SPRINGS = {
  snappy: {
    damping: 22,
    mass: 1.0,
    stiffness: 260,
    velocity: 0,
  },
  gesture: {
    damping: 28,
    mass: 1.0,
    stiffness: 220,
    velocity: 0,
  },
};

export const DURATION = {
  instant: 50,
  press: 110,
  quick: 120,
  standard: 150,
  route: 170,
  deliberate: 220,
  maximum: 250,
};

export const createSpringAnimation = (value, toValue, config = SPRINGS.snappy) => {
  return Animated.spring(value, {
    toValue,
    ...config,
    useNativeDriver: true,
  });
};

export const createTimingAnimation = (
  value,
  toValue,
  duration = DURATION.standard,
  easing = EASING.strongEaseOut
) => {
  return Animated.timing(value, {
    toValue,
    duration: Math.min(duration, DURATION.maximum),
    easing,
    useNativeDriver: true,
  });
};

export const createSequence = (animations) => {
  return Animated.sequence(animations);
};

export const createParallel = (animations) => {
  return Animated.parallel(animations);
};

export const createStaggered = (items, animationFn, staggerDelay = 50) => {
  return Animated.stagger(staggerDelay, items.map((item) => animationFn(item)));
};

export default {
  EASING,
  SPRINGS,
  DURATION,
  createSpringAnimation,
  createTimingAnimation,
  createSequence,
  createParallel,
  createStaggered,
};
