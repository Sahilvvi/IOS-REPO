import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Btn } from './ui';
import { color, font, space } from '@/theme/tokens';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Last line of defense: if anything under here throws during render (a
// native module that failed to link in this build, a bad screen, etc.) the
// whole app used to go down with it — production builds don't show a red
// box, so that's an instant, silent crash on the user's phone. This turns
// that into a recoverable screen instead.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[ErrorBoundary] caught:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.glyph}>!</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            AVA Fit hit an unexpected error and had to stop. Try again — if it
            keeps happening, restart the app.
          </Text>
          <Text style={styles.detail} numberOfLines={3}>
            {this.state.error.message}
          </Text>
          <Btn tone="cyan" onPress={this.reset} style={styles.btn}>
            Try Again
          </Btn>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  glyph: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: color.red,
    color: color.red,
    fontSize: 26,
    fontFamily: font.bodyBold,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 52,
    marginBottom: space.lg,
    overflow: 'hidden',
  },
  title: {
    fontFamily: font.bodyBold,
    fontSize: 18,
    color: color.text,
    marginBottom: space.sm,
  },
  message: {
    fontFamily: font.body,
    fontSize: 13,
    color: color.textDim,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: space.md,
  },
  detail: {
    fontFamily: font.mono,
    fontSize: 10,
    color: color.textFaint,
    textAlign: 'center',
    marginBottom: space.xl,
  },
  btn: {
    minWidth: 160,
  },
});
