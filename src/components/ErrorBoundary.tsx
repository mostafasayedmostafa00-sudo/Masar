import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[320px] flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0E131E] m-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            View encountered an unexpected issue
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-sm">
            Your local data remains safely saved in IndexedDB. Retry loading this section.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-colors"
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
