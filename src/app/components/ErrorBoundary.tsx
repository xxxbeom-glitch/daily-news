/**
 * 에러 발생 시 빈 화면 대신 오류 메시지 표시
 */
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0f] text-white">
          <p className="text-red-400 font-medium mb-2">오류가 발생했습니다</p>
          <p className="text-white/60 text-sm text-center break-words max-w-md">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
