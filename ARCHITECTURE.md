# Shii-Edu Educational Platform Architecture

## Overview
This document describes the architectural decisions, patterns, and components that make up the Shii-Edu educational platform.

## High-Level Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│   Web Clients   │    │ Mobile Clients   │    │  Admin Dashboards  │
└─────────────────┘    └──────────────────┘    └────────────────────┘
           │                     │                         │
           ▼                     ▼                         ▼
┌───────────────────────────────────────────────────────────────────┐
│                   API Gateway (Vercel Serverless)                 │
└───────────────────────────────────────────────────────────────────┘
           │                     │                         │
           ▼                     ▼                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│ Firebase Auth   │    │  Firestore DB    │    │ Firebase Storage   │
└─────────────────┘    └──────────────────┘    └────────────────────┘
           │                     │                         │
           ▼                     ▼                         ▼
┌───────────────────────────────────────────────────────────────────┐
│                 Campus Backend Services (Node.js)                 │
└───────────────────────────────────────────────────────────────────┘
           │                     │                         │
           ▼                     ▼                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│   Supabase DB   │    │  AI Services     │    │  External APIs     │
└─────────────────┘    └──────────────────┘    └────────────────────┘
```

## Technology Stack

### Frontend
- **Web**: Next.js 13+ with App Router, React 19, TypeScript
- **Mobile**: React Native 0.85 with Expo SDK 56
- **Styling**: Tailwind CSS with custom design system
- **Icons**: Lucide React (web) and @expo/vector-icons (mobile)
- **State Management**: React Context API + Firebase Realtime Database listeners
- **Forms**: React Hook Form with Zod validation
- **Image Optimization**: next/image (web), expo-image (mobile)

### Backend
- **API Layer**: Vercel Serverless Functions (Node.js 18)
- **Database**: Firebase Firestore (primary), Supabase (secondary/analytics)
- **Authentication**: Firebase Authentication
- **Storage**: Firebase Storage
- **Background Jobs**: Vercel Cron Jobs
- **AI Services**: Custom Node.js services for document processing
- **Real-time Features**: Firebase Realtime Database for presence/messaging
- **File Processing**: Cloudinary for image/video transformations

### Infrastructure
- **Hosting**: Vercel (web), Firebase Hosting (fallback)
- **CI/CD**: GitHub Actions with Vercel integration
- **Monitoring**: Firebase Performance Monitoring, Vercel Analytics
- **Logging**: Vercel Logs, Firebase Console
- **Error Tracking**: Built-in Vercel error tracking, planning Sentry integration

## Architectural Patterns

### 1. Microfrontend Architecture
The platform employs a microfrontend approach where:
- Each role (student, teacher, admin, parent, driver, superadmin) has a dedicated entry point
- Shared components and services are centralized in `src/`
- Platform-specific code resides in `apps/` and `app/` directories
- Communication between microfrontends happens through shared state and events

### 2. Atomic Design System
Components follow atomic design principles:
- **Atoms**: Basic UI elements (buttons, inputs, icons)
- **Molecules**: Groups of atoms functioning together (form fields, cards)
- **Organisms**: Complex UI sections (headers, dashboards, lists)
- **Templates**: Page layouts
- **Pages**: Specific implementations of templates

### 3. Repository Pattern
Data access abstraction:
- Firebase services encapsulate Firestore operations
- Supabase services handle relational data operations
- Business logic remains separate from data access concerns
- Easy to swap or mock data sources for testing

### 4. Event-Driven Architecture
- Real-time updates via Firebase Realtime Database listeners
- Firestore triggers for backend processing
- Custom events for cross-component communication
- WebSocket-like behavior through Firebase listeners

### 5. Plugin-Based Feature System
- Features are enabled/disabled via `featureEntitlements.js`
- Role-based feature access control
- Dynamic component loading based on feature flags
- A/B testing capability through feature flags

## Data Model

### Firestore Collections
#### users
- uid (string, primary key)
- email (string)
- role (string: student|teacher|admin|parent|driver|superadmin)
- profilePic (string, URL)
- createdAt (timestamp)
- updatedAt (timestamp)
- institutionId (string, reference)
- metadata (map)

#### institutions
- id (string, primary key)
- name (string)
- domain (string)
- settings (map)
- branding (map)
- active (boolean)
- createdAt (timestamp)
- updatedAt (timestamp)

#### courses
- id (string, primary key)
- title (string)
- description (string)
- institutionId (string, reference)
- teacherId (string, reference to users)
- enrolledStudents (array of strings)
- metadata (map)
- createdAt (timestamp)
- updatedAt (timestamp)

#### assignments
- id (string, primary key)
- courseId (string, reference)
- title (string)
- description (string)
- dueDate (timestamp)
- maxPoints (number)
- createdAt (timestamp)
- updatedAt (timestamp)

#### submissions
- id (string, primary key)
- assignmentId (string, reference)
- studentId (string, reference to users)
- content (string)
- grade (number, nullable)
- feedback (string)
- submittedAt (timestamp)
- gradedAt (timestamp, nullable)

#### messages
- id (string, primary key)
- conversationId (string, reference)
- senderId (string, reference to users)
- content (string)
- messageType (string: text|image|file|system)
- readBy (array of strings)
- createdAt (timestamp)

### Supabase Tables (Analytics)
Similar structure to Firestore but optimized for analytical queries with proper indexing.

## Security Architecture

### Authentication Flow
1. User signs in via Firebase Authentication (email/password, Google, etc.)
2. Firebase returns ID token
3. Token is stored securely (SecureStore on mobile, HTTP-only cookie on web)
4. For each API request:
   - Token is verified via Firebase Admin SDK
   - User role and permissions are checked
   - Request is processed or rejected

### Authorization Model
- Role-Based Access Control (RBAC)
- Resource-based permissions (users can only access their own data unless elevated)
- Institution-level data isolation
- Superadmin has cross-institution access
- Feature flags further restrict capabilities

### Data Protection
- Firestore security rules enforce document-level access
- Firebase Storage rules protect uploaded files
- Sensitive data (PII) is encrypted at rest by Firebase
- TLS 1.3 encryption for all data in transit
- Regular security scanning of dependencies

### API Security
- Rate limiting on all endpoints (100 req/15min general, stricter for auth)
- Input validation and sanitization
- CORS restrictions to authorized domains
- Content Security Policy headers
- Protection against common web vulnerabilities (XSS, CSRF, SQLi)

## Performance Optimization

### Code Splitting
- Route-based splitting in Next.js
- Dynamic imports for heavy components
- Separate bundles for web and mobile
- Lazy loading of feature modules

### Asset Optimization
- Images: next/image (web) and expo-image (mobile) with automatic optimization
- Videos: Cloudinary for adaptive streaming
- Fonts: Subset loading and font-display: swap
- Icons: Tree-shakable icon libraries

### Caching Strategy
- HTTP caching with proper Cache-Control headers
- Service worker for offline capabilities (PWA)
- Firebase persistence for Firestore data
- Expo image caching for mobile
- Vercel Edge Cache for API responses

### Database Optimization
- Firestore composite indexes for query performance
- Denormalization where appropriate for read-heavy operations
- Pagination for large datasets
- Background aggregation for analytics

## Reliability Patterns

### Error Boundaries
- React error boundaries in component trees
- Global error handlers for uncaught exceptions
- User-friendly error messages with retry options
- Error reporting to monitoring services

### Offline Capabilities
- Firestore persistence enabled on all platforms
- Optimistic UI updates for better perceived performance
- Queue-based offline actions that sync when connectivity returns
- PWA capabilities for web app offline usage

### Graceful Degradation
- Feature detection for API availability
- FallbackUI for non-critical features
- Cached data display when live data unavailable
- Clear indication of offline/stale data states

### Monitoring and Alerting
- Firebase Performance Monitoring for app launch and UI jank
- Vercel Analytics for web performance metrics
- Custom metrics for business KPIs
- Alerting on error rates and performance thresholds

## Deployment Architecture

### Development
- Local development with Firebase Emulator Suite
- Hot module replacement for rapid iteration
- Expo Go for mobile testing
- Feature flags for safe experimentation

### Staging
- Separate Firebase project for staging
- Vercel preview deployments
- Automated testing on pull requests
- Performance testing in staging environment

### Production
- Multi-region Firebase deployment
- Vercel Edge Network for global CDN
- Blue-green deployments via Vercel
- Rollback capability within minutes
- Canary releases for risk mitigation

## Scalability Considerations

### Horizontal Scaling
- Stateless serverless functions scale automatically
- Firestore scales automatically with usage
- Firebase Authentication handles millions of users
- Storage scales with object count

### Database Scaling
- Firestore automatic sharding
- Index optimization for query performance
- Data archiving strategies for older records
- Read replicas for heavy read workloads (via exports)

### Traffic Spikes
- Vercel's automatic scaling handles traffic surges
- Firebase automatic scaling for database and auth
- Rate limiting prevents abuse during spikes
- Queue-based processing for non-urgent work

## Future Enhancements

### Planned Improvements
1. **Microservices Migration**: Move campus-backend to dedicated microservices
2. **GraphQL API**: Replace REST with GraphQL for efficient data fetching
3. **WebSocket Migration**: Replace Firebase Realtime Database with WebSocket service
4. **Analytics Pipeline**: Implement robust analytics with data warehouse
5. **Machine Learning**: Add personalized learning recommendations
6. **Offline First**: Enhance offline capabilities with better sync conflict resolution
7. **Accessibility**: WCAG 2.1 AA compliance improvements
8. **Internationalization**: Full i18n support for global deployment

### Technical Debt
- Gradual migration from JavaScript to TypeScript
- Component library refinement and documentation
- Test coverage improvement
- Build pipeline optimization
- Dependency updates and security patches

## Diagrams

### Component Relationships
```
[Role-Based Entry Points]
         ↓
[Shared Layout Components] ←→ [Design System]
         ↓
[Feature-Specific Components] ←→ [Business Logic]
         ↓
[Data Access Layer] ←→ [Firebase/Supabase Services]
         ↓
[External Services] ←→ [APIs/Webhooks]
```

### Data Flow
```
[User Action]
         ↓
[Optimistic UI Update]
         ↓
[API Request to Vercel Function]
         ↓
[Auth Validation & Authorization]
         ↓
[Business Logic Processing]
         ↓
[Database Write (Firestore/Supabase)]
         ↓
[Real-time Listeners Trigger]
         ↓
[UI Update Across Clients]
         ↓
[Background Processing (if needed)]
         ↓
[Notifications/Actions Sent]
```

## Conclusion
The Shii-Edu platform follows modern architectural best practices with a focus on scalability, maintainability, and user experience. The combination of serverless functions, flexible databases, and cross-platform frameworks enables rapid iteration while maintaining enterprise-grade reliability and security.