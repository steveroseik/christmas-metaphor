/**
 * Calculate optimal maxPreferences and maxAvoids based on player count and targets per player
 * to minimize matchmaking conflicts
 */
export interface OptimalConfig {
  maxPreferences: number;
  maxAvoids: number;
  reasoning: string[];
}

export function calculateOptimalConfig(
  playerCount: number,
  targetsPerPlayer: number
): OptimalConfig {
  const reasoning: string[] = [];
  
  if (playerCount < 2) {
    return {
      maxPreferences: 0,
      maxAvoids: 0,
      reasoning: ['Need at least 2 players'],
    };
  }

  if (targetsPerPlayer < 1) {
    return {
      maxPreferences: 0,
      maxAvoids: 0,
      reasoning: ['Targets per player must be at least 1'],
    };
  }

  // Each player needs at least N valid candidates (players not in their avoids list)
  // Valid candidates = Total players - 1 (exclude self) - avoids
  // So: (playerCount - 1 - maxAvoids) >= targetsPerPlayer
  // Therefore: maxAvoids <= (playerCount - 1 - targetsPerPlayer)
  
  const maxPossibleAvoids = Math.max(0, playerCount - 1 - targetsPerPlayer);
  
  // For a safe margin, we'll use 80% of the maximum to leave some buffer
  const safeMaxAvoids = Math.floor(maxPossibleAvoids * 0.8);
  
  reasoning.push(
    `With ${playerCount} players, each player needs at least ${targetsPerPlayer} valid candidates.`
  );
  reasoning.push(
    `Maximum possible avoids per player: ${maxPossibleAvoids} (to ensure ${targetsPerPlayer} valid candidates remain).`
  );
  
  // For preferences, we can be more generous
  // A reasonable limit is about 50-70% of other players
  const otherPlayersCount = playerCount - 1;
  const suggestedMaxPreferences = Math.min(
    Math.ceil(otherPlayersCount * 0.6),
    otherPlayersCount
  );
  
  reasoning.push(
    `Suggested max preferences: ${suggestedMaxPreferences} (about 60% of other players for good matching flexibility).`
  );
  reasoning.push(
    `Suggested max avoids: ${safeMaxAvoids} (80% of maximum to leave safety margin for matchmaking).`
  );

  // Special cases
  if (playerCount === 2) {
    return {
      maxPreferences: 1,
      maxAvoids: 0,
      reasoning: [
        'With only 2 players, each must write about the other.',
        'Max avoids: 0 (cannot avoid the only other player)',
        'Max preferences: 1 (can prefer the other player)',
      ],
    };
  }

  if (maxPossibleAvoids <= 0) {
    return {
      maxPreferences: suggestedMaxPreferences,
      maxAvoids: 0,
      reasoning: [
        `With ${playerCount} players and ${targetsPerPlayer} targets per player,`,
        'players cannot avoid anyone (would leave insufficient candidates).',
        `Suggested max preferences: ${suggestedMaxPreferences}`,
      ],
    };
  }

  return {
    maxPreferences: suggestedMaxPreferences,
    maxAvoids: safeMaxAvoids,
    reasoning,
  };
}

