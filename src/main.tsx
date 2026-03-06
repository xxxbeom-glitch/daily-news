import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/components/ErrorBoundary";
import { clearInterestMemory } from "./app/utils/persistState";
import "./index.css";

// 이전에 저장된 관심사 키워드 삭제 (검색 조건 없음)
clearInterestMemory();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
