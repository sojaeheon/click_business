import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/index.css";

async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCK !== 'true') {
    return; // VITE_USE_MOCK=true 일 때만 MSW 사용, 기본은 실제 백엔드 연동(게임API 내부 폴백 사용)
  }
  const { worker } = await import('./mocks/browser');
  console.log("mock 사용 중")
  return worker.start({ onUnhandledRequest: 'bypass' });
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});