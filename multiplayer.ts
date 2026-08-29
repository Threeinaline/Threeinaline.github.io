import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  limit
} from "firebase/firestore";
import { db, auth } from "./firebase";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Generates a random 4-digit room code string.
 */
export const generateRoomCode = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Creates a new room document in Firestore using a random 4-digit code as the ID.
 */
export const createNewRoom = async (playerName: string): Promise<string> => {
  const code = generateRoomCode();
  const path = `rooms/${code}`;
  try {
    const roomRef = doc(db, "rooms", code);
    
    await setDoc(roomRef, {
      code: code,
      createdAt: new Date().toISOString(),
      status: "waiting", // waiting for another player
      players: [playerName],
      boardState: Array(9).fill(null),
      currentTurn: "X"
    });

    return code;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
};

/**
 * Checks if a room document exists in Firestore and updates its status to join it.
 */
export const joinExistingRoom = async (code: string, playerName: string): Promise<boolean> => {
  const path = `rooms/${code}`;
  try {
    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
      const roomData = roomSnap.data();
      // If player is already in the list, just return true
      if (roomData.players && roomData.players.includes(playerName)) {
        return true;
      }
      
      // Prevent joining a full room if there are already 2 players and we aren't one of them
      if (roomData.players && roomData.players.length >= 2) {
        return false;
      }

      await updateDoc(roomRef, {
        status: "playing",
        players: arrayUnion(playerName)
      });
      return true;
    }
    return false;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
};

/**
 * Subscribes to changes in a Firestore room.
 */
export const subscribeToRoom = (
  code: string,
  onUpdate: (data: any) => void,
  onError?: (err: any) => void
) => {
  const roomRef = doc(db, "rooms", code);
  return onSnapshot(
    roomRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data());
      } else {
        if (onError) onError(new Error("Room not found"));
      }
    },
    (error) => {
      console.error(`Error in snapshot for room ${code}:`, error);
      if (onError) onError(error);
    }
  );
};

/**
 * Updates room fields in Firestore.
 */
export const updateRoomState = async (code: string, updates: Record<string, any>): Promise<void> => {
  const path = `rooms/${code}`;
  try {
    const roomRef = doc(db, "rooms", code);
    await updateDoc(roomRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
};

/**
 * Quick Match Matchmaking: Finds a waiting room and joins it, or returns null if none found.
 */
export const findAndJoinWaitingRoom = async (playerName: string): Promise<string | null> => {
  try {
    const roomsRef = collection(db, "rooms");
    const q = query(roomsRef, where("status", "==", "waiting"), limit(10));
    const snapshot = await getDocs(q);
    
    for (const docSnap of snapshot.docs) {
      const roomData = docSnap.data();
      // Find a room where we can join (exactly 1 player currently, and it's not us)
      if (roomData.players && roomData.players.length === 1 && roomData.players[0] !== playerName) {
        const code = roomData.code;
        const success = await joinExistingRoom(code, playerName);
        if (success) {
          return code;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Error finding waiting room:", error);
    return null;
  }
};

/**
 * Live Lobby list representation
 */
export interface LobbyRoom {
  code: string;
  host: string;
  playersCount: number;
  createdAt: string;
  status: string;
}

/**
 * Fetches all active waiting or playing game lobbies from Firestore.
 */
export const getActiveLobbies = async (): Promise<LobbyRoom[]> => {
  try {
    const roomsRef = collection(db, "rooms");
    const q = query(roomsRef, where("status", "in", ["waiting", "playing"]), limit(15));
    const snapshot = await getDocs(q);
    
    const lobbies: LobbyRoom[] = [];
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      lobbies.push({
        code: data.code,
        host: data.players && data.players[0] ? data.players[0] : "Anonymous Host",
        playersCount: data.players ? data.players.length : 0,
        createdAt: data.createdAt,
        status: data.status,
      });
    });
    
    // Sort locally by creation date descending to keep newest rooms on top
    return lobbies.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.error("Error getting active lobbies:", error);
    return [];
  }
};
