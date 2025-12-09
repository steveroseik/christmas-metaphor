import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PlayerView from './components/PlayerView';
import AdminView from './components/AdminView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isFirebaseConfigured } from './firebase';

function App() {
  // Show configuration message if Firebase isn't set up
        if (!isFirebaseConfigured) {
          return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 flex items-center justify-center p-4 relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-10 left-10 text-4xl animate-float">❄️</div>
              <div className="absolute top-20 right-20 text-3xl animate-float" style={{ animationDelay: '1s' }}>🎄</div>
              <div className="absolute bottom-20 left-20 text-3xl animate-float" style={{ animationDelay: '2s' }}>⭐</div>
              <div className="absolute bottom-10 right-10 text-4xl animate-float" style={{ animationDelay: '0.5s' }}>🎁</div>
              
              <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border-4 border-red-300 relative z-10" style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
                boxShadow: '0 20px 60px rgba(220, 38, 38, 0.3)',
              }}>
                <div className="text-center">
                  <div className="text-6xl mb-4 animate-sparkle">🎄</div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-red-600 via-red-500 to-green-600 bg-clip-text text-transparent">
                    Reflections
                  </h1>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Firebase Configuration Required</h2>
                  <p className="text-gray-700 mb-4 text-lg">
                    Please configure your Firebase credentials to use this app.
                  </p>
                  <div className="text-left bg-gradient-to-r from-gray-50 to-blue-50 p-5 rounded-xl mb-4 border-3 border-blue-300 shadow-md">
                    <p className="text-sm font-bold mb-3 flex items-center gap-2">
                      <span>📋</span> Steps to configure:
                    </p>
                    <ol className="text-sm text-gray-700 list-decimal list-inside space-y-2">
                      <li>Create a Firebase project at <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-red-600 underline font-semibold">Firebase Console</a></li>
                      <li>Enable Firestore Database</li>
                      <li>Enable Anonymous Authentication</li>
                      <li>Copy <code className="bg-gray-200 px-2 py-1 rounded font-mono">.env.example</code> to <code className="bg-gray-200 px-2 py-1 rounded font-mono">.env</code></li>
                      <li>Add your Firebase credentials to <code className="bg-gray-200 px-2 py-1 rounded font-mono">.env</code></li>
                      <li>Restart the development server</li>
                    </ol>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    📖 See README.md for more details
                  </p>
                </div>
              </div>
            </div>
          );
        }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PlayerView />} />
          <Route path="/admin" element={<AdminView />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
