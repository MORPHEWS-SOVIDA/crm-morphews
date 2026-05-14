import { createRoot } from "react-dom/client";
import "./index.css";

function removeExpiredSupabaseSessionBeforeBoot() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const marginSeconds = 120;

    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession ?? parsed?.session ?? parsed;
      const expiresAt = session?.expires_at ?? parsed?.expires_at;

      if (typeof expiresAt === 'number' && expiresAt <= now + marginSeconds) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Best-effort startup guard only.
  }
}

removeExpiredSupabaseSessionBeforeBoot();

import("./App.tsx").then(({ default: App }) => {
  createRoot(document.getElementById("root")!).render(<App />);
});
