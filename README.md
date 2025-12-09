# Reflections - Community Bonding Game

A real-time multiplayer web app for Christmas gatherings. Players anonymously share reflections about each other in a safe, controlled environment.

## Features

- **Single Room Game**: All players connect to one hardcoded session
- **Anonymous Play**: No login required, just enter your name
- **Safety First**: Strict "Avoid" list enforcement in matchmaking
- **Real-time Updates**: Firebase Firestore for live game state
- **Admin Controls**: Hidden `/admin` route for game management
- **Christmas Themed**: Beautiful, mobile-first UI with festive colors

## Tech Stack

- React (Vite) + TypeScript
- Tailwind CSS
- Firebase Firestore (V9 Modular SDK)
- Firebase Anonymous Auth
- React Router

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Firebase:**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Firestore Database
   - Enable Anonymous Authentication
   - Copy `.env.example` to `.env` and fill in your Firebase credentials

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Access the app:**
   - Player view: `http://localhost:5173/`
   - Admin view: `http://localhost:5173/admin`

## Game Flow

1. **LOBBY**: Players enter their name and join
2. **PREFERENCES**: Players mark who they know well (⭐) and who they'd prefer not to write about (❌)
3. **WRITING**: Players write reflections about their assigned targets
4. **REVEAL**: Host reveals reflections one by one

## Matchmaking Algorithm

The matchmaking algorithm uses a randomized backtracking approach with strict constraints:

- **Hard Constraints:**
  - No assignments to players in the writer's "Avoid" list
  - No self-assignments
  - No duplicate assignments
  - Every player writes exactly N times
  - Every player is a target exactly N times

- **Soft Constraints:**
  - Prioritizes assignments where the target is in the writer's preferences
  - Falls back to neutral assignments when preferences aren't possible

## Firebase Security Rules

**IMPORTANT:** You must set up Firestore security rules in the Firebase Console. Copy the rules from `firestore.rules` file or use these:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users (including anonymous) to read/write
    match /christmas-metaphor/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // More specific rules for better security
    match /christmas-metaphor/live_event {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // In production, you might want admin-only writes
      
      match /players/{playerId} {
        // Anyone can read players
        allow read: if request.auth != null;
        // Users can only write their own player document
        allow write: if request.auth != null && request.auth.uid == playerId;
      }
    }
  }
}
```

**To apply these rules:**
1. Go to Firebase Console → Firestore Database → Rules
2. Paste the rules above
3. Click "Publish"

**Note:** The game document (`live_event`) allows writes from any authenticated user because the admin runs matchmaking from the client. In production, consider adding admin-only checks.

## License

MIT

