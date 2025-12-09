import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 flex items-center justify-center p-4 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-10 left-10 text-4xl animate-float">❄️</div>
          <div className="absolute top-20 right-20 text-3xl animate-float" style={{ animationDelay: '1s' }}>🎄</div>
          <div className="absolute bottom-20 left-20 text-3xl animate-float" style={{ animationDelay: '2s' }}>⭐</div>
          <div className="absolute bottom-10 right-10 text-4xl animate-float" style={{ animationDelay: '0.5s' }}>🎁</div>
          
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border-4 border-red-400 relative z-10" style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
            boxShadow: '0 20px 60px rgba(220, 38, 38, 0.3)',
          }}>
            <div className="text-center">
              <div className="text-6xl mb-4 animate-sparkle">⚠️</div>
              <h1 className="text-3xl md:text-4xl font-bold text-red-700 mb-4 bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">
                Oops! Something went wrong.
              </h1>
              <p className="text-gray-700 mb-4 text-lg">
                {this.state.error?.message || 'Something went wrong'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all transform hover:scale-105 font-bold shadow-lg"
              >
                🔄 Refresh Page
              </button>
              {this.state.error && (
                <details className="mt-4 text-left bg-gray-50 p-4 rounded-xl border-2 border-gray-300">
                  <summary className="cursor-pointer text-sm font-bold text-gray-700">Error Details</summary>
                  <pre className="mt-2 text-xs bg-white p-3 rounded-lg border border-gray-200 overflow-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

