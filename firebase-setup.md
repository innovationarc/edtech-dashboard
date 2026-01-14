# Firebase Setup Instructions

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter your project name
4. Enable Google Analytics (optional)
5. Click "Create project"

## 2. Enable Authentication

1. In your Firebase project, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" provider
5. Click "Save"

## 3. Create Firestore Database

1. Go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location for your database
5. Click "Done"

## 4. Enable Storage

1. Go to "Storage"
2. Click "Get started"
3. Choose "Start in test mode"
4. Select a location
5. Click "Done"

## 5. Get Firebase Configuration

1. Go to "Project settings" (gear icon)
2. Scroll down to "Your apps"
3. Click "Web" icon (</>) to add a web app
4. Register your app with a nickname
5. Copy the configuration object

## 6. Update Environment Variables

Replace the values in `.env` file with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_actual_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_actual_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
VITE_FIREBASE_APP_ID=your_actual_app_id
```

## 7. Create Initial Admin User

After setting up Firebase, you can create an admin user by:

1. Going to Authentication > Users in Firebase Console
2. Click "Add user"
3. Enter email: admin@example.com
4. Enter password: admin123
5. After creating, go to Firestore Database
6. Create a document in "users" collection with the user's UID as document ID
7. Add fields:
   - name: "Admin User"
   - email: "admin@example.com"
   - role: "admin"
   - status: "active"
   - createdAt: (current timestamp)

## 8. Firestore Security Rules (Optional for Production)

For production, update Firestore rules in Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Only admins can manage all users
    match /users/{userId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Content and other collections - adjust as needed
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 9. Start the Application

```bash
npm install
npm run dev
```

Your Firebase-integrated admin panel is now ready!