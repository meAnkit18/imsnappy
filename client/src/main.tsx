import { createRoot } from "react-dom/client";
import App from "./App";
import { ApiSessionProvider } from "./contexts/ApiSessionContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ApiSessionProvider>
    <App />
  </ApiSessionProvider>,
);
