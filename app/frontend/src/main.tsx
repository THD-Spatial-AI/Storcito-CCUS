import { createRoot } from "react-dom/client";
import App from "@/App";
import "@fontsource-variable/inter";
import "@/styles/global.css";
import "@/index.css";

import { initI18n } from "@/i18n";

initI18n({ storageKey: "app_language" });

createRoot(document.getElementById("root")!).render(<App />);
