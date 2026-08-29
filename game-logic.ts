import { BoardState, PlayerSymbol } from "../types";

export const WINNING_COMBINATIONS = [
  [0, 1, 2], // Row 1
  [3, 4, 5], // Row 2
  [6, 7, 8], // Row 3
  [0, 3, 6], // Column 1
  [1, 4, 7], // Column 2
  [2, 5, 8], // Column 3
  [0, 4, 8], // Diagonal 1
  [2, 4, 6], // Diagonal 2
];

export interface WinResult {
  winner: PlayerSymbol | null;
  line: number[] | null;
  isDraw: boolean;
}

/**
 * Evaluates the current board state and returns the winner, the line of three, and whether it's a draw.
 */
export function checkGameState(board: BoardState): WinResult {
  for (const line of WINNING_COMBINATIONS) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a] as PlayerSymbol,
        line,
        isDraw: false,
      };
    }
  }

  // If there are no empty spaces left, it's a draw
  const hasEmpty = board.some((cell) => cell === null);
  if (!hasEmpty) {
    return {
      winner: null,
      line: null,
      isDraw: true,
    };
  }

  return {
    winner: null,
    line: null,
    isDraw: false,
  };
}
