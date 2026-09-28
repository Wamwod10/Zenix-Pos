import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/media/responsive.scss";
import "./styles/saas.scss";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { StoreProvider } from "./context/StoreContext.jsx";
import { FeedbackProvider } from "./context/FeedbackContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode><AuthProvider><StoreProvider><FeedbackProvider><App /></FeedbackProvider></StoreProvider></AuthProvider></StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration=await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
      registration.waiting?.postMessage({type:"SKIP_WAITING"});
      registration.addEventListener("updatefound",()=>{
        const worker=registration.installing;
        worker?.addEventListener("statechange",()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller)worker.postMessage({type:"SKIP_WAITING"})});
      });
      registration.update().catch(()=>undefined);
    } catch {
      // PWA support is optional; navigation must keep working without it.
    }
  });
}
