import { Easing } from 'react-native';

const ENABLE_SCREEN_MOTION = true;
const EDGE_BACKGROUND = '#F8FAFC';
const SCREEN_EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export const sharedStackScreenOptions = {
  animationEnabled: ENABLE_SCREEN_MOTION,
  cardStyle: { backgroundColor: EDGE_BACKGROUND },
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 190,
        easing: SCREEN_EASE_OUT,
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 150,
        easing: SCREEN_EASE_OUT,
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
            outputRange: [Math.min(layouts.screen.width * 0.018, 12), 0],
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
