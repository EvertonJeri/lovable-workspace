import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#1a1a2e', color: '#e94560', minHeight: '100vh' }}>
          <h1 style={{ color: '#fff', marginBottom: 20 }}>⚠️ Erro na Aplicação</h1>
          <pre style={{ 
            background: '#16213e', 
            padding: 20, 
            borderRadius: 8, 
            overflow: 'auto',
            border: '1px solid #e94560',
            fontSize: 14,
            lineHeight: 1.6
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ 
              marginTop: 20, padding: '12px 24px', 
              background: '#e94560', color: '#fff', 
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 16, fontWeight: 'bold'
            }}
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
