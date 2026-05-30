
import "./app/i18n";
import ReactDOM from "react-dom/client";

import "./main.css";
import { BrowserRouter } from "react-router";
import App from "./app/App";

const rootEl = document.getElementById("root") ?? document.createElement("div");
ReactDOM.createRoot(rootEl).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>,
);
