import { useState, useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { Star, X, Sparkles } from 'lucide-react';

export default function PlayerView() {
  const {
    gameData,
    players,
    loading,
    currentUserId,
    upsertPlayer,
    updatePlayerPreferences,
    submitWriting,
    revealWriterName,
  } = useGame();

  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [localPreferences, setLocalPreferences] = useState<string[]>([]);
  const [localAvoids, setLocalAvoids] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, { impression: string; reality: string }>>({});


  // Load current player's preferences
  useEffect(() => {
    if (currentUserId && gameData?.status === 'PREFERENCES') {
      const currentPlayer = players.find(p => p.uid === currentUserId);
      if (currentPlayer) {
        setLocalPreferences([...currentPlayer.data.preferences]);
        setLocalAvoids([...currentPlayer.data.avoids]);
      }
    }
  }, [currentUserId, gameData?.status, players]);

  // Load current player's assignments and submissions
  useEffect(() => {
    if (currentUserId && gameData?.status === 'WRITING') {
      const currentPlayer = players.find(p => p.uid === currentUserId);
      if (currentPlayer) {
        setSubmissions({ ...currentPlayer.data.submissions });
      }
    }
  }, [currentUserId, gameData?.status, players]);

  const handleJoin = async () => {
    if (!playerName.trim() || !currentUserId) return;
    
    setIsJoining(true);
    try {
      await upsertPlayer(currentUserId, { name: playerName.trim() });
      // The onSnapshot listener will automatically update the players array
      // which will cause currentPlayer to update and the UI to re-render
      // No need to manually update state here
    } catch (err) {
      console.error('Error joining:', err);
      alert('Failed to join. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleTogglePreference = (targetId: string) => {
    if (!currentUserId) return;
    
    const maxPreferences = gameData?.config.maxPreferences || 10;
    const isCurrentlyStarred = localPreferences.includes(targetId);
    
    // If trying to add and already at max, show alert
    if (!isCurrentlyStarred && localPreferences.length >= maxPreferences) {
      alert(`You can only select up to ${maxPreferences} favourites. Please remove one first.`);
      return;
    }
    
    const newPreferences = isCurrentlyStarred
      ? localPreferences.filter(id => id !== targetId)
      : [...localPreferences, targetId];
    
    // Remove from avoids if adding to preferences
    const newAvoids = localAvoids.filter(id => id !== targetId);
    
    setLocalPreferences(newPreferences);
    setLocalAvoids(newAvoids);
    
    updatePlayerPreferences(currentUserId, newPreferences, newAvoids).catch(err => {
      console.error('Error updating preferences:', err);
    });
  };

  const handleToggleAvoid = (targetId: string) => {
    if (!currentUserId) return;
    
    const maxAvoids = gameData?.config.maxAvoids || 5;
    const isCurrentlyBlocked = localAvoids.includes(targetId);
    
    // If trying to add and already at max, show alert
    if (!isCurrentlyBlocked && localAvoids.length >= maxAvoids) {
      alert(`You can only select up to ${maxAvoids} avoids. Please remove one first.`);
      return;
    }
    
    const newAvoids = isCurrentlyBlocked
      ? localAvoids.filter(id => id !== targetId)
      : [...localAvoids, targetId];
    
    // Remove from preferences if adding to avoids
    const newPreferences = localPreferences.filter(id => id !== targetId);
    
    setLocalPreferences(newPreferences);
    setLocalAvoids(newAvoids);
    
    updatePlayerPreferences(currentUserId, newPreferences, newAvoids).catch(err => {
      console.error('Error updating preferences:', err);
    });
  };

  const handleSubmitWriting = async (targetId: string) => {
    if (!currentUserId) return;
    
    const submission = submissions[targetId];
    if (!submission?.impression.trim() || !submission?.reality.trim()) {
      alert('Please fill in both fields');
      return;
    }

    try {
      await submitWriting(
        currentUserId,
        targetId,
        submission.impression.trim(),
        submission.reality.trim()
      );
    } catch (err) {
      console.error('Error submitting writing:', err);
      alert('Failed to submit. Please try again.');
    }
  };

  const currentPlayer = currentUserId ? players.find(p => p.uid === currentUserId) : null;
  const otherPlayers = players.filter(p => p.uid !== currentUserId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
          <p className="mt-4 text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  // LOBBY Phase
  if (gameData?.status === 'LOBBY') {
    // Only check Firestore data - if currentPlayer exists and has a name, they've joined
    // Don't check playerName state (input field) - that changes as user types
    // The onSnapshot listener will automatically update players array when Firestore changes
    const playerNameFromFirestore = currentPlayer?.data.name;
    const hasJoined = playerNameFromFirestore && playerNameFromFirestore.trim().length > 0;
    const showJoinForm = !hasJoined;
    
    // Debug: log the state to help diagnose issues
    // console.log('LOBBY State:', { currentUserId, hasJoined, playerNameFromFirestore, playersCount: players.length });
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border-4 border-red-200">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-red-600 mb-2">🎄 Reflections</h1>
            <p className="text-gray-600">Join the Christmas gathering</p>
          </div>
          
          {showJoinForm ? (
            <div>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-lg"
                disabled={isJoining}
              />
              <button
                onClick={handleJoin}
                disabled={!playerName.trim() || isJoining}
                className="w-full mt-4 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isJoining ? 'Joining...' : 'Join Game'}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-lg text-gray-700 mb-4">
                Welcome, <span className="font-bold text-red-600">{currentPlayer?.data.name || 'Player'}</span>!
              </p>
              <p className="text-gray-600">Waiting for host to start...</p>
              <div className="mt-6">
                <p className="text-sm text-gray-500 mb-2">Players in lobby:</p>
                <div className="space-y-2">
                  {players.map(p => (
                    <div key={p.uid} className="bg-red-50 px-4 py-2 rounded-lg">
                      {p.data.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // PREFERENCES Phase
  if (gameData?.status === 'PREFERENCES') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 p-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-red-600 mb-2">Set Your Preferences</h1>
            <p className="text-gray-600">Tell us who you know well and who you'd prefer not to write about</p>
          </div>

          {/* Show current counts and limits */}
          <div className="mb-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <div className="flex justify-center gap-6 text-sm">
              <div className="text-center">
                <span className="font-semibold text-gray-700">⭐ Favourites:</span>
                <span className={`ml-2 font-bold ${
                  localPreferences.length >= (gameData?.config.maxPreferences || 10)
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}>
                  {localPreferences.length} / {gameData?.config.maxPreferences || 10}
                </span>
              </div>
              <div className="text-center">
                <span className="font-semibold text-gray-700">❌ Avoids:</span>
                <span className={`ml-2 font-bold ${
                  localAvoids.length >= (gameData?.config.maxAvoids || 5)
                    ? 'text-red-600'
                    : 'text-gray-600'
                }`}>
                  {localAvoids.length} / {gameData?.config.maxAvoids || 5}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-200">
            <div className="space-y-3">
              {otherPlayers.map(player => {
                const isStarred = localPreferences.includes(player.uid);
                const isBlocked = localAvoids.includes(player.uid);
                const maxPreferences = gameData?.config.maxPreferences || 10;
                const maxAvoids = gameData?.config.maxAvoids || 5;
                const canAddPreference = isStarred || localPreferences.length < maxPreferences;
                const canAddAvoid = isBlocked || localAvoids.length < maxAvoids;
                
                return (
                  <div
                    key={player.uid}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      isStarred
                        ? 'bg-green-50 border-green-300'
                        : isBlocked
                        ? 'bg-red-50 border-red-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <span className="text-lg font-medium text-gray-800">{player.data.name}</span>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTogglePreference(player.uid)}
                        disabled={!canAddPreference && !isStarred}
                        className={`p-2 rounded-lg transition-colors ${
                          isStarred
                            ? 'bg-green-500 text-white'
                            : !canAddPreference
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-200 text-gray-600 hover:bg-green-200'
                        }`}
                        title={
                          !canAddPreference && !isStarred
                            ? `Maximum ${maxPreferences} favourites reached`
                            : isStarred
                            ? 'Remove from favourites'
                            : 'I know them well'
                        }
                      >
                        <Star className={`w-5 h-5 ${isStarred ? 'fill-current' : ''}`} />
                      </button>
                      
                      <button
                        onClick={() => handleToggleAvoid(player.uid)}
                        disabled={!canAddAvoid && !isBlocked}
                        className={`p-2 rounded-lg transition-colors ${
                          isBlocked
                            ? 'bg-red-500 text-white'
                            : !canAddAvoid
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-200 text-gray-600 hover:bg-red-200'
                        }`}
                        title={
                          !canAddAvoid && !isBlocked
                            ? `Maximum ${maxAvoids} avoids reached`
                            : isBlocked
                            ? 'Remove from avoids'
                            : "I'd rather not write about them"
                        }
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {otherPlayers.length === 0 && (
              <p className="text-center text-gray-500 py-8">No other players yet</p>
            )}
          </div>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>⭐ Green = I know them well</p>
            <p>❌ Red = I'd rather not write about them</p>
          </div>
        </div>
      </div>
    );
  }

  // WRITING Phase
  if (gameData?.status === 'WRITING') {
    const assignments = currentPlayer?.data.assignments || [];
    
    if (assignments.length === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 flex items-center justify-center p-4">
          <div className="text-center">
            <Sparkles className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
            <p className="mt-4 text-gray-700">Waiting for assignments...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 p-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-red-600 mb-2">Write Your Reflections</h1>
            <p className="text-gray-600">Share your thoughts about each person</p>
          </div>

          <div className="space-y-6">
            {assignments.map(targetId => {
              const targetPlayer = players.find(p => p.uid === targetId);
              const submission = submissions[targetId] || { impression: '', reality: '' };
              const isSubmitted = currentPlayer?.data.submissions[targetId];

              return (
                <div
                  key={targetId}
                  className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-200"
                >
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">
                    About {targetPlayer?.data.name || 'Unknown'}
                  </h3>

                  {isSubmitted ? (
                    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                      <p className="text-green-700 font-semibold">✓ Submitted!</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          First Impression
                        </label>
                        <textarea
                          value={submission.impression}
                          onChange={(e) =>
                            setSubmissions({
                              ...submissions,
                              [targetId]: { ...submission, impression: e.target.value },
                            })
                          }
                          placeholder="What was your first impression of this person?"
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none resize-none"
                          rows={4}
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Reality
                        </label>
                        <textarea
                          value={submission.reality}
                          onChange={(e) =>
                            setSubmissions({
                              ...submissions,
                              [targetId]: { ...submission, reality: e.target.value },
                            })
                          }
                          placeholder="What is the reality of your relationship?"
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none resize-none"
                          rows={4}
                        />
                      </div>

                      <button
                        onClick={() => handleSubmitWriting(targetId)}
                        className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                      >
                        Submit
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // REVEAL Phase
  if (gameData?.status === 'REVEAL') {
    const currentRevealId = gameData.currentRevealId;
    const currentPlayerId = currentUserId;
    const revealedPlayer = currentRevealId ? players.find(p => p.uid === currentRevealId) : null;
    
    if (currentRevealId === currentPlayerId && currentPlayerId) {
      // Find all players who wrote about this person
      const writers = players.filter(p => 
        currentPlayerId && p.data.assignments.includes(currentPlayerId) && 
        currentPlayerId in p.data.submissions
      );

      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <Sparkles className="w-16 h-16 text-red-500 mx-auto animate-pulse mb-4" />
              <h1 className="text-4xl font-bold text-red-600 mb-2">Your Reflections!</h1>
              <p className="text-xl text-gray-700">Here's what people wrote about you</p>
            </div>

            {writers.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-red-200 text-center">
                <p className="text-gray-600">No reflections yet...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {writers.map(writer => {
                  const submission = currentPlayerId ? writer.data.submissions[currentPlayerId] : null;
                  if (!submission) return null;
                  const isRevealed = submission.writerRevealed || false;
                  const isCurrentWriter = writer.uid === currentPlayerId;
                  
                  return (
                    <div
                      key={writer.uid}
                      className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-200"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-800">
                          From {isRevealed ? writer.data.name : 'Anonymous'}
                        </h3>
                        {isCurrentWriter && !isRevealed && (
                          <button
                            onClick={() => revealWriterName(writer.uid, currentPlayerId).catch(err => {
                              console.error('Error revealing name:', err);
                              alert('Failed to reveal name');
                            })}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                          >
                            Reveal My Name
                          </button>
                        )}
                        {isCurrentWriter && isRevealed && (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-semibold">
                            ✓ Revealed
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-600 mb-2">
                            First Impression
                          </h4>
                          <p className="text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            {submission.impression}
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-semibold text-gray-600 mb-2">
                            Reality
                          </h4>
                          <p className="text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            {submission.reality}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (revealedPlayer && currentRevealId) {
      // Show other player's reveal
      const writers = players.filter(p => 
        p.data.assignments.includes(currentRevealId) && 
        p.data.submissions[currentRevealId]
      );

      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <Sparkles className="w-12 h-12 text-red-500 mx-auto animate-pulse mb-4" />
              <h1 className="text-3xl font-bold text-red-600 mb-2">
                Reflections for {revealedPlayer.data.name}
              </h1>
            </div>

            {writers.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-red-200 text-center">
                <p className="text-gray-600">No reflections yet...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {writers.map(writer => {
                  const submission = writer.data.submissions[currentRevealId];
                  const isRevealed = submission.writerRevealed || false;
                  const isCurrentWriter = writer.uid === currentPlayerId;
                  
                  return (
                    <div
                      key={writer.uid}
                      className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-200"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-800">
                          From {isRevealed ? writer.data.name : 'Anonymous'}
                        </h3>
                        {isCurrentWriter && !isRevealed && (
                          <button
                            onClick={() => revealWriterName(writer.uid, currentRevealId).catch(err => {
                              console.error('Error revealing name:', err);
                              alert('Failed to reveal name');
                            })}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                          >
                            Reveal My Name
                          </button>
                        )}
                        {isCurrentWriter && isRevealed && (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-semibold">
                            ✓ Revealed
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-600 mb-2">
                            First Impression
                          </h4>
                          <p className="text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            {submission.impression}
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-semibold text-gray-600 mb-2">
                            Reality
                          </h4>
                          <p className="text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            {submission.reality}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Sparkles className="w-12 h-12 text-red-500 mx-auto animate-pulse mb-4" />
          <h1 className="text-3xl font-bold text-red-600 mb-4">Stay Tuned</h1>
          <p className="text-gray-700">Waiting for the next reveal...</p>
        </div>
      </div>
    );
  }

  return null;
}

