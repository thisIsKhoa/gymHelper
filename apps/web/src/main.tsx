import "@fontsource/sora/400.css";
import "@fontsource/sora/600.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { AppProviders } from "./app/providers.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
