import React from 'react';
import { createRoot } from 'react-dom/client';
import ClassThreadRouter from './app/Router';
import { preloadGames } from './app/GamesEntry';

async function start() {
  // Direct gameplay visits need no Suspense delay or running browser clock.
  // Classroom-only visits still avoid downloading the existing question banks.
  if (location.pathname.startsWith('/games') || ['#four-corners', '#review'].includes(location.hash)) await preloadGames();
  createRoot(document.getElementById('root')!).render(<React.StrictMode><ClassThreadRouter /></React.StrictMode>);
}
void start();
