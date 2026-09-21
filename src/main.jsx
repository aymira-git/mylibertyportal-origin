import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ConfirmProvider, ToastProvider, ErrorBoundary } from "./features/shared";
import { registerSW } from "virtual:pwa-register";
import { initGlobalErrorListeners } from "./utils/reportError";

// Catch and log uncaught runtime errors and unhandled promise rejections
initGlobalErrorListeners();

// Automatically check and update service worker in background
registerSW({ immediate: true });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary label="MYLIBERTY Portal">
      <ConfirmProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ConfirmProvider>
    </ErrorBoundary>
  </StrictMode>
);
