const ENABLE_SCREEN_MOTION = true;
const EDGE_BACKGROUND = '#020617';

export const sharedStackScreenOptions = {
  animationEnabled: ENABLE_SCREEN_MOTION,
  cardStyle: { backgroundColor: EDGE_BACKGROUND },
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 140,
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 110,
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
            outputRange: [Math.min(layouts.screen.width * 0.015, 10), 0],
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
