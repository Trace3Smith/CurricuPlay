/** Display names for shared reports. Unlisted game types still show their stored ID. */
const names: Record<string, string> = { 'four-corners': 'Four Corners', 'state-lingo-bingo': 'State Lingo Bingo' };
export const gameName = (gameType: string) => names[gameType] ?? gameType;
