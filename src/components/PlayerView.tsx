import { useState, useEffect, useRef } from 'react';
import { useGame } from '../hooks/useGame';
import { Star, Sparkles, SkipForward } from 'lucide-react';

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
    updatePlayerName,
    removePlayer,
  } = useGame();

  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [localPreferences, setLocalPreferences] = useState<string[]>([]);
  const [localAvoids, setLocalAvoids] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, { impression: string; reality: string }>>({});
  const previousWritingStatusRef = useRef<string | undefined>(undefined);
  const initializedSubmissionsRef = useRef(false);

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
  // Only initialize from Firestore when entering WRITING phase, then preserve local changes
  useEffect(() => {
    if (currentUserId && gameData?.status === 'WRITING') {
      const currentPlayer = players.find(p => p.uid === currentUserId);
      if (currentPlayer) {
        const firestoreSubmissions = currentPlayer.data.submissions;
        
        // If we just entered WRITING phase, initialize from Firestore
        if (previousWritingStatusRef.current !== 'WRITING') {
          setSubmissions({ ...firestoreSubmissions });
          initializedSubmissionsRef.current = true;
        } else {
          // We're already in WRITING phase - only update if Firestore has NEW submissions
          // that don't exist in local state (meaning current player just submitted)
          // Preserve all local unsaved changes
          setSubmissions(prevSubmissions => {
            const merged = { ...prevSubmissions };
            
            // Only add submissions from Firestore that don't exist in local state
            // This handles the case where the current player submitted (their own submission)
            // but preserves any local unsaved changes for other targets
            Object.keys(firestoreSubmissions).forEach(targetId => {
              const firestoreSubmission = firestoreSubmissions[targetId];
              
              // Only update if this target doesn't exist in local state
              // OR if the local state matches what's in Firestore (was already saved)
              // This prevents overwriting unsaved local changes
              if (!prevSubmissions[targetId]) {
                // New submission from Firestore - add it
                merged[targetId] = {
                  impression: firestoreSubmission.impression || '',
                  reality: firestoreSubmission.reality || '',
                };
              } else if (prevSubmissions[targetId].reality === firestoreSubmission.reality) {
                // Local matches Firestore (was saved) - sync to get any other updates
                merged[targetId] = {
                  impression: firestoreSubmission.impression || '',
                  reality: firestoreSubmission.reality || '',
                };
              }
              // Otherwise, keep local unsaved changes (user is typing)
            });
            
            return merged;
          });
        }
      }
    } else {
      // Reset when leaving WRITING phase
      initializedSubmissionsRef.current = false;
    }
    
    previousWritingStatusRef.current = gameData?.status;
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

  const handleUpdateName = async () => {
    if (!newName.trim() || !currentUserId) return;
    
    setIsUpdatingName(true);
    try {
      await updatePlayerName(currentUserId, newName.trim());
      setIsEditingName(false);
      setNewName('');
    } catch (err: any) {
      console.error('Error updating name:', err);
      alert(err.message || 'Failed to update name');
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleTogglePreference = (targetId: string) => {
    if (!currentUserId) return;
    
    const maxPreferences = gameData?.config.maxPreferences || 10;
    const isCurrentlyStarred = localPreferences.includes(targetId);
    
    // If trying to add and already at max, show alert
    if (!isCurrentlyStarred && localPreferences.length >= maxPreferences) {
      alert(`You can only select up to ${maxPreferences} Merry Picks. Please remove one first.`);
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
      alert(`You can only select up to ${maxAvoids} Skip this round. Please remove one first.`);
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
    if (!submission?.reality.trim()) {
      alert('Please fill in the "What you want to tell them" field');
      return;
    }

    try {
      await submitWriting(
        currentUserId,
        targetId,
        submission.impression?.trim() || '', // Optional - can be empty
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative Christmas elements */}
        <div className="absolute top-10 left-10 text-4xl animate-float">❄️</div>
        <div className="absolute top-20 right-20 text-3xl animate-float" style={{ animationDelay: '1s' }}>🎄</div>
        <div className="absolute bottom-20 left-20 text-3xl animate-float" style={{ animationDelay: '2s' }}>⭐</div>
        <div className="absolute bottom-10 right-10 text-4xl animate-float" style={{ animationDelay: '0.5s' }}>🎁</div>
        
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border-4 border-red-300 relative z-10" style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
          boxShadow: '0 20px 60px rgba(220, 38, 38, 0.3)',
        }}>
          <div className="text-center mb-8">
            <div className="text-6xl mb-4 animate-sparkle">🎄</div>
            <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-red-600 via-red-500 to-green-600 bg-clip-text text-transparent">
              Reflections
            </h1>
            <p className="text-lg text-gray-700 font-medium">✨ Join the Christmas gathering ✨</p>
          </div>
          
          {showJoinForm ? (
            <div>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="🎅 Enter your name"
                className="w-full px-4 py-3 border-3 border-red-300 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-200 focus:outline-none text-lg shadow-inner"
                disabled={isJoining}
              />
              <button
                onClick={handleJoin}
                disabled={!playerName.trim() || isJoining}
                className="w-full mt-4 bg-gradient-to-r from-red-600 to-red-700 text-white py-4 rounded-xl font-bold text-lg hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
              >
                {isJoining ? '⏳ Joining...' : '🎄 Join Game'}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-5xl mb-4">🎉</div>
              {!isEditingName ? (
                <>
                  <p className="text-xl text-gray-800 mb-2 font-semibold">
                    Welcome, <span className="font-bold text-red-600 text-2xl">{currentPlayer?.data.name || 'Player'}</span>! 🎄
                  </p>
                  <div className="flex gap-2 justify-center mb-4">
                    <button
                      onClick={() => {
                        setNewName(currentPlayer?.data.name || '');
                        setIsEditingName(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 shadow-lg text-sm"
                    >
                      ✏️ Change Name
                    </button>
                    <button
                      onClick={async () => {
                        if (!currentUserId) return;
                        if (!confirm('Are you sure you want to leave the game? This action cannot be undone.')) {
                          return;
                        }
                        setIsLeaving(true);
                        try {
                          await removePlayer(currentUserId);
                          // After leaving, the player document is deleted, so the UI will reset
                          // The user will need to refresh or rejoin
                          window.location.reload();
                        } catch (err: any) {
                          alert(err.message || 'Failed to leave game');
                          setIsLeaving(false);
                        }
                      }}
                      disabled={isLeaving}
                      className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all transform hover:scale-105 shadow-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLeaving ? '⏳ Leaving...' : '🚪 Leave Game'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="mb-4">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newName.trim()) {
                        handleUpdateName();
                      } else if (e.key === 'Escape') {
                        setIsEditingName(false);
                        setNewName('');
                      }
                    }}
                    placeholder="Enter new name"
                    className="w-full px-4 py-3 border-3 border-red-300 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-200 focus:outline-none text-lg shadow-inner mb-3"
                    autoFocus
                    disabled={isUpdatingName}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateName}
                      disabled={!newName.trim() || isUpdatingName}
                      className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-2 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
                    >
                      {isUpdatingName ? '⏳ Saving...' : '✅ Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingName(false);
                        setNewName('');
                      }}
                      disabled={isUpdatingName}
                      className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white py-2 rounded-xl font-semibold hover:from-gray-700 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
                    >
                      ❌ Cancel
                    </button>
                  </div>
                </div>
              )}
              <p className="text-gray-600 mb-6">⏰ Waiting for host to start...</p>
              <div className="mt-6">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-center gap-2">
                  <span>👥</span> Players in lobby ({players.length})
                </p>
                <div className="space-y-2">
                  {players.map(p => (
                    <div key={p.uid} className="bg-gradient-to-r from-red-50 to-green-50 px-4 py-3 rounded-xl border-2 border-red-200 shadow-md">
                      <span className="text-lg font-medium text-gray-800">🎅 {p.data.name}</span>
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 p-4 py-8 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-5 left-5 text-3xl animate-float">🎄</div>
        <div className="absolute top-10 right-10 text-2xl animate-float" style={{ animationDelay: '1.5s' }}>❄️</div>
        <div className="absolute bottom-10 left-10 text-2xl animate-float" style={{ animationDelay: '2.5s' }}>🎁</div>
        <div className="absolute bottom-5 right-5 text-3xl animate-float" style={{ animationDelay: '0.5s' }}>⭐</div>
        
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3 animate-sparkle">🎅</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-red-600 via-red-500 to-green-600 bg-clip-text text-transparent">
              Set Your Preferences
            </h1>
            <p className="text-lg text-gray-700 font-medium">✨ Mark your Merry Picks (optional) and who to Skip this round ✨</p>
          </div>

          {/* Show current counts and limits */}
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-green-50 border-3 border-blue-300 rounded-2xl p-5 shadow-lg">
            <div className="flex justify-center gap-6 text-sm">
              <div className="text-center">
                <span className="font-semibold text-gray-700">⭐ Merry Picks:</span>
                <span className={`ml-2 font-bold ${
                  localPreferences.length >= (gameData?.config.maxPreferences || 10)
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}>
                  {localPreferences.length} / {gameData?.config.maxPreferences || 10}
                </span>
                <p className="text-xs text-gray-500 mt-1">(Optional)</p>
              </div>
              <div className="text-center">
                <span className="font-semibold text-gray-700">⏭️ Skip this round:</span>
                <span className={`ml-2 font-bold ${
                  localAvoids.length >= (gameData?.config.maxAvoids || 5)
                    ? 'text-blue-600'
                    : 'text-gray-600'
                }`}>
                  {localAvoids.length} / {gameData?.config.maxAvoids || 5}
                </span>
                <p className="text-xs text-blue-600 mt-1 font-semibold">(Guaranteed skip)</p>
              </div>
            </div>
          </div>

          <div className="mb-6 bg-white/80 rounded-xl p-4 border-2 border-red-200 shadow-md">
            <p className="font-semibold mb-4 text-center text-gray-700">💡 How it works:</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {/* Merry Picks Example */}
              <div className="flex items-center gap-3">
                <button
                  className="p-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg"
                  disabled
                >
                  <Star className="w-6 h-6 fill-current" />
                </button>
                <div className="text-left">
                  <p className="text-green-700 font-semibold">Merry Picks</p>
                  <p className="text-xs text-gray-600">Optional - helps matchmaking</p>
                </div>
              </div>
              
              {/* Skip this round Example */}
              <div className="flex items-center gap-3">
                <button
                  className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg"
                  disabled
                >
                  <SkipForward className="w-6 h-6" />
                </button>
                <div className="text-left">
                  <p className="text-blue-700 font-semibold">Skip this round</p>
                  <p className="text-xs text-gray-600">Guaranteed - you will NOT write about them</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-6 border-4 border-red-300" style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
            boxShadow: '0 20px 60px rgba(220, 38, 38, 0.2)',
          }}>
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
                    className={`flex items-center justify-between p-5 rounded-xl border-3 transition-all shadow-md ${
                      isStarred
                        ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-400'
                        : isBlocked
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-400'
                        : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300'
                    }`}
                  >
                    <span className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <span className="text-2xl">🎅</span>
                      {player.data.name}
                    </span>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleTogglePreference(player.uid)}
                        disabled={!canAddPreference && !isStarred}
                        className={`p-3 rounded-xl transition-all transform hover:scale-110 ${
                          isStarred
                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                            : !canAddPreference
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-200 text-gray-600 hover:bg-green-200 shadow-md'
                        }`}
                        title={
                          !canAddPreference && !isStarred
                            ? `Maximum ${maxPreferences} Merry Picks reached`
                            : isStarred
                            ? 'Remove from Merry Picks'
                            : 'Add to Merry Picks (optional)'
                        }
                      >
                        <Star className={`w-6 h-6 ${isStarred ? 'fill-current' : ''}`} />
                      </button>
                      
                      <button
                        onClick={() => handleToggleAvoid(player.uid)}
                        disabled={!canAddAvoid && !isBlocked}
                        className={`p-3 rounded-xl transition-all transform hover:scale-110 ${
                          isBlocked
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                            : !canAddAvoid
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-200 text-gray-600 hover:bg-blue-200 shadow-md'
                        }`}
                        title={
                          !canAddAvoid && !isBlocked
                            ? `Maximum ${maxAvoids} Skip this round reached`
                            : isBlocked
                            ? 'Remove from Skip this round'
                            : "Skip this round (guaranteed to be skipped)"
                        }
                      >
                        <SkipForward className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {otherPlayers.length === 0 && (
              <p className="text-center text-gray-500 py-8 text-lg">⏳ No other players yet</p>
            )}
          </div>

          {/* Leave Game Button */}
          <div className="mt-6">
            <button
              onClick={async () => {
                if (!currentUserId) return;
                if (!confirm('Are you sure you want to leave the game? This action cannot be undone.')) {
                  return;
                }
                setIsLeaving(true);
                try {
                  await removePlayer(currentUserId);
                  window.location.reload();
                } catch (err: any) {
                  alert(err.message || 'Failed to leave game');
                  setIsLeaving(false);
                }
              }}
              disabled={isLeaving}
              className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLeaving ? '⏳ Leaving...' : '🚪 Leave Game'}
            </button>
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
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 flex items-center justify-center p-4 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-10 left-10 text-4xl animate-float">❄️</div>
          <div className="absolute top-20 right-20 text-3xl animate-float" style={{ animationDelay: '1s' }}>🎄</div>
          <div className="absolute bottom-20 left-20 text-3xl animate-float" style={{ animationDelay: '2s' }}>⭐</div>
          <div className="absolute bottom-10 right-10 text-4xl animate-float" style={{ animationDelay: '0.5s' }}>🎁</div>
          
          <div className="text-center relative z-10">
            <div className="text-7xl mb-4 animate-sparkle">⏳</div>
            <Sparkles className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
            <p className="mt-4 text-xl text-gray-700 font-semibold">Waiting for assignments...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-green-50 p-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3 animate-sparkle">✨</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-red-600 via-red-500 to-green-600 bg-clip-text text-transparent">
              Write Your Reflections
            </h1>
            <p className="text-lg text-gray-700 font-medium">🎁 Share what you want to tell each person 🎁</p>
            <p className="text-sm text-gray-600 mt-2">💡 Tip: The "First Impression" field is optional - you can skip it if you prefer</p>
          </div>

          <div className="space-y-6">
            {assignments.map(targetId => {
              const targetPlayer = players.find(p => p.uid === targetId);
              const submission = submissions[targetId] || { impression: '', reality: '' };
              const isSubmitted = currentPlayer?.data.submissions[targetId];

              return (
                <div
                  key={targetId}
                  className="bg-white rounded-2xl shadow-2xl p-6 border-4 border-red-300 mb-6" style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
                    boxShadow: '0 20px 60px rgba(220, 38, 38, 0.2)',
                  }}
                >
                  <h3 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                    <span className="text-3xl">🎅</span>
                    About {targetPlayer?.data.name || 'Unknown'}
                  </h3>

                  {isSubmitted ? (
                    <div className="bg-gradient-to-r from-green-50 to-green-100 border-3 border-green-400 rounded-xl p-5 shadow-lg">
                      <p className="text-green-700 font-bold text-lg flex items-center justify-center gap-2">
                        <span className="text-2xl">✅</span> Submitted!
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-5">
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <span>💭</span> First Impression <span className="text-xs font-normal text-gray-500">(Optional)</span>
                        </label>
                        <textarea
                          value={submission.impression}
                          onChange={(e) =>
                            setSubmissions({
                              ...submissions,
                              [targetId]: { ...submission, impression: e.target.value },
                            })
                          }
                          placeholder="🎄 What was your first impression of this person? (Optional - leave empty if you prefer)"
                          className="w-full px-4 py-3 border-3 border-red-300 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-200 focus:outline-none resize-none shadow-inner"
                          rows={4}
                        />
                      </div>

                      <div className="mb-5">
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <span>🌟</span> What You Want to Tell Them <span className="text-xs font-normal text-red-600">*</span>
                        </label>
                        <textarea
                          value={submission.reality}
                          onChange={(e) =>
                            setSubmissions({
                              ...submissions,
                              [targetId]: { ...submission, reality: e.target.value },
                            })
                          }
                          placeholder="🎁 What do you want to tell this person?"
                          className="w-full px-4 py-3 border-3 border-red-300 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-200 focus:outline-none resize-none shadow-inner"
                          rows={4}
                          required
                        />
                      </div>

                      <button
                        onClick={() => handleSubmitWriting(targetId)}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-4 rounded-xl font-bold text-lg hover:from-red-700 hover:to-red-800 transition-all transform hover:scale-105 shadow-lg"
                      >
                        🎄 Submit Reflection
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
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 p-4 py-8 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-5 left-5 text-4xl animate-float">🎁</div>
          <div className="absolute top-10 right-10 text-3xl animate-float" style={{ animationDelay: '1s' }}>✨</div>
          <div className="absolute bottom-10 left-10 text-3xl animate-float" style={{ animationDelay: '2s' }}>🎄</div>
          <div className="absolute bottom-5 right-5 text-4xl animate-float" style={{ animationDelay: '0.5s' }}>⭐</div>
          
          <div className="max-w-3xl mx-auto relative z-10">
            <div className="text-center mb-8">
              <div className="text-7xl mb-4 animate-sparkle">🎉</div>
              <h1 className="text-5xl md:text-6xl font-bold mb-3 bg-gradient-to-r from-red-600 via-red-500 to-green-600 bg-clip-text text-transparent">
                Your Reflections!
              </h1>
              <p className="text-xl text-gray-700 font-medium">✨ Here's what people wrote about you ✨</p>
            </div>

            {writers.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-2xl p-8 border-4 border-red-300 text-center" style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
              }}>
                <p className="text-gray-600 text-lg">⏳ No reflections yet...</p>
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
                      className="bg-white rounded-2xl shadow-2xl p-6 border-4 border-red-300" style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
                        boxShadow: '0 20px 60px rgba(220, 38, 38, 0.2)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                          <span className="text-3xl">🎅</span>
                          From {isRevealed ? writer.data.name : 'Anonymous'}
                        </h3>
                        {isCurrentWriter && !isRevealed && (
                          <button
                            onClick={() => revealWriterName(writer.uid, currentPlayerId).catch(err => {
                              console.error('Error revealing name:', err);
                              alert('Failed to reveal name');
                            })}
                            className="px-5 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-105 text-sm font-bold shadow-lg"
                          >
                            ✨ Reveal My Name
                          </button>
                        )}
                        {isCurrentWriter && isRevealed && (
                          <span className="px-4 py-2 bg-gradient-to-r from-green-100 to-green-200 text-green-700 rounded-xl text-sm font-bold border-2 border-green-300">
                            ✅ Revealed
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {submission.impression && submission.impression.trim() && (
                          <div>
                            <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                              <span>💭</span> First Impression
                            </h4>
                            <p className="text-gray-800 bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-xl border-2 border-gray-200 shadow-inner text-lg">
                              {submission.impression}
                            </p>
                          </div>
                        )}
                        
                        <div>
                          <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <span>🌟</span> {submission.impression && submission.impression.trim() ? 'Reality' : 'What They Wanted to Tell You'}
                          </h4>
                          <p className="text-gray-800 bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-xl border-2 border-gray-200 shadow-inner text-lg">
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
              <div className="bg-white rounded-2xl shadow-2xl p-8 border-4 border-red-300 text-center" style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
              }}>
                <p className="text-gray-600 text-lg">⏳ No reflections yet...</p>
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
                      className="bg-white rounded-2xl shadow-2xl p-6 border-4 border-red-300" style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
                        boxShadow: '0 20px 60px rgba(220, 38, 38, 0.2)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                          <span className="text-3xl">🎅</span>
                          From {isRevealed ? writer.data.name : 'Anonymous'}
                        </h3>
                        {isCurrentWriter && !isRevealed && (
                          <button
                            onClick={() => revealWriterName(writer.uid, currentRevealId).catch(err => {
                              console.error('Error revealing name:', err);
                              alert('Failed to reveal name');
                            })}
                            className="px-5 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-105 text-sm font-bold shadow-lg"
                          >
                            ✨ Reveal My Name
                          </button>
                        )}
                        {isCurrentWriter && isRevealed && (
                          <span className="px-4 py-2 bg-gradient-to-r from-green-100 to-green-200 text-green-700 rounded-xl text-sm font-bold border-2 border-green-300">
                            ✅ Revealed
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {submission.impression && submission.impression.trim() && (
                          <div>
                            <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                              <span>💭</span> First Impression
                            </h4>
                            <p className="text-gray-800 bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-xl border-2 border-gray-200 shadow-inner text-lg">
                              {submission.impression}
                            </p>
                          </div>
                        )}
                        
                        <div>
                          <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <span>🌟</span> {submission.impression && submission.impression.trim() ? 'Reality' : 'What They Wanted to Tell You'}
                          </h4>
                          <p className="text-gray-800 bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-xl border-2 border-gray-200 shadow-inner text-lg">
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-10 left-10 text-4xl animate-float">❄️</div>
        <div className="absolute top-20 right-20 text-3xl animate-float" style={{ animationDelay: '1s' }}>🎄</div>
        <div className="absolute bottom-20 left-20 text-3xl animate-float" style={{ animationDelay: '2s' }}>⭐</div>
        <div className="absolute bottom-10 right-10 text-4xl animate-float" style={{ animationDelay: '0.5s' }}>🎁</div>
        
        <div className="text-center max-w-md relative z-10">
          <div className="text-7xl mb-6 animate-sparkle">⏰</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-red-600 via-red-500 to-green-600 bg-clip-text text-transparent">
            Stay Tuned
          </h1>
          <p className="text-xl text-gray-700 font-medium">✨ Waiting for the next reveal... ✨</p>
        </div>
      </div>
    );
  }

  return null;
}

