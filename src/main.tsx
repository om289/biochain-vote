import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initOfflineSyncWorker } from "./services/dbService";

// Bootstrap the offline-sync flush worker (listens to 'online' + polls every 30 s)
initOfflineSyncWorker();

createRoot(document.getElementById("root")!).render(<App />);
