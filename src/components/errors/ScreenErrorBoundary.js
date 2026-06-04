import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRootLayout } from '../../contexts/RootLayoutContext';

function ScreenErrorFallback({ detail, message, onRetry, title }) {
  const { colors } = useRootLayout();

  return (
    <View
      accessibilityLabel="Screen error recovery"
      accessibilityRole="alert"
      style={[styles.container, { backgroundColor: colors.page }]}
    >
      <View style={[styles.card, { backgroundColor: colors.cardStrong, borderColor: colors.hairline }]}>
        <Text style={[styles.kicker, { color: colors.accent }]}>Screen Recovery</Text>
        <Text style={[styles.title, { color: colors.text }]}>{title || 'Attendance could not render'}</Text>
        <Text style={[styles.message, { color: colors.textSoft }]}>
          {message || 'We protected the app from a crash. Try again, or come back after the data refreshes.'}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={3}>{detail}</Text>
        ) : null}
        <TouchableOpacity
          accessibilityLabel="Retry attendance screen"
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: colors.deepBlue }]}
          onPress={onRetry}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      retryKey: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Something went wrong while rendering this screen.',
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`${this.props.screenName || 'Screen'} render failed:`, error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.reset();
    }
  }

  reset = () => {
    this.setState((current) => ({
      hasError: false,
      errorMessage: '',
      retryKey: current.retryKey + 1,
    }));
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
    }

    return (
      <ScreenErrorFallback
        detail={this.state.errorMessage}
        message={this.props.message}
        onRetry={this.reset}
        title={this.props.title}
      />
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: '#02030A',
    overflow: 'hidden',
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kicker: {
    color: '#67E8F9',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 23,
    fontWeight: '900',
    marginBottom: 10,
  },
  message: {
    color: '#B9C6DD',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  detail: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 14,
  },
  button: {
    marginTop: 18,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
