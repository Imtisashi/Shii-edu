# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Installation
```bash
# Install root dependencies
npm install

# Install web-specific dependencies
npm run install:web

# Install mobile-specific dependencies
npm run install:mobile
```

### Development Servers
```bash
# Web development (Next.js)
npm run dev:web

# iOS development (Expo)
npm run dev:ios

# Android development (Expo)
npm run dev:android

# Web development via Expo
npm run dev:expo
```

### Building
```bash
# Web production build (Next.js)
npm run build:ssr

# Web static export (Expo)
npm run build:expo

# Android release APK
npm run build:android-release

# iOS release (requires Xcode)
npm run build:ios-release
```

### Testing
```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run end-to-end tests (Playwright)
npm run test:e2e

# Run end-to-end tests in headed mode
npm run test:e2e:headed
```

### Linting
```bash
# ESLint check
npm run lint

# TypeScript type checking
npm run typecheck
```

### Environment & Deployment
```bash
# Sync environment variables with Vercel
npm run vercel:env:sync

# Deploy to Vercel production
npm run deploy:vercel

# Deploy Firebase Firestore rules
npm run deploy:firebase:rules

# Reset project to starter state
npm run reset-project
```

### Other Useful Scripts
```bash
# Generate PWA icons
npm run generate:pwa-icons

# Build role-specific APKs (driver, institute, parents, superadmin)
npm run android:apk:driver
npm run android:apk:institute
npm run android:apk:parents
npm run android:apk:superadmin
npm run android:apk:roles  # builds all role APKs

# Build SuperAdmin desktop app (Windows)
npm run desktop:superadmin
```

## Project Architecture

### High-Level Structure
```
educational-saas-app/
├── app/                    # Next.js 13+ App Router (web application)
├── src/                    # Shared React Native components and business logic
├── apps/                   # Platform-specific applications
│   ├── edu-hub-superadmin/ # Super Admin web application
│   └── edu-shii/           # Shared mobile application code
├── campus-backend/         # Node.js backend services for AI/document processing
├── public/                 # Static assets served directly
├── server/                 # Vercel serverless functions (API endpoints)
├── scripts/                # Utility scripts for builds, deployment, etc.
└── ...                     # Configuration files (firebase, expo, vercel, etc.)
```

### Key Architectural Patterns

1. **Microfrontend Architecture**: 
   - Different user roles (student, teacher, admin, parent, driver, superadmin) have dedicated entry points
   - Shared components and services centralized in `src/`
   - Platform-specific code in `apps/` and `app/` directories

2. **Atomic Design System**:
   - Components organized as atoms, molecules, organisms, templates, and pages
   - Shared design system in `src/components/` following this pattern

3. **Repository Pattern**:
   - Data access abstracted through Firebase and Supabase services
   - Business logic separated from data access concerns
   - Found in `src/services/`

4. **Event-Driven Architecture**:
   - Real-time updates via Firebase Realtime Database listeners
   - Firestore triggers for backend processing
   - Custom events for cross-component communication

5. **Plugin-Based Feature System**:
   - Features enabled/disabled via `src/constants/featureEntitlements.js`
   - Role-based feature access control
   - Dynamic component loading based on feature flags

### Technology Stack

- **Web**: Next.js 13+ with App Router, React 19, TypeScript
- **Mobile**: React Native 0.85 with Expo SDK 56
- **Styling**: Tailwind CSS with custom design system
- **Backend**: 
  - Vercel Serverless Functions (API layer)
  - Firebase Firestore (primary database)
  - Firebase Authentication
  - Firebase Storage
  - Supabase (secondary analytics database)
  - Campus Backend (Node.js for AI/services)
- **Infrastructure**: 
  - Vercel hosting (web)
  - Firebase Hosting (fallback)
  - GitHub Actions CI/CD

### Important Directories

- `src/components/` - Shared reusable components (atomic design)
- `src/services/` - Firebase/Supabase service layer
- `src/hooks/` - Custom React hooks
- `src/constants/` - Feature flags, configuration constants
- `app/` - Next.js App Router (pages, layouts, route handlers)
- `apps/edu-shii/` - Shared mobile application assets and configuration
- `apps/edu-hub-superadmin/` - SuperAdmin-specific web code
- `server/` - Vercel API routes (serverless functions)
- `campus-backend/` - Independent Node.js services for processing
- `scripts/` - Build, deployment, and utility scripts

### Data Flow
1. User action triggers optimistic UI update
2. API request sent to Vercel function (`server/api/`)
3. Auth validation and authorization checked
4. Business logic processed
5. Database write (Firestore/Supabase)
6. Real-time listeners trigger UI updates across clients
7. Background processing initiated if needed
8. Notifications/actions sent

## File Conventions

- **TypeScript**: Use `.ts` for logic files, `.tsx` for React components
- **Styling**: Tailwind CSS utility classes; custom classes in `@layer` directives
- **State Management**: React Context API + Firebase Realtime Database listeners
- **Forms**: React Hook Form with Zod validation
- **Routing**: 
  - Web: Next.js App Router (`app/` directory)
  - Mobile: Expo/Router (JSON-based navigation in `apps/edu-shii/`)
- **Testing**: 
  - Unit tests: `__tests__` folders or `.test.ts` files
  - E2E: Playwright tests in `e2e/` directory
- **Environment Variables**: 
  - Web: `.env.local` (root) with `NEXT_PUBLIC_` prefix
  - Mobile: `.env` (in `apps/edu-shii/`) with `EXPO_PUBLIC_` prefix

## Common Development Tasks

### Adding a New Feature
1. Check feature flags in `src/constants/featureEntitlements.js`
2. Create components in appropriate `src/components/` category (atom/molecule/organism)
3. Add any needed services in `src/services/`
4. Update routing in `app/` (web) or navigation config (mobile)
5. Write unit tests for new logic
6. Test on both web and mobile platforms

### Modifying Database Schema
1. Update Firestore rules in `firestore.rules` if needed
2. Modify service methods in `src/services/` 
3. Update TypeScript interfaces for data models
4. Create migration scripts if data transformation needed
5. Test read/write operations thoroughly

### Debugging
- Web: Use Vercel devtools (`npm run dev:web`) and Chrome devtools
- Mobile: Use Expo devtools (`npm run dev:ios` or `dev:android`) and Flipper
- Backend: Check Vercel logs (`vercel logs`) or campus-backend console
- Database: Use Firebase console or Supabase dashboard
