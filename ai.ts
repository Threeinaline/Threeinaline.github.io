import { BoardState, PlayerSymbol } from "../types";
import { checkGameState, WINNING_COMBINATIONS } from "./game-logic";

/**
 * Returns a completely random valid move from the empty cells.
 */
function getRandomMove(board: BoardState): number {
  const availableMoves: number[] = [];
  board.forEach((cell, idx) => {
    if (cell === null) availableMoves.push(idx);
  });
  if (availableMoves.length === 0) return -1;
  const randomIndex = Math.floor(Math.random() * availableMoves.length);
  return availableMoves[randomIndex];
}

/**
 * Checks if there's a winning move or an urgent blocking move.
 * Returns the cell index, or -1 if none.
 */
function getWinOrBlockMove(board: BoardState, aiSymbol: PlayerSymbol): number {
  const opponentSymbol: PlayerSymbol = aiSymbol === "X" ? "O" : "X";

  // First check if AI can win in one move
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    const cells = [board[a], board[b], board[c]];
    const aiCount = cells.filter(cell => cell === aiSymbol).length;
    const emptyCount = cells.filter(cell => cell === null).length;

    if (aiCount === 2 && emptyCount === 1) {
      if (board[a] === null) return a;
      if (board[b] === null) return b;
      if (board[c] === null) return c;
    }
  }

  // Next check if AI has to block opponent from winning
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    const cells = [board[a], board[b], board[c]];
    const opponentCount = cells.filter(cell => cell === opponentSymbol).length;
    const emptyCount = cells.filter(cell => cell === null).length;

    if (opponentCount === 2 && emptyCount === 1) {
      if (board[a] === null) return a;
      if (board[b] === null) return b;
      if (board[c] === null) return c;
    }
  }

  return -1;
}

/**
 * Standard Minimax valuation for professional play.
 */
function minimax(board: BoardState, depth: number, isMaximizing: boolean, aiSymbol: PlayerSymbol): number {
  const opponentSymbol: PlayerSymbol = aiSymbol === "X" ? "O" : "X";
  const gameResult = checkGameState(board);

  if (gameResult.winner === aiSymbol) return 10 - depth;
  if (gameResult.winner === opponentSymbol) return depth - 10;
  if (gameResult.isDraw) return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiSymbol;
        const score = minimax(board, depth + 1, false, aiSymbol);
        board[i] = null;
        bestScore = Math.max(bestScore, score);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = opponentSymbol;
        const score = minimax(board, depth + 1, true, aiSymbol);
        board[i] = null;
        bestScore = Math.min(bestScore, score);
      }
    }
    return bestScore;
  }
}

/**
 * Computes the optimal move using Minimax evaluation.
 */
function getBestMinimaxMove(board: BoardState, aiSymbol: PlayerSymbol): number {
  let bestScore = -Infinity;
  let bestMove = -1;

  // Prioritize taking center early if empty for style points
  if (board[4] === null) {
    return 4;
  }

  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = aiSymbol;
      const score = minimax(board, 0, false, aiSymbol);
      board[i] = null;

      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }

  return bestMove !== -1 ? bestMove : getRandomMove(board);
}

/**
 * Public function to compute AI opponent moves based on selected difficulty levels.
 */
export function calculateAiMove(
  board: BoardState,
  aiSymbol: PlayerSymbol,
  difficulty: "easy" | "medium" | "hard"
): number {
  const emptyCount = board.filter(cell => cell === null).length;
  if (emptyCount === 0) return -1;

  switch (difficulty) {
    case "easy": {
      // 70% chance of random, 30% chance of win/block check
      if (Math.random() > 0.3) {
        return getRandomMove(board);
      }
      const winOrBlock = getWinOrBlockMove(board, aiSymbol);
      return winOrBlock !== -1 ? winOrBlock : getRandomMove(board);
    }
    case "medium": {
      // 50% chance of unbeatable minimax, otherwise smart win/block check, fallback random
      if (Math.random() > 0.5) {
        return getBestMinimaxMove(board, aiSymbol);
      }
      const winOrBlock = getWinOrBlockMove(board, aiSymbol);
      return winOrBlock !== -1 ? winOrBlock : getRandomMove(board);
    }
    case "hard":
    default:
      // Always play unbeatable Minimax
      return getBestMinimaxMove(board, aiSymbol);
  }
}
