import React from 'react';

/**
 * RouteErrorBoundary — Catches rendering errors in lazy-loaded route components
 *
 * Without this, a single broken page crashes the entire app.
 * With it, only the broken route shows an error; sidebar + header remain functional.
 */
export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RouteErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">
            This page encountered an error. You can try refreshing or navigate to a different page.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/admin/command-center'}
              className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-200 dark:hover:bg-white/20 transition"
            >
              Go to Dashboard
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs text-left text-red-600 dark:text-red-400 max-w-2xl overflow-auto">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
