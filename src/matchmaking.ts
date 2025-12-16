import { Player, Assignment } from './types';

export interface ConflictAnalysis {
  hasConflict: boolean;
  suggestions: Array<{
    playerName: string;
    action: 'remove_avoid' | 'add_preference';
    targetPlayerName: string;
    reason: string;
  }>;
  summary: string;
}

/**
 * Analyze matchmaking conflicts and suggest solutions
 */
export function analyzeMatchmakingConflict(players: Player[], N: number): ConflictAnalysis {
  const suggestions: ConflictAnalysis['suggestions'] = [];
  
  // First, check if any player is avoided by everyone (critical issue)
  for (const targetPlayer of players) {
    const playersWhoCanWriteAboutTarget = players.filter(
      p => p.uid !== targetPlayer.uid && !p.data.avoids.includes(targetPlayer.uid)
    );
    
    const shortfall = N - playersWhoCanWriteAboutTarget.length;
    
    if (shortfall > 0) {
      // This player cannot receive enough assignments because too many people avoid them
      // Find players who are avoiding this target
      const playersAvoidingTarget = players.filter(
        p => p.uid !== targetPlayer.uid && p.data.avoids.includes(targetPlayer.uid)
      );
      
      // Suggest removing avoids, prioritizing players with fewer avoids themselves
      // (to avoid creating new conflicts)
      const sortedAvoiders = playersAvoidingTarget.sort((a, b) => {
        const aAvoids = a.data.avoids.length;
        const bAvoids = b.data.avoids.length;
        return aAvoids - bAvoids; // Prefer players with fewer avoids
      });
      
      // Suggest removing the minimum number of avoids needed
      for (let i = 0; i < Math.min(shortfall, sortedAvoiders.length); i++) {
        const writerPlayer = sortedAvoiders[i];
        suggestions.push({
          playerName: writerPlayer.data.name,
          action: 'remove_avoid',
          targetPlayerName: targetPlayer.data.name,
          reason: `${targetPlayer.data.name} is avoided by ${playersAvoidingTarget.length} player(s) and can only receive ${playersWhoCanWriteAboutTarget.length} assignment(s) but needs ${N}. ${writerPlayer.data.name} should remove their avoid for ${targetPlayer.data.name}.`,
        });
      }
    }
  }
  
  // Check each player's valid candidates (as a writer)
  for (const player of players) {
    const validCandidates = players.filter(
      p => p.uid !== player.uid && !player.data.avoids.includes(p.uid)
    );
    
    const shortfall = N - validCandidates.length;
    
    if (shortfall > 0) {
      // Player doesn't have enough valid candidates
      // Find players they're avoiding that could help
      const avoidedPlayers = players.filter(
        p => p.uid !== player.uid && player.data.avoids.includes(p.uid)
      );
      
      // Suggest removing avoids, prioritizing players with fewer avoids themselves
      // (to avoid creating new conflicts)
      const sortedAvoids = avoidedPlayers.sort((a, b) => {
        const aAvoids = a.data.avoids.length;
        const bAvoids = b.data.avoids.length;
        return aAvoids - bAvoids; // Prefer players with fewer avoids
      });
      
      // Suggest removing the minimum number of avoids needed
      for (let i = 0; i < Math.min(shortfall, sortedAvoids.length); i++) {
        const targetPlayer = sortedAvoids[i];
        suggestions.push({
          playerName: player.data.name,
          action: 'remove_avoid',
          targetPlayerName: targetPlayer.data.name,
          reason: `${player.data.name} has only ${validCandidates.length} valid candidates but needs ${N}. Removing avoid for ${targetPlayer.data.name} would help.`,
        });
      }
    }
  }
  
  // Also check for players who might benefit from adding preferences
  // (though this is less critical than removing avoids)
  for (const player of players) {
    const validCandidates = players.filter(
      p => p.uid !== player.uid && !player.data.avoids.includes(p.uid)
    );
    
    // If player has exactly N valid candidates, they're at the edge
    // Suggesting preferences won't help the conflict, but we can note it
    if (validCandidates.length === N) {
      const neutralPlayers = validCandidates.filter(
        candidate => !player.data.preferences.includes(candidate.uid)
      );
      
      if (neutralPlayers.length > 0) {
        // Not critical, but could help with optimization
        const targetPlayer = neutralPlayers[0];
        suggestions.push({
          playerName: player.data.name,
          action: 'add_preference',
          targetPlayerName: targetPlayer.data.name,
          reason: `${player.data.name} has exactly ${N} valid candidates. Adding ${targetPlayer.data.name} to preferences could help with matching.`,
        });
      }
    }
  }
  
  // Generate summary
  let summary = '';
  if (suggestions.length === 0) {
    summary = 'No obvious conflicts detected. The issue might be due to complex constraint interactions. Try lowering N or having players adjust their preferences.';
  } else {
    const removeAvoidCount = suggestions.filter(s => s.action === 'remove_avoid').length;
    const addPrefCount = suggestions.filter(s => s.action === 'add_preference').length;
    
    summary = `Found ${suggestions.length} suggestion(s): ${removeAvoidCount} remove avoid(s), ${addPrefCount} add preference(s).`;
  }
  
  return {
    hasConflict: suggestions.length > 0,
    suggestions,
    summary,
  };
}

/**
 * Matchmaking Algorithm with strict avoid constraints
 * Uses a randomized backtracking approach to find valid assignments
 */
export function runMatchmaking(players: Player[], N: number): Assignment[] | null {
  console.log('🎯 Starting matchmaking...', { playerCount: players.length, targetsPerPlayer: N });

  // Validate inputs
  if (players.length < 2) {
    console.error('❌ Need at least 2 players');
    return null;
  }

  if (N < 1) {
    console.error('❌ N must be at least 1');
    return null;
  }

  // Check if each player has enough valid candidates (as a writer)
  for (const player of players) {
    const validCandidates = players.filter(
      p => p.uid !== player.uid && !player.data.avoids.includes(p.uid)
    );
    
    if (validCandidates.length < N) {
      console.error(`❌ Player ${player.data.name} (${player.uid}) has only ${validCandidates.length} valid candidates but needs ${N}`);
      return null;
    }
  }

  // Check if any player is avoided by everyone (cannot receive assignments as a target)
  for (const targetPlayer of players) {
    const playersWhoCanWriteAboutTarget = players.filter(
      p => p.uid !== targetPlayer.uid && !p.data.avoids.includes(targetPlayer.uid)
    );
    
    if (playersWhoCanWriteAboutTarget.length < N) {
      console.error(`❌ Player ${targetPlayer.data.name} (${targetPlayer.uid}) is avoided by ${players.length - 1 - playersWhoCanWriteAboutTarget.length} player(s) and can only receive ${playersWhoCanWriteAboutTarget.length} assignment(s) but needs ${N}`);
      return null;
    }
  }

  // Create a map for quick lookups
  const playerMap = new Map(players.map(p => [p.uid, p]));
  const originalPlayerIds = players.map(p => p.uid);

  // Shuffle array helper
  function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Try multiple times with different randomizations
  const maxAttempts = 100;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Create shuffled player order for this attempt
    const shuffledPlayerIds = shuffle([...originalPlayerIds]);

    // Track assignments: writerId -> targetIds[]
    const assignments: Map<string, string[]> = new Map();
    originalPlayerIds.forEach(uid => assignments.set(uid, []));

    // Track target counts: targetId -> count
    const targetCounts: Map<string, number> = new Map();
    originalPlayerIds.forEach(uid => targetCounts.set(uid, 0));

    // Helper: Get valid candidates for a writer, prioritized
    function getValidCandidates(writerId: string): string[] {
      const writer = playerMap.get(writerId)!;
      const currentAssignments = assignments.get(writerId)!;
      
      // Get all valid candidates (not self, not in avoids, not already assigned, not at capacity)
      const valid = originalPlayerIds.filter(targetId => {
        if (targetId === writerId) return false;
        if (writer.data.avoids.includes(targetId)) return false;
        if (currentAssignments.includes(targetId)) return false;
        if (targetCounts.get(targetId)! >= N) return false;
        return true;
      });

      // Prioritize: preferences first, then neutral
      const preferences = valid.filter(id => writer.data.preferences.includes(id));
      const neutral = valid.filter(id => !writer.data.preferences.includes(id));
      
      // Shuffle for randomization
      return [...shuffle(preferences), ...shuffle(neutral)];
    }

    // Backtracking algorithm
    function backtrack(writerIndex: number): boolean {
      if (writerIndex >= shuffledPlayerIds.length) {
        // All writers have been processed
        return true;
      }

      const writerId = shuffledPlayerIds[writerIndex];
      const currentAssignments = assignments.get(writerId)!;
      
      // If this writer already has N assignments, move to next
      if (currentAssignments.length >= N) {
        return backtrack(writerIndex + 1);
      }

      // Get valid candidates for this writer
      const candidates = getValidCandidates(writerId);
      
      if (candidates.length === 0) {
        // No valid candidates - backtrack
        return false;
      }

      // Try each candidate
      for (const targetId of candidates) {
        // Make assignment
        currentAssignments.push(targetId);
        targetCounts.set(targetId, targetCounts.get(targetId)! + 1);

        // Recursively try next
        if (backtrack(writerIndex)) {
          return true;
        }

        // Undo assignment (backtrack)
        currentAssignments.pop();
        targetCounts.set(targetId, targetCounts.get(targetId)! - 1);
      }

      return false;
    }

    if (backtrack(0)) {
      // Success! Convert to Assignment array
      const result: Assignment[] = [];
      for (const [writerId, targetIds] of assignments.entries()) {
        for (const targetId of targetIds) {
          result.push({ writerId, targetId });
        }
      }

      console.log('✅ Matchmaking successful!', result);
      return result;
    }
  }

  console.error('❌ Matchmaking failed after', maxAttempts, 'attempts');
  return null;
}
