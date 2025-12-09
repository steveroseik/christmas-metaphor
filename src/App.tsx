import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PlayerView from './components/PlayerView';
import AdminView from './components/AdminView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isFirebaseConfigured } from './firebase';

function App() {
  // Show configuration message if Firebase isn't set up
  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-green-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border-4 border-red-200">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-red-600 mb-4">🎄 Reflections</h1>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Firebase Configuration Required</h2>
            <p className="text-gray-700 mb-4">
              Please configure your Firebase credentials to use this app.
            </p>
            <div className="text-left bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-sm font-semibold mb-2">Steps to configure:</p>
              <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1">
                <li>Create a Firebase project at <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-red-600 underline">Firebase Console</a></li>
                <li>Enable Firestore Database</li>
                <li>Enable Anonymous Authentication</li>
                <li>Copy <code className="bg-gray-200 px-1 rounded">.env.example</code> to <code className="bg-gray-200 px-1 rounded">.env</code></li>
                <li>Add your Firebase credentials to <code className="bg-gray-200 px-1 rounded">.env</code></li>
                <li>Restart the development server</li>
              </ol>
            </div>
            <p className="text-xs text-gray-500">
              See README.md for more details
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
