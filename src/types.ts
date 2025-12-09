export type GameStatus = 'LOBBY' | 'PREFERENCES' | 'WRITING' | 'REVEAL';

export interface GameConfig {
  targetsPerPlayer: number;
  maxPreferences: number;
  maxAvoids: number;
}

export interface GameData {
  status: GameStatus;
  config: GameConfig;
  currentRevealId: string | null;
}

export interface PlayerData {
  name: string;
  preferences: string[]; // User IDs the player "Starred/Liked"
  avoids: string[]; // User IDs the player explicitly "Blocked/Avoided"
  assignments: string[]; // Final assigned Target IDs
  submissions: Record<string, {
    impression: string;
    reality: string;
    writerRevealed?: boolean; // Whether the writer has chosen to reveal their name
  }>;
}

export interface Player {
  uid: string;
  data: PlayerData;
}

export interface Assignment {
  writerId: string;
  targetId: string;
}

