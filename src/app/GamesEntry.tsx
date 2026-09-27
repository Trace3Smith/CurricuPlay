import { lazy, type ComponentType } from 'react';

let ready: ComponentType | undefined;
let pending: Promise<void> | undefined;
export function preloadGames() {
  pending ??= import('./LegacyGamesRoute').then(module => { ready = module.default; });
  return pending;
}
const LazyGames = lazy(async () => { await preloadGames(); return { default: ready! }; });
export default function GamesEntry() {
  const Games = ready ?? LazyGames;
  return <Games />;
}
