import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import UpdateNotice from "./components/UpdateNotice.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary><App />{import.meta.env.VITE_DEMO_ONLY !== "true" && <UpdateNotice/>}</ErrorBoundary>
  </React.StrictMode>,
);
