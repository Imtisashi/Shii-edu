import { Platform } from 'react-native';

const ENABLE_SCREEN_MOTION = Platform.OS !== 'web';

export const sharedStackScreenOptions = {
  animationEnabled: ENABLE_SCREEN_MOTION,
  cardStyle: { backgroundColor: '#F8FAFC' },
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 260,
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 220,
      },
    },
  },
  cardStyleInterpolator: ({ current, layouts }) => ({
    cardStyle: {
      opacity: current.progress,
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [Math.min(layouts.screen.width * 0.08, 42), 0],
          }),
        },
        {
          scale: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.985, 1],
          }),
        },
      ],
    },
  }),
};

export const sharedTabScreenOptions = {
  animation: ENABLE_SCREEN_MOTION ? 'fade' : 'none',
  tabBarHideOnKeyboard: true,
};
