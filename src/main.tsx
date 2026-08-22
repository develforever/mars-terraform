
import "./app/i18n";
import ReactDOM from "react-dom/client";

import "./main.css";
import { BrowserRouter } from "react-router";
import App from "./app/App";
import { useGameStore } from "./application/store/useGameStore";
import { useUIStore } from "./application/store/useUIStore";

if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).useGameStore = useGameStore;
    (window as unknown as Record<string, unknown>).useUIStore = useUIStore;
}

const rootEl = document.getElementById("root") ?? document.createElement("div");
ReactDOM.createRoot(rootEl).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>,
);
