# Shii-Edu Educational Platform Setup Guide

## Overview
This guide provides step-by-step instructions for setting up the Shii-Edu educational platform locally and deploying it to production.

## Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher
- Firebase project with Firestore, Authentication, and Storage enabled
- Expo CLI (for mobile development)
- Git
- Vercel account (for web deployment)

## Project Structure
```
educational-saas-app/
├── app/                    # Next.js 13+ App Router (web)
├── src/                    # Shared React Native components
├── apps/                   # Platform-specific applications
│   ├── edu-hub-superadmin/ # Super Admin web app
│   └── edu-shii/           # Mobile apps (shared)
├── campus-backend/         # Node.js backend services
├── public/                 # Static assets
└── server/                 # Vercel serverless functions
```

## Local Development Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd educational-saas-app
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install web dependencies
npm run install:web

# Install mobile dependencies
npm run install:mobile
```

### 3. Environment Configuration
Create `.env.local` files for each environment:

#### Web (.env.local in root)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

NEXT_PUBLIC_VERCEL_URL=your_vercel_url
```

#### Mobile (.env in apps/edu-shii)
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Firebase Setup
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database (in Native mode)
3. Enable Firebase Authentication with Email/Password provider
4. Enable Firebase Storage
5. Add your web app to Firebase and copy the config values
6. For mobile, download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) and place in appropriate directories

### 5. Supabase Setup (Optional)
1. Create a Supabase project at https://supabase.com
2. Copy the URL and anon key
3. Enable required extensions if needed

### 6. Run Development Servers

#### Web Development
```bash
npm run dev:web
```
Access at http://localhost:3000

#### Mobile Development
```bash
# For iOS
npm run dev:ios

# For Android
npm run dev:android

# For Web (Expo)
npm run dev:expo
```

## Production Deployment

### Vercel Web Deployment
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Link project: `vercel` (follow prompts)
4. Set environment variables in Vercel dashboard
5. Deploy: `vercel --prod`

### Firebase Hosting (Alternative)
```bash
npm run build:web
firebase deploy --only hosting
```

### Mobile App Stores
#### Android (Google Play Store)
1. Generate release APK: `npm run build:android-release`
2. Follow Google Play Console publishing process
3. Upload the generated APK/AAB

#### iOS (App Store)
1. Build for iOS: `npm run build:ios-release`
2. Use Xcode to archive and upload to App Store Connect
3. Follow Apple's App Store review process

## Database Setup

### Firestore Indexes
Some queries require composite indexes. After first deployment, check Firebase console for index creation prompts and create them as needed.

### Security Rules
Review and customize Firestore security rules in `firestore.rules`:
- Ensure proper read/write permissions for each collection
- Implement role-based access control
- Validate data structure on write

## Feature Flags
The platform uses a feature flag system controlled by:
- `src/constants/featureEntitlements.js`
- `src/constants/featureCatalog.json`

Modify these files to enable/disable features for different user roles or institutes.

## Monitoring and Analytics

### Firebase Performance Monitoring
Automatically configured in mobile apps. Check Firebase console for performance insights.

### Error Tracking
- Web: Vercel provides automatic error tracking
- Mobile: Configure Firebase Crashlytics in `src/services/errorTracking.js`

## Backup and Recovery

### Firebase Data Export
1. Schedule regular exports via Firebase console
2. Export to Google Cloud Storage
3. Set up automated backup scripts

### Supabase Backup (if used)
Use Supabase's built-in backup functionality or set up logical replication.

## Troubleshooting

### Common Issues

#### Firebase Initialization Errors
- Verify all Firebase config values are correct
- Ensure Firestore API is enabled in Google Cloud Console
- Check that the service account has proper permissions

#### Module Resolution Errors
- Clear Metro cache: `npx expo start -c`
- Clear npm cache: `npm cache clean --force`
- Reinstall dependencies: `rm -rf node_modules && npm install`

#### Build Failures
- Check for TypeScript errors: `npm run type-check`
- Ensure all dependencies are compatible with React Native 0.85
- Verify Expo SDK version compatibility

#### Authentication Issues
- Verify Firebase Authentication providers are enabled
- Check that authorized domains are correctly configured
- Test with Firebase Emulator Suite if needed

## Maintenance

### Regular Updates
```bash
# Update npm dependencies
npm update

# Check for outdated packages
npm outdated

# Update Expo SDK (when needed)
npx expo upgrade
```

### Database Maintenance
- Monitor Firestore usage and index effectiveness
- Archive old data periodically
- Implement data retention policies

### Security Updates
- Regularly update dependencies to patch vulnerabilities
- Monitor Firebase security alerts
- Conduct periodic security audits

## Contributing
See CONTRIBUTING.md for development guidelines, coding standards, and pull request procedures.

## Support
For issues and questions:
- Check existing GitHub Issues
- Review the documentation
- Contact the development team through established channels

## License
This project is licensed under the MIT License - see LICENSE.md for details.