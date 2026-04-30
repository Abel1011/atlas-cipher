import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[var(--color-bg-primary)]">
          <div className="w-12 h-12 rounded-full bg-[var(--color-error)]/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-[var(--color-error)]" />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-xs text-center">
            {this.props.fallbackMessage || 'Something went wrong rendering this component.'}
          </p>
          {this.state.error && (
            <p className="text-xs text-[var(--color-text-muted)] max-w-sm text-center truncate">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
