
import ReactDOM from "react-dom/client";

import "./main.css";
import { BrowserRouter } from "react-router";
import App from "./app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
        <App />
    </BrowserRouter>,
);
