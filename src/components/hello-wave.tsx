import { Animated, TextStyle } from 'react-native';

const waveStyle: TextStyle = {
  fontSize: 28,
  lineHeight: 32,
  marginTop: -6,
};

export function HelloWave() {
  return <Animated.Text style={waveStyle}>Hi</Animated.Text>;
}
