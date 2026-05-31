# Production Security Checklist

## Required Before Launch

1. Rotate the Razorpay key pair that previously appeared in source control or local files.
2. Set backend environment variables from `campus-backend/.env.example`; never commit `.env`.
3. Set app environment variables from `.env.example`, including Firebase public config and `EXPO_PUBLIC_API_BASE_URL`.
4. Deploy `firestore.rules` and `storage.rules` with Firebase CLI.
5. Restrict the Firebase web API key in Google Cloud Console to trusted app domains and package identifiers.
6. Configure `APP_ORIGIN` on the backend to production origins only.
7. Use a restricted Cloudinary unsigned upload preset, or replace client uploads with a signed backend upload endpoint.
8. Migrate Expo/React Native to a currently supported SDK before public production release; the current SDK line still has transitive audit findings that require a breaking upgrade.

## Backend Expectations

- All privileged account creation now goes through authenticated backend endpoints.
- Razorpay order creation is server-derived from Firestore dues, not from client-provided amounts.
- Payment completion requires Razorpay signature verification before Firestore fee updates.
- Firebase Admin credentials must be provided via `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Firebase web config is public client configuration, but it must still be restricted in Google Cloud and supplied through Expo public env vars.
