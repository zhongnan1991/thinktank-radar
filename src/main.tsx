import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import Gate from './components/Gate.tsx'
import { isShareMode } from './lib/api.ts'

function Root() {
  const [gate, setGate] = useState<"checking" | "locked" | "open">("checking");

  useEffect(() => {
    let alive = true;
    (async () => {
      // the password gate only applies to the public static build;
      // the local version (backend present) stays unlocked
      const share = await isShareMode();
      const unlocked = sessionStorage.getItem("ttr-gate") === "1";
      if (alive) setGate(share && !unlocked ? "locked" : "open");
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (gate === "checking") {
    return <div className="min-h-screen bg-background" aria-label="loading" />;
  }
  if (gate === "locked") {
    return <Gate onUnlock={() => setGate("open")} />;
  }
  return (
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
