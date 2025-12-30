import { useState, useEffect } from 'react';
import React from 'react';
import { useGame } from '../hooks/useGame';
import { runMatchmaking, analyzeMatchmakingConflict } from '../matchmaking';
import { GameData } from '../types';
import { calculateOptimalConfig } from '../utils/optimalConfigCalculator';

export default function AdminView() {
  const {
    gameData,
    players,
    loading,
    updateGameStatus,
    updateGameConfig,
    writeAssignments,
    resetGame,
    setCurrentReveal,
    kickPlayer,
    resetAssignments,
    generateDummyPlayers,
  } = useGame();

  const [targetsPerPlayer, setTargetsPerPlayer] = useState(
    gameData?.config.targetsPerPlayer || 2
  );
  const [maxPreferences, setMaxPreferences] = useState(
    gameData?.config.maxPreferences || 10
  );
  const [maxAvoids, setMaxAvoids] = useState(
    gameData?.config.maxAvoids || 5
  );
  const [isRunningMatchmaking, setIsRunningMatchmaking] = useState(false);
  const [matchmakingError, setMatchmakingError] = useState<React.ReactNode | null>(null);
  const [kickingPlayerId, setKickingPlayerId] = useState<string | null>(null);
  const [isResettingAssignments, setIsResettingAssignments] = useState(false);
  const [isGeneratingDummyPlayers, setIsGeneratingDummyPlayers] = useState(false);

  // Update local state when gameData changes
  useEffect(() => {
    if (gameData?.config) {
      setTargetsPerPlayer(gameData.config.targetsPerPlayer);
      setMaxPreferences(gameData.config.maxPreferences);
      setMaxAvoids(gameData.config.maxAvoids);
    }
  }, [gameData?.config]);

  const handleResetGame = async () => {
    if (confirm('Are you sure you want to reset the game? This will delete all players and data.')) {
      try {
        await resetGame();
        setMatchmakingError(null);
      } catch (err) {
        console.error('Error resetting game:', err);
        alert('Failed to reset game');
      }
    }
  };

  const handleUpdateConfig = async () => {
    try {
      await updateGameConfig({ 
        targetsPerPlayer,
        maxPreferences,
        maxAvoids,
      });
      alert('Configuration updated!');
    } catch (err) {
      console.error('Error updating config:', err);
      alert('Failed to update configuration');
    }
  };

  const handleStartPreferences = async () => {
    try {
      await updateGameStatus('PREFERENCES');
    } catch (err) {
      console.error('Error starting preferences:', err);
      alert('Failed to start preferences phase');
    }
  };

  const handleRunMatchmaking = async () => {
    if (players.length < 2) {
      alert('Need at least 2 players to run matchmaking');
      return;
    }

    setIsRunningMatchmaking(true);
    setMatchmakingError(null);

    try {
      const N = gameData?.config.targetsPerPlayer || 2;
      const assignments = runMatchmaking(players, N);

      if (!assignments) {
        // Analyze the conflict and provide specific suggestions
        const analysis = analyzeMatchmakingConflict(players, N);
        
        let errorMsg = 'Conflict Detected!\n\n';
        errorMsg += analysis.summary + '\n\n';
        
        if (analysis.suggestions.length > 0) {
          errorMsg += 'Suggested actions:\n';
          analysis.suggestions.forEach((suggestion, index) => {
            const actionText = suggestion.action === 'remove_avoid' 
              ? `Remove Skip this round for ${suggestion.targetPlayerName}`
              : `Add ${suggestion.targetPlayerName} to Merry Picks`;
            errorMsg += `${index + 1}. ${suggestion.playerName}: ${actionText}\n`;
          });
        } else {
          errorMsg += 'Try lowering N or having players adjust their preferences.';
        }
        
        // Create detailed error message for display
        const detailedError = (
          <div className="space-y-3">
            <p className="font-semibold text-red-700">Conflict Detected!</p>
            <p className="text-sm">{analysis.summary}</p>
            {analysis.suggestions.length > 0 && (
              <div className="mt-4">
                <p className="font-semibold text-sm mb-2">Suggested actions:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {analysis.suggestions.map((suggestion, index) => {
                    const actionText = suggestion.action === 'remove_avoid' 
                      ? `Remove Skip this round for "${suggestion.targetPlayerName}"`
                      : `Add "${suggestion.targetPlayerName}" to Merry Picks`;
                    return (
                      <li key={index} className="text-gray-700">
                        <span className="font-medium">{suggestion.playerName}</span>: {actionText}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
        
        setMatchmakingError(detailedError);
        alert(errorMsg);
        setIsRunningMatchmaking(false);
        return;
      }

      // Write assignments to Firestore
      await writeAssignments(assignments);

      // Update status to WRITING
      await updateGameStatus('WRITING');

      alert(`Matchmaking successful! ${assignments.length} assignments created.`);
    } catch (err) {
      console.error('Error running matchmaking:', err);
      const errorMsg = 'Failed to run matchmaking. Please try again.';
      setMatchmakingError(errorMsg);
      alert(errorMsg);
    } finally {
      setIsRunningMatchmaking(false);
    }
  };

  const handleStartReveal = async () => {
    try {
      await updateGameStatus('REVEAL');
    } catch (err) {
      console.error('Error starting reveal:', err);
      alert('Failed to start reveal phase');
    }
  };

  const handleGoBackPhase = async () => {
    if (!gameData) return;
    
    const phaseOrder: Array<GameData['status']> = ['LOBBY', 'PREFERENCES', 'WRITING', 'REVEAL'];
    const currentIndex = phaseOrder.indexOf(gameData.status);
    
    if (currentIndex > 0) {
      const previousPhase = phaseOrder[currentIndex - 1];
      try {
        await updateGameStatus(previousPhase);
      } catch (err) {
        console.error('Error going back to previous phase:', err);
        alert('Failed to go back to previous phase');
      }
    }
  };

  const handleRevealPlayer = async (playerId: string) => {
    try {
      await setCurrentReveal(playerId);
    } catch (err) {
      console.error('Error setting reveal:', err);
      alert('Failed to set reveal');
    }
  };

  const handleClearReveal = async () => {
    try {
      await setCurrentReveal(null);
    } catch (err) {
      console.error('Error clearing reveal:', err);
      alert('Failed to clear reveal');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 flex items-center justify-center">
        <p>Loading admin panel...</p>
      </div>
    );
  }

  const currentStatus = gameData?.status || 'LOBBY';

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 p-4 py-8 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-5 left-5 text-4xl animate-float">🎄</div>
      <div className="absolute top-10 right-10 text-3xl animate-float" style={{ animationDelay: '1s' }}>🎁</div>
      <div className="absolute bottom-10 left-10 text-3xl animate-float" style={{ animationDelay: '2s' }}>⭐</div>
      <div className="absolute bottom-5 right-5 text-4xl animate-float" style={{ animationDelay: '0.5s' }}>❄️</div>
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl p-8 border-4 border-red-300" style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
          boxShadow: '0 20px 60px rgba(220, 38, 38, 0.3)',
        }}>
          <div className="text-center mb-8">
            <div className="text-6xl mb-4 animate-sparkle">🎅</div>
            <h1 className="text-5xl md:text-6xl font-bold mb-3 bg-gradient-to-r from-red-600 via-red-500 to-green-600 bg-clip-text text-transparent">
              Admin Panel
            </h1>
            <p className="text-lg text-gray-700 font-medium mb-4">✨ Control the Reflections game ✨</p>
            <div className="mt-4">
              <span className="inline-block px-6 py-3 bg-gradient-to-r from-red-100 to-green-100 text-red-700 rounded-xl font-bold text-lg border-3 border-red-300 shadow-md">
                🎯 Status: {currentStatus}
              </span>
            </div>
          </div>

          {/* Optimal Config Calculator */}
          {players.length > 0 && (
            <div className="border-4 border-blue-300 rounded-2xl p-6 bg-gradient-to-r from-blue-50 to-green-50 mb-6 shadow-lg">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-3xl">📊</span> Optimal Config Calculator
              </h2>
              {(() => {
                const optimal = calculateOptimalConfig(players.length, targetsPerPlayer);
                return (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl p-5 border-3 border-blue-300 shadow-md">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border-2 border-green-300">
                          <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                            <span>⭐</span> Suggested Max Merry Picks:
                          </p>
                          <p className="text-3xl font-bold text-green-700">{optimal.maxPreferences}</p>
                        </div>
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border-2 border-blue-300">
                          <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                            <span>⏭️</span> Suggested Max Skip this round:
                          </p>
                          <p className="text-3xl font-bold text-blue-700">{optimal.maxAvoids}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setMaxPreferences(optimal.maxPreferences);
                          setMaxAvoids(optimal.maxAvoids);
                        }}
                        className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 font-bold shadow-lg"
                      >
                        ✨ Apply Suggested Values
                      </button>
                    </div>
                    <div className="bg-white rounded-xl p-5 border-3 border-blue-300 shadow-md">
                      <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <span>💡</span> Calculation Reasoning:
                      </p>
                      <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                        {optimal.reasoning.map((reason, index) => (
                          <li key={index}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Game Controls */}
          <div className="space-y-6">
            {/* Reset & Config */}
            <div className="border-4 border-red-300 rounded-2xl p-6 bg-gradient-to-r from-white to-red-50 shadow-lg">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-3xl">🎮</span> Game Controls
              </h2>

              {/* Testing Button */}
              <div className="mb-4">
                <button
                  onClick={async () => {
                    if (!confirm('Generate 50 dummy players for testing? This will add test players to the game.')) {
                      return;
                    }
                    setIsGeneratingDummyPlayers(true);
                    try {
                      await generateDummyPlayers(50);
                      alert('Successfully generated 50 dummy players!');
                    } catch (err: any) {
                      console.error('Error generating dummy players:', err);
                      alert(err.message || 'Failed to generate dummy players');
                    } finally {
                      setIsGeneratingDummyPlayers(false);
                    }
                  }}
                  disabled={isGeneratingDummyPlayers}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-bold hover:from-purple-700 hover:to-purple-800 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mb-4"
                >
                  {isGeneratingDummyPlayers ? '⏳ Generating...' : '🧪 Generate 50 Dummy Players (Testing)'}
                </button>
              </div>

              {/* Reset Assignments Button */}
              {(currentStatus === 'WRITING' || currentStatus === 'REVEAL') && (
                <div className="mb-4">
                  <button
                    onClick={async () => {
                      if (!confirm('Are you sure you want to reset all assignments? This will clear all writing assignments AND all submitted writings (impressions and realities). Players will remain in the game, but they will need to write again.')) {
                        return;
                      }
                      setIsResettingAssignments(true);
                      try {
                        await resetAssignments();
                        alert('Assignments and all submitted writings have been reset successfully!');
                      } catch (err: any) {
                        console.error('Error resetting assignments:', err);
                        alert(err.message || 'Failed to reset assignments');
                      } finally {
                        setIsResettingAssignments(false);
                      }
                    }}
                    disabled={isResettingAssignments}
                    className="w-full px-4 py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white rounded-xl font-bold hover:from-yellow-700 hover:to-yellow-800 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mb-4"
                  >
                    {isResettingAssignments ? '⏳ Resetting...' : '🔄 Reset Assignments & Writings'}
                  </button>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="font-semibold text-gray-700 w-48">Targets per Player:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={targetsPerPlayer}
                      onChange={(e) => setTargetsPerPlayer(parseInt(e.target.value) || 2)}
                      className="w-20 px-3 py-2 border-3 border-red-300 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-200 focus:outline-none shadow-inner"
                    />
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <label className="font-semibold text-gray-700 w-48">Max Merry Picks (⭐):</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={maxPreferences}
                      onChange={(e) => setMaxPreferences(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 border-3 border-red-300 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-200 focus:outline-none shadow-inner"
                    />
                    <span className="text-sm text-gray-600">Max Merry Picks per player (optional)</span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <label className="font-semibold text-gray-700 w-48">Max Skip this round (⏭️):</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={maxAvoids}
                      onChange={(e) => setMaxAvoids(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 border-3 border-red-300 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-200 focus:outline-none shadow-inner"
                    />
                    <span className="text-sm text-gray-600">Max Skip this round per player (guaranteed)</span>
                  </div>
                  
                  <button
                    onClick={handleUpdateConfig}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 font-bold shadow-lg"
                  >
                    Update Config
                  </button>
                </div>

                <button
                  onClick={handleResetGame}
                  className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold hover:from-red-700 hover:to-red-800 transition-all transform hover:scale-105 shadow-lg"
                >
                  Reset Game
                </button>
              </div>
            </div>

            {/* Phase Controls */}
            <div className="border-2 border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Phase Controls</h2>
              
              <div className="space-y-3">
                {/* Go Back Button - show when not in LOBBY */}
                {currentStatus !== 'LOBBY' && (
                  <button
                    onClick={handleGoBackPhase}
                    className="w-full px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-bold hover:from-gray-700 hover:to-gray-800 transition-all transform hover:scale-105 shadow-lg"
                  >
                    ← Go Back to Previous Phase
                  </button>
                )}

                {currentStatus === 'LOBBY' && (
                  <button
                    onClick={handleStartPreferences}
                    className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-105 shadow-lg"
                  >
                    Start Preferences Phase
                  </button>
                )}

                {currentStatus === 'PREFERENCES' && (
                  <div className="space-y-3">
                    <button
                      onClick={handleRunMatchmaking}
                      disabled={isRunningMatchmaking}
                      className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-bold hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg disabled:transform-none"
                    >
                      {isRunningMatchmaking ? 'Running Matchmaking...' : 'Run Matchmaking'}
                    </button>
                    {matchmakingError && (
                      <div className="bg-gradient-to-r from-red-100 to-red-200 border-4 border-red-400 rounded-xl p-5 text-red-800 shadow-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">⚠️</span>
                          <p className="font-bold text-lg">Matchmaking Conflict</p>
                        </div>
                        <div className="text-sm">{matchmakingError}</div>
                      </div>
                    )}
                  </div>
                )}

                {currentStatus === 'WRITING' && (
                  <button
                    onClick={handleStartReveal}
                    className="w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl font-bold hover:from-orange-700 hover:to-orange-800 transition-all transform hover:scale-105 shadow-lg"
                  >
                    Start Reveal Phase
                  </button>
                )}
              </div>
            </div>

            {/* Players List */}
            <div className="border-4 border-green-300 rounded-2xl p-6 bg-gradient-to-r from-white to-green-50 shadow-lg">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-3xl">👥</span> Players ({players.length})
              </h2>
              
              {players.length === 0 ? (
                <p className="text-gray-500 text-lg">⏳ No players yet</p>
              ) : (
                <div className="space-y-3">
                  {players.map((player) => (
                    <div
                      key={player.uid}
                      className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border-3 border-gray-300 shadow-md"
                    >
                      <div className="flex-1">
                        <p className="font-bold text-lg text-gray-800 flex items-center gap-2">
                          <span className="text-2xl">🎅</span>
                          {player.data.name}
                        </p>
                        <div className="text-sm text-gray-700 mt-2 font-semibold">
                          <span className="bg-green-100 px-3 py-1 rounded-lg border-2 border-green-300">⭐ {player.data.preferences.length} Merry Picks</span>
                          <span className="ml-3 bg-blue-100 px-3 py-1 rounded-lg border-2 border-blue-300">⏭️ {player.data.avoids.length} Skip this round</span>
                          {player.data.assignments.length > 0 && (
                            <span className="ml-3 bg-blue-100 px-3 py-1 rounded-lg border-2 border-blue-300">📝 {player.data.assignments.length} assignments</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {currentStatus === 'REVEAL' && (
                          <button
                            onClick={() => handleRevealPlayer(player.uid)}
                            className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all transform hover:scale-105 font-bold shadow-lg"
                          >
                            Reveal
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (!confirm(`Are you sure you want to kick ${player.data.name}? This will remove them from the game and clean up all references.`)) {
                              return;
                            }
                            setKickingPlayerId(player.uid);
                            try {
                              await kickPlayer(player.uid);
                              alert(`${player.data.name} has been kicked from the game.`);
                            } catch (err: any) {
                              console.error('Error kicking player:', err);
                              alert(err.message || 'Failed to kick player');
                            } finally {
                              setKickingPlayerId(null);
                            }
                          }}
                          disabled={kickingPlayerId === player.uid}
                          className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all transform hover:scale-105 font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                          {kickingPlayerId === player.uid ? '⏳ Kicking...' : '🚪 Kick'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {currentStatus === 'REVEAL' && gameData?.currentRevealId && (
                <div className="mt-4">
                  <button
                    onClick={handleClearReveal}
                    className="w-full px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-bold hover:from-gray-700 hover:to-gray-800 transition-all transform hover:scale-105 shadow-lg"
                  >
                    Clear Current Reveal
                  </button>
                </div>
              )}
            </div>

            {/* Current Reveal Preview */}
            {currentStatus === 'REVEAL' && gameData?.currentRevealId && (
              <div className="border-4 border-red-300 rounded-2xl p-6 bg-gradient-to-r from-red-50 to-red-100 shadow-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-3xl">🎁</span> Current Reveal
                </h2>
                {(() => {
                  const revealedPlayer = players.find(p => p.uid === gameData.currentRevealId);
                  const writers = players.filter(p => 
                    p.data.assignments.includes(gameData.currentRevealId!) && 
                    p.data.submissions[gameData.currentRevealId!]
                  );

                  if (!revealedPlayer) {
                    return <p className="text-gray-600 text-lg">⏳ Player not found</p>;
                  }

                  return (
                    <div>
                      <p className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
                        <span>✨</span> Showing reflections for: <span className="text-red-700 text-2xl">{revealedPlayer.data.name}</span>
                      </p>
                      {writers.length === 0 ? (
                        <p className="text-gray-600 text-lg">⏳ No submissions yet</p>
                      ) : (
                        <div className="space-y-4">
                          {writers.map(writer => {
                            const submission = writer.data.submissions[gameData.currentRevealId!];
                            const isRevealed = submission.writerRevealed || false;
                            return (
                              <div key={writer.uid} className="bg-white p-5 rounded-xl border-3 border-gray-300 shadow-md">
                                <p className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                                  <span className="text-2xl">🎅</span>
                                  From {isRevealed ? writer.data.name : 'Anonymous'}
                                </p>
                                <div className="space-y-2">
                                  {submission.impression && submission.impression.trim() && (
                                    <p className="text-sm text-gray-700">
                                      <strong className="text-gray-800">💭 Impression:</strong> {submission.impression}
                                    </p>
                                  )}
                                  <p className="text-sm text-gray-700">
                                    <strong className="text-gray-800">🌟 {submission.impression && submission.impression.trim() ? 'Reality' : 'Message'}:</strong> {submission.reality}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Debug Info */}
            <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Debug Info</h2>
              <pre className="text-xs overflow-auto">
                {JSON.stringify({ gameData, playerCount: players.length }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

