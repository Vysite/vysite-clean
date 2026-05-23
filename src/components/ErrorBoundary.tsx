import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#1e2533] rounded-2xl p-8 border border-red-900/40 text-center">
          <div className="w-14 h-14 rounded-xl bg-red-900/30 flex items-center justify-center mx-auto mb-5">
            <span className="text-red-400 text-2xl font-bold">!</span>
          </div>
          <h1 className="text-white text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-slate-400 text-sm mb-6">
            VYSITE encountered an unexpected error. Try refreshing the page.
          </p>
          <p className="text-slate-600 text-xs font-mono bg-[#111827] rounded-lg px-4 py-3 text-left break-all mb-6">
            {error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
