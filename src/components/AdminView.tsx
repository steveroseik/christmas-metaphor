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
              ? `Remove avoid for ${suggestion.targetPlayerName}`
              : `Add ${suggestion.targetPlayerName} to preferences`;
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
                      ? `Remove avoid for "${suggestion.targetPlayerName}"`
                      : `Add "${suggestion.targetPlayerName}" to preferences`;
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
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 p-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-8 border-4 border-red-300">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-red-600 mb-2">🎄 Admin Panel</h1>
            <p className="text-gray-600">Control the Reflections game</p>
            <div className="mt-4">
              <span className="inline-block px-4 py-2 bg-red-100 text-red-700 rounded-lg font-semibold">
                Status: {currentStatus}
              </span>
            </div>
          </div>

          {/* Optimal Config Calculator */}
          {players.length > 0 && (
            <div className="border-2 border-blue-200 rounded-lg p-6 bg-blue-50 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Optimal Config Calculator</h2>
              {(() => {
                const optimal = calculateOptimalConfig(players.length, targetsPerPlayer);
                return (
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Suggested Max Preferences:</p>
                          <p className="text-2xl font-bold text-blue-600">{optimal.maxPreferences}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Suggested Max Avoids:</p>
                          <p className="text-2xl font-bold text-blue-600">{optimal.maxAvoids}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setMaxPreferences(optimal.maxPreferences);
                          setMaxAvoids(optimal.maxAvoids);
                        }}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                      >
                        Apply Suggested Values
                      </button>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Calculation Reasoning:</p>
                      <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
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
            <div className="border-2 border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Game Controls</h2>
              
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
                      className="w-20 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <label className="font-semibold text-gray-700 w-48">Max Preferences (⭐):</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={maxPreferences}
                      onChange={(e) => setMaxPreferences(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
                    />
                    <span className="text-sm text-gray-600">Max favourites per player</span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <label className="font-semibold text-gray-700 w-48">Max Avoids (❌):</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={maxAvoids}
                      onChange={(e) => setMaxAvoids(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
                    />
                    <span className="text-sm text-gray-600">Max dislikes per player</span>
                  </div>
                  
                  <button
                    onClick={handleUpdateConfig}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Update Config
                  </button>
                </div>

                <button
                  onClick={handleResetGame}
                  className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
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
                    className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                  >
                    ← Go Back to Previous Phase
                  </button>
                )}

                {currentStatus === 'LOBBY' && (
                  <button
                    onClick={handleStartPreferences}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    Start Preferences Phase
                  </button>
                )}

                {currentStatus === 'PREFERENCES' && (
                  <div className="space-y-3">
                    <button
                      onClick={handleRunMatchmaking}
                      disabled={isRunningMatchmaking}
                      className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isRunningMatchmaking ? 'Running Matchmaking...' : 'Run Matchmaking'}
                    </button>
                    {matchmakingError && (
                      <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4 text-red-700">
                        {matchmakingError}
                      </div>
                    )}
                  </div>
                )}

                {currentStatus === 'WRITING' && (
                  <button
                    onClick={handleStartReveal}
                    className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                  >
                    Start Reveal Phase
                  </button>
                )}
              </div>
            </div>

            {/* Players List */}
            <div className="border-2 border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Players ({players.length})
              </h2>
              
              {players.length === 0 ? (
                <p className="text-gray-500">No players yet</p>
              ) : (
                <div className="space-y-3">
                  {players.map((player) => (
                    <div
                      key={player.uid}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-gray-200"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{player.data.name}</p>
                        <div className="text-sm text-gray-600 mt-1">
                          <span>⭐ {player.data.preferences.length} preferences</span>
                          <span className="ml-4">❌ {player.data.avoids.length} avoids</span>
                          {player.data.assignments.length > 0 && (
                            <span className="ml-4">📝 {player.data.assignments.length} assignments</span>
                          )}
                        </div>
                      </div>
                      
                      {currentStatus === 'REVEAL' && (
                        <button
                          onClick={() => handleRevealPlayer(player.uid)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors ml-4"
                        >
                          Reveal
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {currentStatus === 'REVEAL' && gameData?.currentRevealId && (
                <div className="mt-4">
                  <button
                    onClick={handleClearReveal}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Clear Current Reveal
                  </button>
                </div>
              )}
            </div>

            {/* Current Reveal Preview */}
            {currentStatus === 'REVEAL' && gameData?.currentRevealId && (
              <div className="border-2 border-red-300 rounded-lg p-6 bg-red-50">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Current Reveal</h2>
                {(() => {
                  const revealedPlayer = players.find(p => p.uid === gameData.currentRevealId);
                  const writers = players.filter(p => 
                    p.data.assignments.includes(gameData.currentRevealId!) && 
                    p.data.submissions[gameData.currentRevealId!]
                  );

                  if (!revealedPlayer) {
                    return <p className="text-gray-600">Player not found</p>;
                  }

                  return (
                    <div>
                      <p className="text-lg font-semibold text-gray-800 mb-4">
                        Showing reflections for: <span className="text-red-600">{revealedPlayer.data.name}</span>
                      </p>
                      {writers.length === 0 ? (
                        <p className="text-gray-600">No submissions yet</p>
                      ) : (
                        <div className="space-y-3">
                          {writers.map(writer => {
                            const submission = writer.data.submissions[gameData.currentRevealId!];
                            const isRevealed = submission.writerRevealed || false;
                            return (
                              <div key={writer.uid} className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="font-semibold text-gray-800 mb-2">
                                  From {isRevealed ? writer.data.name : 'Anonymous'}
                                </p>
                                <p className="text-sm text-gray-600 mb-1">
                                  <strong>Impression:</strong> {submission.impression}
                                </p>
                                <p className="text-sm text-gray-600">
                                  <strong>Reality:</strong> {submission.reality}
                                </p>
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

