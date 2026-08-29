export type BoardState = (PlayerSymbol | null)[];

export type PlayerSymbol = "X" | "O";

export interface Player {
  name: string;
  symbol: PlayerSymbol;
  color: string; // Tailwind color class or hex
  accentColor: string; // for borders/shadows/text
  score: number;
}

export interface MatchHistoryItem {
  id: string;
  winnerSymbol: PlayerSymbol | "Draw";
  winnerName: string;
  timestamp: string;
  boardSnapshot: BoardState;
  durationSeconds: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  particleEffects: boolean;
  autoRestart: boolean;
}
