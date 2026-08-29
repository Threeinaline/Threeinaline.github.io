// Tic-Tac-Toe App with Multiplayer and Firestore Integration
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Trophy, RotateCcw, Volume2, VolumeX, Sparkles, User, 
  HelpCircle, Check, Play, ChevronRight, RefreshCw, Undo2, Redo2,
  Calendar, Flame, Edit3, Trash2, Cpu, Globe, Users, Radio, 
  ArrowRight, ShieldCheck, Gamepad2, Copy, Settings
} from "lucide-react";
import { checkGameState, WinResult } from "./game-logic";
import { Player, BoardState, PlayerSymbol, MatchHistoryItem } from "./types";
import { 
  playXSound, playOSound, playVictorySound, 
  playDrawSound, playErrorSound 
} from "./audio";
import { calculateAiMove } from "./ai";
import { db, auth } from "./firebase";
import { 
  createNewRoom, 
  joinExistingRoom, 
  subscribeToRoom, 
  updateRoomState, 
  findAndJoinWaitingRoom, 
  getActiveLobbies, 
  LobbyRoom 
} from "./multiplayer";
import gameLogo from "./assets/images/game_logo_icon_1782493441937.jpg";

// List of professional theme colors
const COLOR_PRESETS = [
  { name: "Indigo Flow", key: "indigo", text: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-600", accent: "#4f46e5", gradient: "from-indigo-500 to-blue-600" },
  { name: "Rose Passion", key: "rose", text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-600", accent: "#e11d48", gradient: "from-rose-500 to-pink-600" },
  { name: "Emerald Mint", key: "emerald", text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-600", accent: "#059669", gradient: "from-emerald-500 to-teal-600" },
  { name: "Amber Glory", key: "amber", text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-600", accent: "#d97706", gradient: "from-amber-500 to-orange-600" },
  { name: "Violet Magic", key: "violet", text: "text-violet-600", bg: "bg-violet-50", border: "border-violet-600", accent: "#7c3aed", gradient: "from-violet-500 to-fuchsia-600" },
  { name: "Cyan Breeze", key: "cyan", text: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-600", accent: "#0891b2", gradient: "from-cyan-500 to-blue-500" },
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'intro' | 'game'>('intro');
  // -------------------------------------------------------------
  // Dynamic Game State
  // -------------------------------------------------------------
  const [board, setBoard] = useState<BoardState>([null, null, null, null, null, null, null, null, null]);
  const [history, setHistory] = useState<BoardState[]>([[null, null, null, null, null, null, null, null, null]]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(0);
  const [currentTurn, setCurrentTurn] = useState<PlayerSymbol>("X");
  const [startingPlayer, setStartingPlayer] = useState<PlayerSymbol>("X");
  
  // Game mode config: "pvp" = Local multiplayer, "pve" = Play against A.I., "online" = Play online (placeholder)
  const [battleType, setBattleType] = useState<"pvp" | "pve" | "online">("pvp");
  const gameMode = battleType;
  const setGameMode = setBattleType;

  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);

  // Online mode placeholder state configurations
  const [onlineTab, setOnlineTab] = useState<"quick" | "private" | "lobbies">("quick");
  const [matchmakingState, setMatchmakingState] = useState<"idle" | "searching" | "found" | "playing">("idle");

  // Helper to determine if the game board (match arena) is active vs. hidden
  const isArenaActive = battleType !== "online" || matchmakingState === "playing";
  const [matchmakingTime, setMatchmakingTime] = useState<number>(0);
  const [roomId, setRoomId] = useState<string>("");
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [mockOpponent, setMockOpponent] = useState<{name: string; ping: number; winRate: string} | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [customRoomCode, setCustomRoomCode] = useState<string>("LINE-9482");
  const [inputRoomCode, setInputRoomCode] = useState<string>("");
  const [onlineLatency, setOnlineLatency] = useState<number>(24);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [myOnlineSymbol, setMyOnlineSymbol] = useState<"X" | "O">("X");
  const [liveLobbies, setLiveLobbies] = useState<LobbyRoom[]>([]);

  // Game state evaluation
  const [winResult, setWinResult] = useState<WinResult>({ winner: null, line: null, isDraw: false });
  const [isGameActive, setIsGameActive] = useState<boolean>(true);

  // Sound triggers
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Player configurations
  const [playerX, setPlayerX] = useState<Player>({
    name: "Alex Rivera",
    symbol: "X",
    color: "indigo",
    accentColor: "#4f46e5",
    score: 0
  });

  const [playerO, setPlayerO] = useState<Player>({
    name: "Sam Chen",
    symbol: "O",
    color: "rose",
    accentColor: "#e11d48",
    score: 0
  });

  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isEditingNames, setIsEditingNames] = useState<boolean>(false);
  
  // High-fidelity active animation effects triggers
  const [particleWinner, setParticleWinner] = useState<PlayerSymbol | "Draw" | null>(null);

  // Turn duration details (15s per turn timer with progress)
  const [turnTimerSeconds, setTurnTimerSeconds] = useState<number>(15);
  const [timerActive, setTimerActive] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getPlayerOName = () => {
    if (gameMode === "pve") return "AlphaLine AI";
    if (gameMode === "online") return mockOpponent?.name || "Online Opponent";
    return playerO.name;
  };

  // -------------------------------------------------------------
  // Initialization & Storage Reload
  // -------------------------------------------------------------
  useEffect(() => {
    // Reload previous config from local storage
    try {
      const storedPXName = localStorage.getItem("ttt_px_name");
      const storedPXColor = localStorage.getItem("ttt_px_color");
      const storedPXScore = localStorage.getItem("ttt_px_score");
      const storedPOName = localStorage.getItem("ttt_po_name");
      const storedPOColor = localStorage.getItem("ttt_po_color");
      const storedPOScore = localStorage.getItem("ttt_po_score");
      const storedHistory = localStorage.getItem("ttt_history");
      const storedSound = localStorage.getItem("ttt_sound");
      
      const storedGameMode = localStorage.getItem("ttt_game_mode");
      const storedAiDifficulty = localStorage.getItem("ttt_ai_difficulty");

      if (storedPXName) setPlayerX(prev => ({ ...prev, name: storedPXName }));
      if (storedPXColor) {
        const matching = COLOR_PRESETS.find(c => c.key === storedPXColor);
        if (matching) setPlayerX(prev => ({ ...prev, color: storedPXColor, accentColor: matching.accent }));
      }
      if (storedPXScore) setPlayerX(prev => ({ ...prev, score: parseInt(storedPXScore) || 0 }));

      if (storedPOName) setPlayerO(prev => ({ ...prev, name: storedPOName }));
      if (storedPOColor) {
        const matching = COLOR_PRESETS.find(c => c.key === storedPOColor);
        if (matching) setPlayerO(prev => ({ ...prev, color: storedPOColor, accentColor: matching.accent }));
      }
      if (storedPOScore) setPlayerO(prev => ({ ...prev, score: parseInt(storedPOScore) || 0 }));

      if (storedHistory) setMatchHistory(JSON.parse(storedHistory));
      if (storedSound) setSoundEnabled(storedSound === "true");

      if (storedGameMode === "pvp" || storedGameMode === "pve" || storedGameMode === "online") setGameMode(storedGameMode);
      if (storedAiDifficulty === "easy" || storedAiDifficulty === "medium" || storedAiDifficulty === "hard") {
        setAiDifficulty(storedAiDifficulty);
      }
    } catch (e) {
      console.warn("Could not reload local storage settings", e);
    }
  }, []);

  // -------------------------------------------------------------
  // Timer Threading
  // -------------------------------------------------------------
  useEffect(() => {
    // If the game board is hidden (arena not active), or the round is not active, clear turn timer
    if (!isArenaActive || !isGameActive || !timerActive || winResult.winner || winResult.isDraw) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    setTurnTimerSeconds(15);
    timerRef.current = setInterval(() => {
      setTurnTimerSeconds(prev => {
        if (prev <= 1) {
          // Timer ran out: switch turn automatically or play sound and shift
          if (soundEnabled) playErrorSound();
          // Shift turn
          setCurrentTurn(t => t === "X" ? "O" : "X");
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentTurn, isGameActive, timerActive, winResult, isArenaActive, soundEnabled]);

  // -------------------------------------------------------------
  // AI Opponent trigger logic
  // -------------------------------------------------------------
  useEffect(() => {
    // AI turns must strictly NOT execute when the arena is not active (like when game board is hidden or we are in other menus)
    if (battleType !== "pve" || currentTurn !== "O" || !isGameActive || winResult.winner || winResult.isDraw || isAiThinking || !isArenaActive) {
      return;
    }

    setIsAiThinking(true);
    const thinkingDelay = setTimeout(() => {
      // Re-verify that conditions are still valid inside the asynchronous callback to prevent stale state updates
      if (battleType !== "pve" || currentTurn !== "O" || !isGameActive || winResult.winner || winResult.isDraw || !isArenaActive) {
        setIsAiThinking(false);
        return;
      }
      const aiMove = calculateAiMove(board, "O", aiDifficulty);
      if (aiMove !== -1) {
        executeMoveAt(aiMove);
      }
      setIsAiThinking(false);
    }, 600); // 600ms elegant thinking delay so it feels organic

    return () => {
      clearTimeout(thinkingDelay);
    };
  }, [currentTurn, battleType, board, isGameActive, winResult, aiDifficulty, isArenaActive]);

  // -------------------------------------------------------------
  // Battle Type Change / Arena Hidden Reset Guard
  // -------------------------------------------------------------
  useEffect(() => {
    // Whenever the battleType state changes, strictly clear and reset AI state, round countdowns and intervals
    setIsAiThinking(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Always reset countdown seconds cleanly to prevent carryover of previous timer values
    setTurnTimerSeconds(15);
  }, [battleType]);

  // -------------------------------------------------------------
  // Real-time Firestore Room Synchronization
  // -------------------------------------------------------------
  useEffect(() => {
    if (battleType !== "online" || !roomId) return;

    const unsubscribe = subscribeToRoom(
      roomId,
      (roomData) => {
        // Strict guard to prevent asynchronous background executions or updates when battleType is not online
        if (battleType !== "online") {
          return;
        }

        // 1. Synchronize board state
        if (roomData.boardState) {
          setBoard(roomData.boardState);
        }
        
        // 2. Synchronize current turn
        if (roomData.currentTurn) {
          setCurrentTurn(roomData.currentTurn);
        }
        
        // 3. Synchronize players list and assign names
        if (roomData.players) {
          const hostName = roomData.players[0] || "Host Player";
          const guestName = roomData.players[1] || "Guest Player";
          
          if (myOnlineSymbol === "X") {
            // We are Host, opponent is Guest
            setPlayerX(prev => ({ ...prev, name: hostName }));
            setPlayerO(prev => ({ ...prev, name: guestName }));
            setMockOpponent({
              name: guestName,
              ping: Math.floor(Math.random() * 20) + 12,
              winRate: "52%"
            });
          } else {
            // We are Guest, opponent is Host
            setPlayerX(prev => ({ ...prev, name: hostName }));
            setPlayerO(prev => ({ ...prev, name: guestName }));
            setMockOpponent({
              name: hostName,
              ping: Math.floor(Math.random() * 20) + 12,
              winRate: "52%"
            });
          }
        }

        // 4. Update matchmakingState and game status
        if (roomData.status === "waiting") {
          setMatchmakingState("searching");
        } else if (roomData.status === "playing") {
          setMatchmakingState("playing");
          setIsGameActive(true);
        } else if (roomData.status === "finished") {
          setMatchmakingState("playing");
          setIsGameActive(false);
          
          if (roomData.boardState) {
            const result = checkGameState(roomData.boardState);
            setWinResult(result);
            if (result.winner) {
              setParticleWinner(result.winner);
            } else if (result.isDraw) {
              setParticleWinner("Draw");
            }
          }
        }
      },
      (error) => {
        console.error("Firestore room sync error:", error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [battleType, roomId, myOnlineSymbol]);

  // Real matchmaking stopwatch timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (matchmakingState === "searching") {
      setMatchmakingTime(0);
      interval = setInterval(() => {
        setMatchmakingTime(prev => {
          // Periodically check if another player joined the room (for hosts waiting)
          return prev + 1;
        });
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [matchmakingState]);

  // Fetch live active lobbies from Firestore
  useEffect(() => {
    if (gameMode !== "online" || onlineTab !== "lobbies") return;
    
    let active = true;
    const fetchLobbies = async () => {
      const list = await getActiveLobbies();
      if (active) {
        setLiveLobbies(list);
      }
    };
    
    fetchLobbies();
    const interval = setInterval(fetchLobbies, 4000); // refresh every 4s
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [gameMode, onlineTab]);

  // -------------------------------------------------------------
  // User Actions Processors
  // -------------------------------------------------------------
  const handlePlayOnline = async () => {
    try {
      setMyOnlineSymbol("X");
      const code = await createNewRoom(playerX.name);
      setRoomId(code);
      setIsMultiplayer(true);
      setCustomRoomCode(code);
      setGameMode("online");
      setOnlineTab("private");
      
      // Reset board and round settings
      setBoard([null, null, null, null, null, null, null, null, null]);
      setHistory([[null, null, null, null, null, null, null, null, null]]);
      setCurrentHistoryIndex(0);
      setStartingPlayer("X");
      setCurrentTurn("X");
      setWinResult({ winner: null, line: null, isDraw: false });
      setIsGameActive(true);
      setParticleWinner(null);
      setTurnTimerSeconds(15);
    } catch (error) {
      console.error("Failed to create online room:", error);
    }
  };

  const handleJoinOnline = async (codeToJoin: string) => {
    const trimmed = codeToJoin.trim();
    if (!trimmed) return;
    setJoinError(null);
    try {
      setMyOnlineSymbol("O");
      const success = await joinExistingRoom(trimmed, playerX.name);
      if (success) {
        setRoomId(trimmed);
        setIsMultiplayer(true);
        setCustomRoomCode(trimmed);
        setGameMode("online");
        setMatchmakingState("playing");
        
        // Reset board and round settings
        setBoard([null, null, null, null, null, null, null, null, null]);
        setHistory([[null, null, null, null, null, null, null, null, null]]);
        setCurrentHistoryIndex(0);
        setStartingPlayer("X");
        setCurrentTurn("X");
        setWinResult({ winner: null, line: null, isDraw: false });
        setIsGameActive(true);
        setParticleWinner(null);
        setTurnTimerSeconds(15);
      } else {
        setJoinError("Room Code not found or Room is full! Please verify and try again.");
      }
    } catch (error) {
      console.error("Failed to join online room:", error);
      setJoinError("An error occurred. Please try again.");
    }
  };

  const handleQuickMatch = async () => {
    setMatchmakingState("searching");
    setMatchmakingTime(0);
    try {
      // 1. Try to find an existing waiting room
      const foundCode = await findAndJoinWaitingRoom(playerX.name);
      if (foundCode) {
        setMyOnlineSymbol("O"); // We joined, we are O
        setRoomId(foundCode);
        setCustomRoomCode(foundCode);
        setGameMode("online");
        setMatchmakingState("playing");
      } else {
        // 2. No waiting room found, create a new matchmaking lobby
        setMyOnlineSymbol("X"); // We created, we are X
        const newCode = await createNewRoom(playerX.name);
        setRoomId(newCode);
        setCustomRoomCode(newCode);
        setGameMode("online");
        setMatchmakingState("searching"); // Wait for joiner onSnapshot update
      }
    } catch (error) {
      console.error("Matchmaking error:", error);
      setMatchmakingState("idle");
    }
  };

  const handleCellClick = (index: number) => {
    // Check if cell contains slot or game completed
    if (board[index] !== null || winResult.winner || winResult.isDraw) {
      if (soundEnabled) playErrorSound();
      return;
    }

    // Ignore clicks when it is the AI's turn to prevent double overlays
    if (gameMode === "pve" && currentTurn === "O") {
      return;
    }

    // Ignore clicks when online mode is not in session or it is remote opponent's turn
    if (gameMode === "online" && (currentTurn !== myOnlineSymbol || matchmakingState !== "playing")) {
      return;
    }

    executeMoveAt(index);
  };

  const executeMoveAt = (index: number) => {
    // Double check that room is available
    if (board[index] !== null || winResult.winner || winResult.isDraw) {
      return;
    }

    // Capture sound trigger
    if (soundEnabled) {
      if (currentTurn === "X") playXSound();
      else playOSound();
    }

    // Build next board status representation
    const updatedBoard = [...board];
    updatedBoard[index] = currentTurn;

    if (gameMode === "online" && roomId) {
      // In online mode, write direct update to Firestore and let subscription update local state
      const nextTurn = currentTurn === "X" ? "O" : "X";
      const result = checkGameState(updatedBoard);
      const nextStatus = (result.winner || result.isDraw) ? "finished" : "playing";

      updateRoomState(roomId, {
        boardState: updatedBoard,
        currentTurn: nextTurn,
        status: nextStatus
      }).catch(err => {
        console.error("Failed to update Firestore room move:", err);
      });
      return;
    }

    // Prune forward records if user did "Undo" and now makes a new divergent move
    const updatedHistoryChain = history.slice(0, currentHistoryIndex + 1);
    const newHistoryChain = [...updatedHistoryChain, updatedBoard];

    setBoard(updatedBoard);
    setHistory(newHistoryChain);
    setCurrentHistoryIndex(newHistoryChain.length - 1);

    // Evaluate result status
    const result = checkGameState(updatedBoard);
    
    if (result.winner || result.isDraw) {
      // Round Complete
      setWinResult(result);
      setIsGameActive(false);

      if (result.winner) {
        // Play victory synthesizer sound
        if (soundEnabled) playVictorySound();
        setParticleWinner(result.winner);

        // Update winner score state
        if (result.winner === "X") {
          const nextScore = playerX.score + 1;
          setPlayerX(px => ({ ...px, score: nextScore }));
          localStorage.setItem("ttt_px_score", nextScore.toString());
        } else {
          const nextScore = playerO.score + 1;
          setPlayerO(po => ({ ...po, score: nextScore }));
          localStorage.setItem("ttt_po_score", nextScore.toString());
        }

        // Saved history log with correct dynamic participant names
        const participantO = getPlayerOName();
        saveMatchToHistory(result.winner, result.winner === "X" ? playerX.name : participantO, updatedBoard);
      } else if (result.isDraw) {
        if (soundEnabled) playDrawSound();
        setParticleWinner("Draw");
        saveMatchToHistory("Draw", "It's a Draw", updatedBoard);
      }
    } else {
      // Move to next player symbol turn
      setCurrentTurn(currentTurn === "X" ? "O" : "X");
    }
  };

  const saveMatchToHistory = (winnerSymbol: PlayerSymbol | "Draw", winnerName: string, finalBoard: BoardState) => {
    const newItem: MatchHistoryItem = {
      id: "match_" + Date.now(),
      winnerSymbol,
      winnerName,
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      boardSnapshot: finalBoard,
      durationSeconds: 15 - turnTimerSeconds
    };

    setMatchHistory(prev => {
      const nextList = [newItem, ...prev].slice(0, 5); // Keep last 5 matches
      localStorage.setItem("ttt_history", JSON.stringify(nextList));
      return nextList;
    });
  };

  // Undo standard steps
  const handleUndo = () => {
    if (currentHistoryIndex <= 0) {
      if (soundEnabled) playErrorSound();
      return;
    }
    const nextIdx = currentHistoryIndex - 1;
    setCurrentHistoryIndex(nextIdx);
    setBoard(history[nextIdx]);
    
    // Reverse turn
    setCurrentTurn(prevTurn => prevTurn === "X" ? "O" : "X");
    
    // Clear any active game win states to resume play
    setWinResult({ winner: null, line: null, isDraw: false });
    setIsGameActive(true);
    setParticleWinner(null);
  };

  // Redo standard steps 
  const handleRedo = () => {
    if (currentHistoryIndex >= history.length - 1) {
      if (soundEnabled) playErrorSound();
      return;
    }
    const nextIdx = currentHistoryIndex + 1;
    setCurrentHistoryIndex(nextIdx);
    const nextBoard = history[nextIdx];
    setBoard(nextBoard);

    // Determine currentTurn after the layout applied
    const result = checkGameState(nextBoard);
    if (result.winner || result.isDraw) {
      setWinResult(result);
      setIsGameActive(false);
      setParticleWinner(result.winner || "Draw");
    } else {
      setCurrentTurn(prevTurn => prevTurn === "X" ? "O" : "X");
    }
  };

  // Safe round restart keeps the score active
  const startNewRound = () => {
    // Decides starting player alternate sequence 
    const nextStarting = startingPlayer === "X" ? "O" : "X";
    setStartingPlayer(nextStarting);
    
    if (gameMode === "online" && roomId) {
      updateRoomState(roomId, {
        boardState: Array(9).fill(null),
        currentTurn: nextStarting,
        status: "playing"
      }).catch(err => {
        console.error("Failed to reset Firestore room state:", err);
      });
      return;
    }

    // Reset fields
    setBoard([null, null, null, null, null, null, null, null, null]);
    setHistory([[null, null, null, null, null, null, null, null, null]]);
    setCurrentHistoryIndex(0);
    setCurrentTurn(nextStarting);
    setWinResult({ winner: null, line: null, isDraw: false });
    setIsGameActive(true);
    setParticleWinner(null);
    setTurnTimerSeconds(15);
  };

  // Full reset wipes scores and match history cleanly
  const resetEntireGame = () => {
    setPlayerX(px => ({ ...px, name: "Alex Rivera", score: 0 }));
    setPlayerO(po => ({ ...po, name: "Sam Chen", score: 0 }));
    setMatchHistory([]);
    localStorage.removeItem("ttt_px_name");
    localStorage.removeItem("ttt_px_color");
    localStorage.removeItem("ttt_px_score");
    localStorage.removeItem("ttt_po_name");
    localStorage.removeItem("ttt_po_color");
    localStorage.removeItem("ttt_po_score");
    localStorage.removeItem("ttt_history");

    setBoard([null, null, null, null, null, null, null, null, null]);
    setHistory([[null, null, null, null, null, null, null, null, null]]);
    setCurrentHistoryIndex(0);
    setStartingPlayer("X");
    setCurrentTurn("X");
    setWinResult({ winner: null, line: null, isDraw: false });
    setIsGameActive(true);
    setParticleWinner(null);
    setTurnTimerSeconds(15);
  };

  const handleGameModeToggle = (mode: "pvp" | "pve" | "online") => {
    setGameMode(mode);
    localStorage.setItem("ttt_game_mode", mode);
    
    // Reset online state if switching
    if (mode === "online") {
      setMatchmakingState("idle");
      setOnlineTab("quick");
    }
    
    // Reset round to run cleanly under the new selected mode
    setBoard([null, null, null, null, null, null, null, null, null]);
    setHistory([[null, null, null, null, null, null, null, null, null]]);
    setCurrentHistoryIndex(0);
    setStartingPlayer("X");
    setCurrentTurn("X");
    setWinResult({ winner: null, line: null, isDraw: false });
    setIsGameActive(true);
    setParticleWinner(null);
    setTurnTimerSeconds(15);
  };

  const handleDifficultyChange = (diff: "easy" | "medium" | "hard") => {
    setAiDifficulty(diff);
    localStorage.setItem("ttt_ai_difficulty", diff);
  };

  // Update profile player configuration 
  const triggerSavePlayerEdits = (pxName: string, pxColorKey: string, poName: string, poColorKey: string) => {
    const freshXName = pxName.trim() ? pxName : "Alex Rivera";
    const freshOName = poName.trim() ? poName : "Sam Chen";

    const pxPreset = COLOR_PRESETS.find(c => c.key === pxColorKey) || COLOR_PRESETS[0];
    const poPreset = COLOR_PRESETS.find(c => c.key === poColorKey) || COLOR_PRESETS[1];

    setPlayerX(px => ({
      ...px,
      name: freshXName,
      color: pxColorKey,
      accentColor: pxPreset.accent
    }));
    setPlayerO(po => ({
      ...po,
      name: freshOName,
      color: poColorKey,
      accentColor: poPreset.accent
    }));

    localStorage.setItem("ttt_px_name", freshXName);
    localStorage.setItem("ttt_px_color", pxColorKey);
    localStorage.setItem("ttt_po_name", freshOName);
    localStorage.setItem("ttt_po_color", poColorKey);

    setIsEditingNames(false);
  };

  // Easy Sound Toggle
  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem("ttt_sound", nextVal ? "true" : "false");
  };

  const activeColorX = COLOR_PRESETS.find(c => c.key === playerX.color) || COLOR_PRESETS[0];
  const activeColorO = COLOR_PRESETS.find(c => c.key === playerO.color) || COLOR_PRESETS[1];

  return (
    currentScreen === 'intro' ? (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
        height: '100vh', width: '100vw', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        position: 'fixed', top: 0, left: 0, zIndex: 9999, fontFamily: 'sans-serif'
      }}>
        <div style={{ position: 'absolute', top: '10%', left: '10%', fontSize: '8rem', color: '#334155', opacity: 0.15, fontWeight: 'bold' }}>X</div>
        <div style={{ position: 'absolute', bottom: '15%', right: '12%', fontSize: '9rem', color: '#334155', opacity: 0.15, fontWeight: 'bold' }}>O</div>
        <img src={gameLogo} alt="Logo" style={{ width: '130px', height: '130px', borderRadius: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', marginBottom: '25px' }} />
        <h1 style={{ fontSize: '2.8rem', color: '#ffffff', margin: '0 0 8px 0', fontWeight: 800 }}>Three in a Line</h1>
        <p style={{ color: '#94a3b8', fontSize: '1rem', margin: '0 0 45px 0' }}>BY GAURAV TIWARI</p>
        <button onClick={() => setCurrentScreen('game')} style={{ padding: '16px 55px', fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', backgroundColor: '#2563eb', border: 'none', borderRadius: '50px', cursor: 'pointer' }}>
          PLAY NOW
        </button>
      </div>
    ) : (
    <div id="tictactoe-root" className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between py-6 px-4 md:px-8 selection:bg-indigo-100">
      
      {/* -------------------------------------------------------------
          Top Navigation Bar Context
          ------------------------------------------------------------- */}
      <header id="top-bar" className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 mb-6 gap-4">
        {/* Left Elements: Elegant App Logo with App Name next to it */}
        <div className="flex items-center gap-3.5">
          <img
            id="game-logo"
            src={gameLogo}
            alt="Three in a Line Logo"
            className="w-12 h-12 md:w-14 md:h-14 rounded-2xl shadow-md border border-slate-200 object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="text-left">
            <h1 className="text-xl md:text-3xl font-black tracking-tight text-slate-900 italic leading-none">Three in a Line</h1>
            <span className="text-[10px] md:text-xs font-mono tracking-[0.05em] text-indigo-600 font-extrabold block pt-1">
              By Gaurav Tiwari
            </span>
          </div>
        </div>

        {/* Right Elements: Interactive Game Controls */}
        <div className="flex items-center gap-2 sm:self-center self-end">
          {/* Edit Players Profile Panel inline toggler */}
          <button 
            id="btn-edit-players"
            onClick={() => setIsEditingNames(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-100 transition duration-205 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Quick Info Trigger */}
          <button 
            id="btn-help"
            onClick={() => setIsHelpOpen(true)}
            className="p-2 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 transition duration-200 cursor-pointer"
            title="How to play"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Audio State Toggle */}
          <button 
            id="btn-sound"
            onClick={toggleSound}
            className="p-2 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 transition duration-200 cursor-pointer"
            title={soundEnabled ? "Mute audio" : "Unmute audio"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-indigo-600" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
          </button>
        </div>
      </header>

      {/* -------------------------------------------------------------
          Main Content Dynamic Layout Grid (Left / Center / Right)
          ------------------------------------------------------------- */}
      <main className="w-full max-w-6xl mx-auto flex-1 grid grid-cols-12 gap-8 items-start my-auto">
        
        {/* Left Section: Player 1 Status Card & Match History (3 cols on desktop) */}
        <div className="col-span-12 md:col-span-3 flex flex-col gap-6 w-full order-2 md:order-1">
          
          {/* Player X Widget */}
          <div className="flex flex-col gap-3">
            <div 
              className={`p-6 bg-white rounded-2xl shadow-xs border-2 transition-all duration-300 relative text-center flex flex-col items-center gap-4 ${
                currentTurn === "X" && isGameActive && !winResult.winner && !winResult.isDraw
                  ? "border-indigo-600 scale-102 ring-4 ring-indigo-50/70" 
                  : "border-slate-205 opacity-80"
              }`}
            >
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-4xl shadow-xs">
                X
              </div>
              <div className="w-full">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Player One</p>
                <h2 className="text-md font-bold text-slate-900 truncate px-2">{playerX.name}</h2>
              </div>
              <div className="w-full flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="text-slate-500 text-xs font-semibold">Total Wins</span>
                <span className="text-2xl font-black text-indigo-600">{String(playerX.score).padStart(2, '0')}</span>
              </div>
            </div>
            
            {currentTurn === "X" && isGameActive && !winResult.winner && !winResult.isDraw ? (
              <div className="p-3 bg-indigo-600 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-150 text-white font-bold text-xs tracking-wide">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                <span>CURRENT TURN</span>
              </div>
            ) : (
              <div className="p-3 border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 font-bold text-xs tracking-wide bg-slate-100/50">
                <span>WAITING...</span>
              </div>
            )}
          </div>

          {/* Match Log Panel nested elegantly under Left Sidebar on desktop */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Match Log</h3>
              </div>
              <span className="text-[9px] bg-slate-100 text-slate-500 font-mono font-bold px-1.5 py-0.5 rounded">
                Rounds
              </span>
            </div>

            {matchHistory.length === 0 ? (
              <div className="text-center py-6 px-2">
                <Trophy className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                  No rounds on record yet. Complete a round to save state.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-0.5">
                {matchHistory.map((match) => (
                  <div 
                    key={match.id}
                    className="p-2 ... rounded-xl bg-slate-50 border border-slate-150/70 flex items-center justify-between text-[11px] hover:border-slate-300"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`w-5 h-5 rounded-md text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
                        match.winnerSymbol === "X" 
                          ? `bg-indigo-50 text-indigo-600` 
                          : match.winnerSymbol === "O" 
                            ? `bg-rose-50 text-rose-500` 
                            : "bg-slate-200 text-slate-600"
                      }`}>
                        {match.winnerSymbol === "Draw" ? "=" : match.winnerSymbol}
                      </span>
                      <div className="truncate">
                        <p className="font-bold text-slate-800 truncate">
                          {match.winnerSymbol === "Draw" ? "Tie Game" : match.winnerName}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 shrink-0">
                      {match.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Center Section: Game Board Canvas Layout (6 cols on desktop) */}
        <div className="col-span-12 md:col-span-6 flex flex-col items-center order-1 md:order-2">
          
          {/* Game Mode Selector Widget (PvP vs PvE) and Difficulty Selectors */}
          <div className="w-full bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-xs flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Battle Type</span>
                <h3 className="text-sm font-black text-slate-800 leading-snug">Select opponent</h3>
              </div>
              <div className="w-full sm:w-auto flex bg-slate-100 p-1 rounded-xl select-none transition-all">
                <button
                  type="button"
                  onClick={() => handleGameModeToggle("pvp")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-1.5 sm:px-4 py-1.5 sm:py-2 font-bold text-[10px] sm:text-xs rounded-lg transition-all duration-150 cursor-pointer ${
                    gameMode === "pvp"
                      ? "bg-white text-indigo-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id="gamemode-pvp"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Pass & Play</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGameModeToggle("pve")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-1.5 sm:px-4 py-1.5 sm:py-2 font-bold text-[10px] sm:text-xs rounded-lg transition-all duration-150 cursor-pointer ${
                    gameMode === "pve"
                      ? "bg-white text-indigo-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id="gamemode-pve"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>A.I. Battle</span>
                </button>
                <button
                  type="button"
                  onClick={handlePlayOnline}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-1.5 sm:px-4 py-1.5 sm:py-2 font-bold text-[10px] sm:text-xs rounded-lg transition-all duration-150 cursor-pointer ${
                    gameMode === "online"
                      ? "bg-white text-indigo-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id="gamemode-online"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Play Online</span>
                </button>
              </div>
            </div>

            {/* Sub difficulty drawer panel if VS AI is selected */}
            <AnimatePresence>
              {gameMode === "pve" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100"
                >
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                    <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                    A.I. Smartness Level
                  </span>
                  <div className="flex gap-1.5">
                    {(["easy", "medium", "hard"] as const).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => handleDifficultyChange(diff)}
                        className={`px-3 py-1 text-[10px] font-extrabold uppercase rounded-lg border transition duration-150 transform active:scale-95 cursor-pointer ${
                          aiDifficulty === diff
                            ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                        id={`ai-diff-${diff}`}
                      >
                        {diff === "easy" ? "Chilled" : diff === "medium" ? "Clever" : "Unbeatable"}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Turn timer & Dynamic State Feedback Notification */}
          {gameMode === "online" ? (
            <div className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 mb-6 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-emerald-50">
                  <Globe className="w-4 h-4 text-emerald-600 animate-pulse" />
                </span>
                <p className="text-sm font-semibold text-slate-700 flex flex-wrap items-center gap-1.5">
                  <span>Server Status: </span>
                  <span className="text-emerald-600 font-extrabold uppercase text-xs mr-1">Live</span>
                  {roomId && (
                    <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-md font-mono font-black text-xs">
                      Room: {roomId}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] bg-indigo-50 text-indigo-600 font-mono font-bold px-2.5 py-1 rounded-lg">
                <Users className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                <span>1,248 PLAYERS READY</span>
              </div>
            </div>
          ) : (
            <div className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 mb-6 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-slate-100">
                  {isGameActive ? (
                    isAiThinking ? (
                      <RefreshCw className="w-4 h-4 text-rose-500 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 text-indigo-600" />
                    )
                  ) : (
                    <Trophy className="w-4 h-4 text-amber-500 animate-bounce" />
                  )}
                </span>
                <p className="text-sm font-semibold text-slate-700">
                  {winResult.winner ? (
                    <span>
                      🎉 Winner: <strong className="text-amber-600 font-bold">{winResult.winner === "X" ? playerX.name : getPlayerOName()}</strong>!
                    </span>
                  ) : winResult.isDraw ? (
                    <span className="text-slate-500 font-bold">🤝 Tied Match!</span>
                  ) : (
                    <span>
                      {isAiThinking ? (
                        <span className="text-slate-500 animate-pulse">A.I. is planning strategy...</span>
                      ) : (
                        <>Turn: <strong className="text-slate-900 font-bold">{currentTurn === "X" ? playerX.name : getPlayerOName()}</strong> ({currentTurn})</>
                      )}
                    </span>
                  )}
                </p>
              </div>

              {isGameActive && !winResult.winner && !winResult.isDraw && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <span className="text-xs font-semibold font-mono text-slate-600 w-4 text-center">
                      {turnTimerSeconds}s
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setTimerActive(!timerActive)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition ${
                      timerActive ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-slate-150 text-slate-500"
                    }`}
                    title="Toggle moves countdown"
                    id="timer-toggle-btn"
                  >
                    {timerActive ? "Active" : "Paused"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Game Board Grid Canvas or Online HUB */}
          {gameMode === "online" && matchmakingState !== "playing" ? (
            <div className="relative w-full min-h-[395px] h-[395px] sm:h-[410px] max-w-[420px] bg-white border border-slate-200 p-4 rounded-3xl shadow-xl flex flex-col justify-between overflow-hidden transition-all">
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Lobby Category tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl mb-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setOnlineTab("quick")}
                    className={`flex-1 py-1 font-bold text-[11px] rounded-lg transition-all text-center cursor-pointer ${
                      onlineTab === "quick" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Quick Match
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlineTab("private")}
                    className={`flex-1 py-1 font-bold text-[11px] rounded-lg transition-all text-center cursor-pointer ${
                      onlineTab === "private" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Private Room
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlineTab("lobbies")}
                    className={`flex-1 py-1 font-bold text-[11px] rounded-lg transition-all text-center cursor-pointer ${
                      onlineTab === "lobbies" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Active Rooms
                  </button>
                </div>

                {/* Main Action area for chosen Tab */}
                <div className="flex-1 flex flex-col justify-center items-center overflow-hidden">
                  <AnimatePresence mode="wait">
                    {onlineTab === "quick" && (
                      <motion.div
                        key="tab-quick"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="w-full flex flex-col items-center text-center px-1"
                      >
                        {matchmakingState === "idle" && (
                          <>
                            <div className="w-13 h-13 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-3 relative shadow-xs">
                              <Radio className="w-6.5 h-6.5 text-indigo-600 animate-pulse" />
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full animate-ping" />
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-800 tracking-tight">Global Matchmaking</h4>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-[280px] leading-relaxed">
                              Match with active players in real-time across regional game shards.
                            </p>
                            <button
                              type="button"
                              onClick={() => handleQuickMatch()}
                              className="mt-4 px-5 py-2 bg-indigo-600 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-md shadow-indigo-150 hover:bg-indigo-700 active:scale-95 transition cursor-pointer"
                            >
                              Find Competitor
                            </button>
                          </>
                        )}

                        {matchmakingState === "searching" && (
                          <>
                            <div className="w-14 h-14 bg-indigo-50/50 rounded-full border border-indigo-100 flex items-center justify-center mb-2.5 relative overflow-hidden">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                                className="absolute inset-0 border-t-2 border-indigo-600 rounded-full"
                              />
                              <Globe className="w-6.5 h-6.5 text-indigo-600 animate-pulse" />
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-800">Searching Battlegrounds...</h4>
                            <p className="text-[10px] text-slate-400 mt-1 font-mono uppercase tracking-wider font-bold">
                              Time Elapsed: {matchmakingTime}s
                            </p>
                            <p className="text-[10px] text-slate-555 mt-2 animate-pulse bg-slate-50 border border-slate-150 rounded-full px-3 py-0.5 font-semibold">
                              {matchmakingTime <= 1 ? "Connecting matchmaker..." : matchmakingTime <= 3 ? "Matching rankings..." : "Securing low latency slot..."}
                            </p>
                            <button
                              type="button"
                              onClick={() => setMatchmakingState("idle")}
                              className="mt-3.5 text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-50 hover:bg-rose-100/75 px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                            >
                              Cancel Search
                            </button>
                          </>
                        )}

                        {matchmakingState === "found" && mockOpponent && (
                          <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-full flex flex-col items-center"
                          >
                            <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-2">
                              <ShieldCheck className="w-6.5 h-6.5" />
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-850">Opponent Secured!</h4>
                            <div className="w-full bg-slate-50 border border-slate-150 rounded-xl p-3 mt-2 text-left space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opponent ID</span>
                                <span className="text-xs font-black text-indigo-600">{mockOpponent.name}</span>
                              </div>
                              <div className="flex items-center justify-between border-t border-slate-150 pt-1.5 text-xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ping Status</span>
                                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                                  {mockOpponent.ping} ms
                                </span>
                              </div>
                              <div className="flex items-center justify-between border-t border-slate-150 pt-1.5 text-xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opponent Stats</span>
                                <span className="text-xs font-mono font-bold text-slate-700">{mockOpponent.winRate} WR</span>
                              </div>
                            </div>
                            <div className="flex gap-2 w-full mt-3.5">
                              <button
                                type="button"
                                onClick={() => setMatchmakingState("idle")}
                                className="flex-1 py-1.5 bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase rounded-xl transition cursor-pointer hover:bg-slate-200"
                              >
                                Re-queue
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMatchmakingState("playing");
                                  setBoard([null, null, null, null, null, null, null, null, null]);
                                  setHistory([[null, null, null, null, null, null, null, null, null]]);
                                  setCurrentHistoryIndex(0);
                                  setStartingPlayer("X");
                                  setCurrentTurn("X");
                                  setWinResult({ winner: null, line: null, isDraw: false });
                                  setIsGameActive(true);
                                  setParticleWinner(null);
                                  setTurnTimerSeconds(15);
                                }}
                                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase rounded-xl shadow-md transition active:scale-95 cursor-pointer"
                              >
                                Enter Arena
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}

                    {onlineTab === "private" && (
                      <motion.div
                        key="tab-private"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full flex flex-col px-1"
                      >
                        <div className="bg-slate-50 border border-slate-150 p-3 rounded-2xl mb-2 text-left">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Your Space Link Code</label>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-slate-850 tracking-wider flex-1 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-center">
                              {customRoomCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(customRoomCode);
                                setCopiedCode(true);
                                setTimeout(() => setCopiedCode(false), 2000);
                              }}
                              className="p-2 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 bg-white rounded-xl transition cursor-pointer shrink-0"
                              title="Copy code link to invite companions"
                            >
                              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <span className="text-[9px] text-slate-400 mt-1 block leading-relaxed">
                            Provide this code to your friends to play directly.
                          </span>
                        </div>

                        <div className="border-t border-slate-150 pt-2 text-left">
                          <label className="text-[9px] font-black uppercase text-indigo-650 tracking-wider block mb-1">Enter Firestore Room Code</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              maxLength={4}
                              value={inputRoomCode}
                              onChange={(e) => {
                                setInputRoomCode(e.target.value.replace(/\D/g, ''));
                                setJoinError(null);
                              }}
                              placeholder="4-digit code"
                              className="font-mono text-center text-xs font-bold bg-white text-slate-800 border border-slate-250 rounded-xl px-3 py-1.5 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleJoinOnline(inputRoomCode)}
                              className="px-3.5 bg-indigo-600 text-white font-extrabold text-[10px] uppercase rounded-xl hover:bg-indigo-700 active:scale-95 transition cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <span>Join Room</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                          {joinError && (
                            <p className="text-[9px] font-bold text-rose-500 mt-1.5 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">
                              {joinError}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {onlineTab === "lobbies" && (
                      <motion.div
                        key="tab-lobbies"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full flex-1 flex flex-col h-full overflow-hidden"
                      >
                        <div className="text-left mb-1 flex justify-between items-center px-1 shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Battle Lobbies</span>
                          <span className="text-[9px] bg-slate-100 text-slate-500 font-mono font-bold px-2 py-0.5 rounded-full">
                            Refresh: Active
                          </span>
                        </div>
                        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[140px] pr-0.5 text-slate-700">
                          {liveLobbies.length === 0 ? (
                            <div className="text-center py-6 text-slate-400">
                              <Radio className="w-5 h-5 mx-auto mb-1.5 text-slate-300 animate-pulse" />
                              <p className="text-[10px] font-bold">No active lobbies detected</p>
                              <p className="text-[9px] mt-0.5">Go to "Private Room" to host a game!</p>
                            </div>
                          ) : (
                            liveLobbies.map((room) => (
                              <div
                                key={room.code}
                                className="p-2 rounded-xl bg-slate-50 border border-slate-150 flex items-center justify-between text-xs"
                              >
                                <div className="text-left max-w-[190px] truncate">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-extrabold text-[10px] text-slate-800">{room.code}</span>
                                    <span className="text-slate-300 text-[10px]">|</span>
                                    <span className="text-slate-600 font-bold font-sans truncate">{room.host}</span>
                                  </div>
                                  <span className="text-[9px] font-mono text-slate-400">
                                    Created: {new Date(room.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-slate-500">{room.playersCount}/2</span>
                                  {room.playersCount < 2 && room.status === "waiting" ? (
                                    <button
                                      type="button"
                                      onClick={() => handleJoinOnline(room.code)}
                                      className="px-2 py-1 text-[9px] font-extrabold uppercase bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 rounded-md transition cursor-pointer"
                                    >
                                      Join
                                    </button>
                                  ) : (
                                    <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-1 rounded-md uppercase">
                                      Full
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              {/* Online Multiplayer Bottom Guide Tips */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-semibold mt-3 shrink-0">
                <span className="flex items-center gap-1">
                  <Gamepad2 className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                  Classic 3x3 Grid combat protocols
                </span>
                <span className="text-slate-400 flex items-center gap-1 font-mono uppercase text-[9px] font-black">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Cluster: AP-1
                </span>
              </div>
            </div>
          ) : (
            <div className="relative w-full aspect-square max-w-[420px] bg-slate-200 p-3 rounded-3xl shadow-xl flex items-center justify-center border border-slate-300">
              
              {/* Background Grid structure lines helper */}
              <div className="absolute inset-3.5 grid grid-cols-3 grid-rows-3 gap-3 pointer-events-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={`cell-bg-${i}`} className="bg-white/80 rounded-xl border border-slate-100/60 shadow-xs" />
                ))}
              </div>

              {/* Interactive Grid cells */}
              <div className="absolute inset-3.5 grid grid-cols-3 grid-rows-3 gap-3">
                {board.map((cell, idx) => {
                  const isWinningCell = winResult.line?.includes(idx);
                  return (
                    <button
                      key={`board-cell-${idx}`}
                      id={`cell-${idx}`}
                      onClick={() => handleCellClick(idx)}
                      className={`relative w-full h-full rounded-xl flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-200 ${
                        cell === null 
                          ? (isAiThinking ? "bg-transparent cursor-not-allowed" : "bg-transparent hover:bg-slate-100/40 active:scale-95 cursor-pointer group")
                          : "bg-white hover:shadow-xs shadow-xs"
                      } ${
                        isWinningCell 
                          ? "shadow-md scale-102 ring-4 ring-amber-400 bg-amber-50/60" 
                          : ""
                      }`}
                      aria-label={`Grid index ${idx}: ${cell || "empty"}`}
                      disabled={isAiThinking && cell === null}
                    >
                      {/* Ghost preview of active turn symbol if space is empty */}
                      {cell === null && !winResult.winner && !winResult.isDraw && isGameActive && !isAiThinking && (
                        <span className={`text-4xl md:text-5xl font-black opacity-0 group-hover:opacity-10 transition-opacity duration-150 ${
                          currentTurn === "X" ? "text-indigo-600" : "text-rose-500"
                        }`}>
                          {currentTurn}
                        </span>
                      )}

                      <AnimatePresence>
                        {cell === "X" && (
                          <motion.span 
                             initial={{ scale: 0.5, opacity: 0 }}
                             animate={{ scale: 1, opacity: 1 }}
                             className="text-indigo-600 text-5xl md:text-6xl font-black"
                          >
                            X
                          </motion.span>
                        )}

                        {cell === "O" && (
                          <motion.span 
                             initial={{ scale: 0.5, opacity: 0 }}
                             animate={{ scale: 1, opacity: 1 }}
                             className="text-rose-500 text-5xl md:text-6xl font-black"
                          >
                            O
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  );
                })}
              </div>

              {/* Winner banner overlay */}
              {particleWinner && (() => {
                const isTie = particleWinner === "Draw";
                const isAiWinner = gameMode === "pve" && particleWinner === "O";
                const isOnlineDefeat = gameMode === "online" && particleWinner === "O";
                const isHumanWinner = !isTie && !isAiWinner && !isOnlineDefeat;

                let title = "Victory!";
                let subtitle = `Well played, ${particleWinner === "X" ? playerX.name : getPlayerOName()}! Victory is yours.`;
                let iconElement = <Trophy className="w-16 h-16 text-amber-500 mx-auto mb-3 animate-bounce" />;

                if (isTie) {
                  title = "It's a Tie!";
                  subtitle = "Excellent defense. The battlefield is completely balanced.";
                  iconElement = (
                    <div className="text-5xl mx-auto mb-3 select-none animate-bounce h-16 w-16 flex items-center justify-center filter drop-shadow-sm">
                      🤝
                    </div>
                  );
                } else if (isAiWinner || isOnlineDefeat) {
                  title = "Defeat!";
                  subtitle = isAiWinner 
                    ? "The machine has outsmarted you this round. Regroup and try again!"
                    : "Your opponent has claimed victory. Ready for a rematch?";
                  iconElement = (
                    <div className="text-5xl mx-auto mb-3 select-none animate-bounce h-16 w-16 flex items-center justify-center filter drop-shadow-sm">
                      🤖
                    </div>
                  );
                }

                return (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 text-center z-10">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    >
                      {iconElement}
                      <h3 className="text-2xl font-bold text-slate-900">
                        {title}
                      </h3>
                      <p className="text-sm font-medium text-slate-500 mt-1 max-w-xs mx-auto">
                        {subtitle}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2.5 justify-center">
                        {gameMode === "online" ? (
                          <>
                            <button
                              onClick={startNewRound}
                              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition transform active:scale-95 duration-150"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Rematch Companion</span>
                            </button>
                            <button
                              onClick={() => setMatchmakingState("idle")}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition transform active:scale-95 duration-150"
                            >
                              Exit to Lobby
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={startNewRound}
                            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-sm rounded-xl shadow-lg cursor-pointer transition transform active:scale-95 duration-150"
                            id="popup-next-round-btn"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>Next Round</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Controls Bar directly under Board matching theme design buttons */}
          <div className="w-full flex justify-between items-center bg-white border border-slate-200 p-3 rounded-2xl shadow-xs gap-3 mt-6">
            <div className="flex gap-2">
              <button
                onClick={handleUndo}
                disabled={currentHistoryIndex === 0}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition ${
                  currentHistoryIndex === 0 
                    ? "text-slate-300 border-slate-100 bg-slate-50/50 cursor-not-allowed" 
                    : "text-slate-700 border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 cursor-pointer"
                }`}
                title="Undo last move"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>

              <button
                onClick={handleRedo}
                disabled={currentHistoryIndex >= history.length - 1}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition ${
                  currentHistoryIndex >= history.length - 1 
                    ? "text-slate-350 border-slate-100 bg-slate-50/50 cursor-not-allowed" 
                    : "text-slate-700 border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 cursor-pointer"
                }`}
                title="Redo next move"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span>Redo</span>
              </button>
            </div>

            {gameMode === "online" ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (confirm("Disconnect and leave the active arena? Your current progress in this match will be lost.")) {
                      setMatchmakingState("idle");
                    }
                  }}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-extrabold rounded-xl transition-all active:scale-95 cursor-pointer border border-rose-200"
                >
                  LEAVE ARENA
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={startNewRound}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  RESET BOARD
                </button>
                <button
                  onClick={() => {
                    if(confirm("Do you want to start a brand new series and wipe all wins?")) {
                      resetEntireGame();
                    }
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  NEW SERIES
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right Section: Player 2 Status Card & Rules Manual (3 cols on desktop) */}
        <div className="col-span-12 md:col-span-3 flex flex-col gap-6 w-full order-3">
          
          {/* Player O Widget */}
          <div className="flex flex-col gap-3">
            <div 
              className={`p-6 bg-white rounded-2xl shadow-xs border-2 transition-all duration-300 relative text-center flex flex-col items-center gap-4 ${
                currentTurn === "O" && isGameActive && !winResult.winner && !winResult.isDraw
                  ? "border-rose-500 scale-102 ring-4 ring-rose-50/70" 
                  : "border-slate-100 opacity-80"
              }`}
            >
              {gameMode === "pve" ? (
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shadow-xs">
                  <Cpu className="w-9 h-9" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center font-black text-4xl shadow-xs">
                  O
                </div>
              )}
              <div className="w-full">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  {gameMode === "pve" ? "A.I. Opponent" : (gameMode === "online" ? "Online Opponent" : "Player Two")}
                </p>
                <h2 className="text-md font-bold text-slate-900 truncate px-2">
                  {getPlayerOName()}
                </h2>
                {gameMode === "pve" && (
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase bg-rose-50 text-rose-500 border border-rose-100">
                    {aiDifficulty === "easy" ? "Chilled" : aiDifficulty === "medium" ? "Clever" : "Unbeatable"}
                  </span>
                )}
                {gameMode === "online" && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Ping: {onlineLatency}ms
                  </span>
                )}
              </div>
              <div className="w-full flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="text-slate-500 text-xs font-semibold">Total Wins</span>
                <span className="text-2xl font-black text-rose-500">{String(playerO.score).padStart(2, '0')}</span>
              </div>
            </div>

            {currentTurn === "O" && isGameActive && !winResult.winner && !winResult.isDraw ? (
              <div className="p-3 bg-rose-500 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-rose-150 text-white font-bold text-xs tracking-wide">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                <span>{isAiThinking ? "A.I. THINKING..." : "CURRENT TURN"}</span>
              </div>
            ) : (
              <div className="p-3 border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 font-bold text-xs tracking-wide bg-slate-100/50">
                <span>WAITING...</span>
              </div>
            )}
          </div>

          {/* Help Rules manual box formatted professionally */}
          <div className="bg-gradient-to-br from-white to-slate-100/30 border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Rules of Play
            </h4>
            <ul className="space-y-2 text-[11px] text-slate-500 font-medium">
              <li className="flex items-start gap-1.5">
                <span className="text-slate-300">•</span>
                <span>Place markings to link three squares horizontally, vertically, or diagonally.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-slate-300">•</span>
                <span>An integrated turn countdown checks timers and shifts turns if required.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-slate-300">•</span>
                <span>The system tracks win streaks and series indices securely with persistent storage.</span>
              </li>
            </ul>
          </div>

        </div>

      </main>

      {/* -------------------------------------------------------------
          Modal view: Edit Names & Choice Colors
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {isEditingNames && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-5">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  <span>Game Settings & Players</span>
                </h3>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget;
                  const xName = (target.elements.namedItem("pxNameInput") as HTMLInputElement).value;
                  const xCol = (target.elements.namedItem("pxColorSelector") as HTMLSelectElement).value;
                  const oName = (target.elements.namedItem("poNameInput") as HTMLInputElement).value;
                  const oCol = (target.elements.namedItem("poColorSelector") as HTMLSelectElement).value;
                  triggerSavePlayerEdits(xName, xCol, oName, oCol);
                }}
                className="space-y-5"
              >
                
                {/* Player X Info Block */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-205">
                  <span className="text-[10px] font-mono tracking-wider font-extrabold text-indigo-600 uppercase block mb-1">
                    Symbol X Name
                  </span>
                  
                  <div className="space-y-3">
                    <div>
                      <input 
                        name="pxNameInput"
                        type="text" 
                        maxLength={18}
                        defaultValue={playerX.name}
                        placeholder="Player 1"
                        className="w-full bg-white border border-slate-305 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    <div className="hidden">
                      <select 
                        name="pxColorSelector"
                        defaultValue={playerX.color}
                        className="w-full"
                      >
                        <option value="indigo">Indigo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Player O Info Block */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-205">
                  <span className="text-[10px] font-mono tracking-wider font-extrabold text-rose-600 uppercase block mb-1">
                    {gameMode === "pve" ? "Symbol O Status (Uneditable in A.I. Battle)" : (gameMode === "online" ? "Symbol O Status (Uneditable Online)" : "Symbol O Name")}
                  </span>
                  
                  <div className="space-y-3">
                    <div>
                      <input 
                        name="poNameInput"
                        type="text" 
                        maxLength={18}
                        defaultValue={getPlayerOName()}
                        placeholder="Player 2"
                        className="w-full bg-white border border-slate-350 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100"
                        required
                        disabled={gameMode === "pve" || gameMode === "online"}
                      />
                    </div>

                    <div className="hidden">
                      <select 
                        name="poColorSelector"
                        defaultValue={playerO.color}
                        className="w-full"
                      >
                        <option value="rose">Rose</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Game Sound Settings Toggle Panel */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-mono tracking-wider font-extrabold text-indigo-600 uppercase block mb-2">
                    Audio & soundscape
                  </span>
                  
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                    <div className="text-left flex items-center gap-3">
                      <div className={`p-2 rounded-lg transition-colors ${soundEnabled ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                        {soundEnabled ? <Volume2 className="w-5 h-5 animate-pulse" /> : <VolumeX className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Game Sound Effects</p>
                        <p className="text-[10px] text-slate-400 font-medium">Buzzer clicks, victory tunes, or blocks error play</p>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={toggleSound}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        soundEnabled ? "bg-indigo-600" : "bg-slate-300"
                      }`}
                      aria-label="Toggle game sounds"
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          soundEnabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Clear triggers */}
                <div className="flex gap-3 justify-end pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsEditingNames(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl cursor-pointer transition shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------
          Modal view: Help Instructions Manual
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-center pb-3 border-b border-neutral-100 mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-600" />
                  <span>How to Play & Shortcuts</span>
                </h3>
              </div>

              <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Beautiful Theme Layout</h4>
                  <p>Matches standard "Professional Polish" design rules with modern sidebars and interactive hover feedback. Game settings and player names are saved locally instantly.</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Pass-and-Play PVP Mode</h4>
                  <p>Click any cell to mark choice. Turn symbols rotate at each complete round automatically to preserve full fairness.</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Undo / Redo</h4>
                  <p>Allows players to go back in turn history or restore moves instantly if needed.</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Turn Countdowns</h4>
                  <p>Each active player has 15 seconds to finalize a turn before the marker shifts to ensure swift play.</p>
                </div>
              </div>

              <div className="flex justify-end pt-5 border-t border-slate-100 mt-5">
                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition.transform active:scale-97 duration-150"
                >
                  Got It!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Branding info */}
      <footer id="main-footer" className="w-full max-w-6xl mx-auto text-center pt-6 mt-6 border-t border-slate-200">
         <p className="text-[10px] text-slate-400 font-bold font-mono tracking-wider uppercase">
          Three in a Line Edition • Engineered for precision responsive displays
        </p>
      </footer>

    </div>
    )
  );
}
