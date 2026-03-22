import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/index.css";

// MSW 완전 비활성화
createRoot(document.getElementById("root")!).render(<App />);