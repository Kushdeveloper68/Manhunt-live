import React, { ReactNode } from 'react';
import { MapFallback } from './MapFallback';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches errors thrown while the map renders (missing native module, bad data) so the screen survives. */
export class MapErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn('[map] render error:', error.message);
  }

  render() {
    if (this.state.error) {
      return <MapFallback message={this.state.error.message} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
