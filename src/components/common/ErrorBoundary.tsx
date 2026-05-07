import { Component, type ErrorInfo, type ReactNode } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  referenceId: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    referenceId: "",
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {
      hasError: true,
      referenceId: `ERR-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Application render error", {
      referenceId: this.state.referenceId,
      error,
      componentStack: info.componentStack,
    });
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      referenceId: "",
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h2 className="text-lg font-semibold">{this.props.fallbackTitle ?? "Something went wrong"}</h2>
        <p className="mt-2 text-sm">
          {this.props.fallbackMessage ?? "The screen could not be loaded. Please retry or contact support."}
        </p>
        <p className="mt-3 rounded-lg bg-white p-2 text-xs">Reference: {this.state.referenceId}</p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }
}
