import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-4 z-[9999]">
          <h2 className="text-2xl font-bold text-red-500 mb-2">화면 렌더링 중 오류가 발생했습니다</h2>
          <p className="text-gray-400">일시적인 에러일 수 있습니다. 새로고침을 시도해주세요.</p>
          <button 
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
