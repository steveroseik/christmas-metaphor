import { useState, useEffect } from 'react';
import { 
  doc, 
  getDoc, 
  onSnapshot, 
  setDoc, 
  collection, 
  query, 
  getDocs,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured, signInAnonymouslyUser } from '../firebase';
import { GameData, PlayerData, Player } from '../types';

// Document path: collection "christmas-metaphor", document "live_event"
const GAME_DOC_PATH = 'christmas-metaphor/live_event';
const PLAYERS_COLLECTION = 'christmas-metaphor/live_event/players';

export function useGame() {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Wait for authentication before setting up listeners
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setError('Firebase is not configured');
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        setCurrentUserId(user.uid);
      } else {
        // If not authenticated, try to sign in anonymously
        try {
          const signedInUser = await signInAnonymouslyUser();
          setIsAuthenticated(true);
          setCurrentUserId(signedInUser.uid);
        } catch (err) {
          console.error('Auth error:', err);
          setError('Failed to authenticate');
          setLoading(false);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Subscribe to game document (only after authentication)
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !isAuthenticated) {
      return;
    }

    const gameDocRef = doc(db, GAME_DOC_PATH);
    
    const unsubscribe = onSnapshot(
      gameDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as GameData;
          setGameData(data);
        } else {
          // Initialize game if it doesn't exist
          const initialData: GameData = {
            status: 'LOBBY',
            config: { 
              targetsPerPlayer: 2,
              maxPreferences: 10,
              maxAvoids: 5,
            },
            currentRevealId: null,
          };
          setDoc(gameDocRef, initialData).catch(err => {
            console.error('Error initializing game:', err);
            setError('Failed to initialize game');
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to game:', err);
        setError('Failed to load game');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Subscribe to players collection (only after authentication)
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !isAuthenticated) {
      return;
    }

    const playersQuery = query(collection(db, PLAYERS_COLLECTION));
    
    const unsubscribe = onSnapshot(
      playersQuery,
      (snapshot) => {
        const playersList: Player[] = [];
        snapshot.forEach((doc) => {
          playersList.push({
            uid: doc.id,
            data: doc.data() as PlayerData,
          });
        });
        setPlayers(playersList);
      },
      (err) => {
        console.error('Error listening to players:', err);
        setError('Failed to load players');
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Update game status
  const updateGameStatus = async (status: GameData['status']) => {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Firebase is not configured');
    }
    try {
      const gameDocRef = doc(db, GAME_DOC_PATH);
      await updateDoc(gameDocRef, { status });
    } catch (err) {
      console.error('Error updating game status:', err);
      setError('Failed to update game status');
      throw err;
    }
  };

  // Update game config
  const updateGameConfig = async (config: Partial<GameData['config']>) => {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Firebase is not configured');
    }
    try {
      const gameDocRef = doc(db, GAME_DOC_PATH);
      await updateDoc(gameDocRef, { 
        config: { ...gameData?.config, ...config } 
      });
    } catch (err) {
      console.error('Error updating game config:', err);
      setError('Failed to update game config');
      throw err;
    }
  };

  // Add or update player
  const upsertPlayer = async (uid: string, playerData: Partial<PlayerData>) => {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Firebase is not configured');
    }
    try {
      const playerDocRef = doc(db, PLAYERS_COLLECTION, uid);
      const existingDoc = await getDoc(playerDocRef);
      
      if (existingDoc.exists()) {
        await updateDoc(playerDocRef, playerData);
      } else {
        const newPlayerData: PlayerData = {
          name: playerData.name || '',
          preferences: playerData.preferences || [],
          avoids: playerData.avoids || [],
          assignments: playerData.assignments || [],
          submissions: playerData.submissions || {},
        };
        await setDoc(playerDocRef, newPlayerData);
      }
    } catch (err) {
      console.error('Error upserting player:', err);
      setError('Failed to save player data');
      throw err;
    }
  };

  // Update player preferences/avoids
  const updatePlayerPreferences = async (
    uid: string, 
    preferences: string[], 
    avoids: string[]
  ) => {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Firebase is not configured');
    }
    try {
      const playerDocRef = doc(db, PLAYERS_COLLECTION, uid);
      await updateDoc(playerDocRef, { preferences, avoids });
    } catch (err) {
      console.error('Error updating player preferences:', err);
      setError('Failed to update preferences');
      throw err;
    }
  };

  // Batch write assignments
  const writeAssignments = async (assignments: Array<{ writerId: string; targetId: string }>) => {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Firebase is not configured');
    }
    try {
      const batch = writeBatch(db);
      const assignmentMap = new Map<string, string[]>();

      // Group assignments by writer
      assignments.forEach(({ writerId, targetId }) => {
        if (!assignmentMap.has(writerId)) {
          assignmentMap.set(writerId, []);
        }
        assignmentMap.get(writerId)!.push(targetId);
      });

      // Write assignments to each player
      for (const [writerId, targetIds] of assignmentMap.entries()) {
        const playerDocRef = doc(db, PLAYERS_COLLECTION, writerId);
        batch.update(playerDocRef, { assignments: targetIds });
      }

      await batch.commit();
    } catch (err) {
      console.error('Error writing assignments:', err);
      setError('Failed to write assignments');
      throw err;
    }
  };

  // Submit writing for a target
  const submitWriting = async (
    uid: string, 
    targetId: string, 
    impression: string, 
    reality: string
  ) => {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Firebase is not configured');
    }
    try {
      const playerDocRef = doc(db, PLAYERS_COLLECTION, uid);
      const playerDoc = await getDoc(playerDocRef);
      
      if (!playerDoc.exists()) {
        throw new Error('Player not found');
      }

      const currentData = playerDoc.data() as PlayerData;
      const existingSubmission = currentData.submissions[targetId];
      const updatedSubmissions = {
        ...currentData.submissions,
        [targetId]: { 
          impression, 
          reality,
          writerRevealed: existingSubmission?.writerRevealed || false, // Preserve reveal status
        },
      };

      await updateDoc(playerDocRef, { submissions: updatedSubmissions });
    } catch (err) {
      console.error('Error submitting writing:', err);
      setError('Failed to submit writing');
      throw err;
    }
  };

  // Reveal writer name for a specific target
  const revealWriterName = async (writerId: string, targetId: string) => {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Firebase is not configured');
    }
    try {
      const writerDocRef = doc(db, PLAYERS_COLLECTION, writerId);
      const writerDoc = await getDoc(writerDocRef);
      
      if (!writerDoc.exists()) {
        throw new Error('Writer not found');
      }

      const currentData = writerDoc.data() as PlayerData;
      const submission = currentData.submissions[targetId];
      
      if (!submission) {
        throw new Error('Submission not found');
      }

      const updatedSubmissions = {
        ...currentData.submissions,
        [targetId]: {
          ...submission,
          writerRevealed: true,
        },
      };

      await updateDoc(writerDocRef, { submissions: updatedSubmissions });
    } catch (err) {
      console.error('Error revealing writer name:', err);
      setError('Failed to reveal writer name');
      throw err;
    }
  };

  // Reset game (admin only)
  const resetGame = async () => {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Firebase is not configured');
    }
    try {
      // Delete all players
      const playersQuery = query(collection(db, PLAYERS_COLLECTION));
      const snapshot = await getDocs(playersQuery);
      const batch = writeBatch(db);
      
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Reset game document
      const gameDocRef = doc(db, GAME_DOC_PATH);
      batch.set(gameDocRef, {
        status: 'LOBBY',
        config: { 
          targetsPerPlayer: 2,
          maxPreferences: 10,
          maxAvoids: 5,
        },
        currentRevealId: null,
      });

      await batch.commit();
    } catch (err) {
      console.error('Error resetting game:', err);
      setError('Failed to reset game');
      throw err;
    }
  };

  // Set current reveal
  const setCurrentReveal = async (revealId: string | null) => {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Firebase is not configured');
    }
    try {
      const gameDocRef = doc(db, GAME_DOC_PATH);
      await updateDoc(gameDocRef, { currentRevealId: revealId });
    } catch (err) {
      console.error('Error setting reveal:', err);
      setError('Failed to set reveal');
      throw err;
    }
  };

  return {
    gameData,
    players,
    loading,
    error,
    currentUserId,
    updateGameStatus,
    updateGameConfig,
    upsertPlayer,
    updatePlayerPreferences,
    writeAssignments,
    submitWriting,
    revealWriterName,
    resetGame,
    setCurrentReveal,
  };
}

