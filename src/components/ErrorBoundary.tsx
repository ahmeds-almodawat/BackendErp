import React from 'react';

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  moduleName?: string;
  storageKey?: string;
  resetKey?: string | number;
};

type State = {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
};

function downloadDiagnostic(moduleName: string | undefined, error: Error | undefined, errorInfo: React.ErrorInfo | undefined) {
  const localStorageSnapshot: Record<string, string | null> = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) localStorageSnapshot[key] = localStorage.getItem(key)?.slice(0, 50000) ?? null;
    }
  } catch {
    localStorageSnapshot.unavailable = 'Unable to read localStorage';
  }

  const payload = {
    moduleName: moduleName ?? 'unknown',
    at: new Date().toISOString(),
    error: {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    },
    componentStack: errorInfo?.componentStack,
    localStorageSnapshot,
    userAgent: navigator.userAgent,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `erp-diagnostic-${moduleName ?? 'module'}-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ERP safe boundary caught a crash:', error, errorInfo);
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    }
  }

  private resetBoundary = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private clearLocalData = () => {
    if (this.props.storageKey) {
      try {
        localStorage.removeItem(this.props.storageKey);
      } catch {
        // keep UI recoverable even if storage removal fails
      }
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="module-crash-shell">
        <div className="module-crash-card">
          <div className="module-crash-badge">SAFE RECOVERY</div>
          <h2>{this.props.title ?? 'This module failed to load safely'}</h2>
          <p>
            {this.props.subtitle ??
              'The ERP caught this crash and protected the rest of the platform from a white page. You can retry, export diagnostics, or reset local trial data.'}
          </p>
          <div className="module-crash-details">
            <strong>{this.state.error?.name ?? 'Error'}</strong>
            <span>{this.state.error?.message ?? 'Unknown module error'}</span>
          </div>
          <div className="button-row">
            <button type="button" onClick={this.resetBoundary}>Try again</button>
            <button type="button" onClick={() => downloadDiagnostic(this.props.moduleName, this.state.error, this.state.errorInfo)}>Export diagnostics</button>
            {this.props.storageKey && <button type="button" className="danger-btn" onClick={this.clearLocalData}>Reset local trial data</button>}
          </div>
        </div>
      </div>
    );
  }
}
