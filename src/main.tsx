import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './index.css';

async function boot() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('seed')) {
    const { seedDemoTeam } = await import('./dev/seed');
    await seedDemoTeam();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
