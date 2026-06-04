import React from 'react';
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type GlobalErrorBoundaryProps = {
  appName?: string;
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo, incidentId: string) => void;
  resetKey?: string | number;
};

type GlobalErrorBoundaryState = {
  error: Error | null;
  hasError: boolean;
  incidentId: string;
  retryKey: number;
};

type GlobalErrorFallbackProps = {
  appName: string;
  error: Error | null;
  incidentId: string;
  onRetry: () => void;
};

const PAGE = '#02030A';
const CARD = '#0F172A';
const TEXT = '#F8FAFC';
const TEXT_SOFT = '#B9C6DD';
const ACCENT = '#38BDF8';

const createIncidentId = () => `EH-${Date.now().toString(36).toUpperCase()}`;

function GlobalErrorFallback({
  appName,
  error,
  incidentId,
  onRetry,
}: GlobalErrorFallbackProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  return (
    <View
      accessibilityLabel="Application error recovery screen"
      accessibilityRole="alert"
      style={[
        styles.fallbackRoot,
        {
          paddingBottom: Math.max(insets.bottom, 20),
          paddingHorizontal: compact ? 14 : 20,
          paddingTop: Math.max(insets.top, 20),
        },
      ]}
    >
      <StatusBar backgroundColor={PAGE} barStyle="light-content" />

      <View style={[styles.fallbackCard, compact && styles.fallbackCardCompact]}>
        <View style={styles.iconShell}>
          <Ionicons name="shield-checkmark-outline" size={30} color={ACCENT} />
        </View>
        <Text style={styles.eyebrow}>{appName} Recovery</Text>
        <Text style={[styles.title, compact && styles.titleCompact]}>Reconnecting...</Text>
        <Text style={styles.message}>
          The app protected your session from a render failure. Retry the workspace to continue safely.
        </Text>

        {__DEV__ && error?.message ? (
          <Text numberOfLines={3} style={styles.errorDetail}>{error.message}</Text>
        ) : null}

        <View style={styles.referencePill}>
          <Text style={styles.referenceLabel}>Reference</Text>
          <Text selectable style={styles.referenceValue}>{incidentId}</Text>
        </View>

        <Pressable
          accessibilityLabel="Retry application"
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
        >
          <Ionicons name="refresh-outline" size={19} color="#FFFFFF" />
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default class GlobalErrorBoundary extends React.Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  state: GlobalErrorBoundaryState = {
    error: null,
    hasError: false,
    incidentId: '',
    retryKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
    return {
      error,
      hasError: true,
      incidentId: createIncidentId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const incidentId = this.state.incidentId || createIncidentId();
    console.error(`[${incidentId}] Global render failure`, error, errorInfo);
    this.props.onError?.(error, errorInfo, incidentId);
  }

  componentDidUpdate(previousProps: GlobalErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.reset();
    }
  }

  reset = () => {
    this.setState((current) => ({
      error: null,
      hasError: false,
      incidentId: '',
      retryKey: current.retryKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <GlobalErrorFallback
          appName={this.props.appName || 'Edu-Hub'}
          error={this.state.error}
          incidentId={this.state.incidentId}
          onRetry={this.reset}
        />
      );
    }

    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  errorDetail: {
    backgroundColor: '#450A0A',
    borderColor: '#7F1D1D',
    borderRadius: 8,
    borderWidth: 1,
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 16,
    padding: 12,
    width: '100%',
  },
  eyebrow: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 18,
    textTransform: 'uppercase',
  },
  fallbackCard: {
    alignItems: 'center',
    backgroundColor: CARD,
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 480,
    padding: 26,
    width: '100%',
  },
  fallbackCardCompact: {
    borderRadius: 8,
    padding: 20,
  },
  fallbackRoot: {
    alignItems: 'center',
    backgroundColor: PAGE,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconShell: {
    alignItems: 'center',
    backgroundColor: '#0C4A6E',
    borderColor: '#075985',
    borderRadius: 8,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  message: {
    color: TEXT_SOFT,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 360,
    textAlign: 'center',
  },
  referenceLabel: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  referencePill: {
    alignItems: 'center',
    backgroundColor: '#082F49',
    borderColor: '#075985',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  referenceValue: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 52,
    paddingHorizontal: 20,
    width: '100%',
  },
  retryButtonPressed: {
    opacity: Platform.OS === 'web' ? 0.88 : 0.82,
    transform: [{ scale: 0.985 }],
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
  },
  title: {
    color: TEXT,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 33,
    marginTop: 8,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 24,
    lineHeight: 30,
  },
});
