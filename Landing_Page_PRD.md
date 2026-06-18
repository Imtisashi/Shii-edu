# Shii-Edu Landing Page Product Requirements Document

## Overview
The Shii-Edu landing page serves as the primary marketing and conversion interface for the institute-branded education operations workspace. It communicates the platform's value proposition, features, and technical superiority while driving user engagement and sign-ups.

## Objectives
1. Clearly communicate Shii-Edu's unique value proposition as an institute-branded education operations workspace
2. Showcase real platform captures (not mockups) to build trust
3. Demonstrate role-based isolation and workflow optimization
4. Highlight technical differentiators (tenant boundaries, subscription control, brand following campus)
5. Drive conversions to role-based sign-in and institute onboarding
6. Establish credibility through verified metrics and trust indicators

## Target Audience
- Institute administrators considering adopting an education operations platform
- Educational technology decision-makers in K-12 and higher education institutions
- Teachers and staff evaluating workflow improvements
- Parents and students interested in institutional technology adoption

## Key Sections and Requirements

### 1. Hero Section
- **Purpose**: Immediate value proposition and primary call-to-action
- **Requirements**:
  - Animated background with cosmic campus video (looped, muted, autoplay)
  - Study doodle field with floating, rotating sketched elements
  - Clear headline: "Shii-Edu" wordmark with emphasis on S and E
  - Sub-headline describing precise institute workspace capabilities
  - Verification metrics strip showing role coverage, UI captures, etc.
  - Primary CTA: "Login" button navigating to role selection
  - Secondary CTA: "Explore workspace" anchor link
  - Onboarding section for unregistered institutes with mailto link
  - Cinematic landing stage preview component with role-based modes

### 2. Workspace Section
- **Purpose**: Explain the unified operational surface concept
- **Requirements**:
  - Grid layout of workstream cards (Academics, Communication, Media, Transport)
  - Each card with icon, title, and descriptive body text
  - Responsive grid that adapts to screen size
  - Subtle hover effects on cards

### 3. Features Section
- **Purpose**: Detail the comprehensive feature set
- **Requirements**:
  - Feature cluster grid (Academics, Communication, Operations, Learning Library, Transport, AI-powered review)
  - Each cluster with icon, title, and feature pills
  - Responsive layout adapting from 3-column to 2-column to 1-column
  - Hover states on feature pills
  - Border separation between clusters

### 4. Screenshots Section
- **Purpose**: Show real platform captures to build credibility
- **Requirements**:
  - Grid of UI screenshots for each role (Home, Login, Admin, Routes, Teacher, Student, Parent, Driver)
  - Each screenshot in a window frame with role/route label
  - Animated scanning line effect across screenshots
  - Hover lift effect on screenshot windows
  - Role-colored accents matching Shii-Edu palette
  - Responsive grid (3→2→1 column)

### 5. Proof Section
- **Purpose**: Demonstrate what Shii-Edu offers beyond a brochure site
- **Requirements**:
  - Two-column layout with proof cards
  - Left card: Dark theme with operational workflow proof points
  - Right card: Light theme with additional proof points
  - Numbered indicators (01, 02, etc.) on each card
  - Subtle gradient backgrounds on cards
  - Clear typography hierarchy

### 6. Role Explorer Section
- **Purpose**: Interactive role-based product demonstration
- **Requirements**:
  - Horizontal role selector tabs (Admin, Teacher, Student, Parent, Driver)
  - Selected state with white background and colored text
  - Unselected state with transparent border and muted text
  - Active scale(0.97) transform on press
  - Smooth transition between states (120ms ease-out-quart)
  - Role panel with:
    - Icon and title
    - Descriptive body copy
    - Feature checkmarks with shield icons
    - Preview stack showing role-specific workflow items
    - Animated entrance effects for panel and stack items

### 7. Roles Section
- **Purpose**: Explain role-specific product allocation
- **Requirements**:
  - Dark background section with light text
  - Horizontal role lanes (Superadmin, Institute admin, Teachers, Students/parents)
  - Each lane with icon, title, and descriptive body
  - Subtle border separation between lanes
  - Radius on first and last lanes

### 8. Difference Section
- **Purpose**: Highlight technical differentiators from generic education apps
- **Requirements**:
  - Grid of difference rows
  - Each row with colored dot indicator (gold), title, and description
  - Alternating background on rows
  - Clear typography hierarchy
  - Responsive layout

### 9. Theme Section
- **Purpose**: Demonstrate brand consistency across roles
- **Requirements**:
  - Two-column layout: copy and theme preview panel
  - Copy explaining admin theme propagation
  - Theme panel with:
    - Brand Studio header
    - Color swatches (ink, violet, teal, gold)
    - Preview grid showing theme application
  - Subtle animations and interactions

### 10. Trust Section
- **Purpose**: Build credibility through transparency about security and privacy
- **Requirements**:
  - Table of trust items with:
    - Title (Institute data boundary, Payment metadata, etc.)
    - Description
    - Status indicator (Active/Minimal/Scoped/Ready)
  - Success state styling for trust indicators
  - Clear typography and spacing

### 11. Legal Section
- **Purpose**: Provide access to legal documents
- **Requirements**:
  - Grid of legal link cards (Privacy Policy, Terms of Service)
  - Each card with icon, title, description, and arrow
  - Hover lift effect and border color change
  - Consistent styling with other action elements

## Animation Specifications

### Global Animation Principles
- **Easing Function**: `cubic-bezier(0.32, 0.72, 0, 1)` (ease-out-quart) for all transitions
- **Fast Motion**: 120ms duration for micro-interactions
- **Medium Motion**: 180ms duration for standard transitions
- **Reduced Motion**: Respects `prefers-reduced-motion` media query
- **Performance**: Uses `will-change` and `transform` for hardware acceleration where beneficial

### Specific Animations

#### 1. Hero Section Animations
- **Study Doodle Field**:
  - Individual doodles float with `study-doodle-drift` animation
  - Duration: Variable per doodle (7.2s-9s)
  - Delay: Staggered per doodle (-0.3s to -5.2s)
  - Rotation: Subtle rotational drift
  - Opacity: 0.74 base opacity
  - Scale: Maintains original size
  - Motion path: 6px right, -10px down at 50% of cycle

- **Cinematic Stage**:
  - Dashboard float: `landing-float-y` (5.2s, ease-out-quart, infinite)
    - 0% & 100%: translateY(0)
    - 50%: translateY(-8px)
  - Card One float: `landing-float-a` (4.8s, ease-out-quart, infinite)
    - 0% & 100%: translate(0, 0)
    - 50%: translate(8px, -5px)
  - Card Two float: `landing-float-b` (5s, ease-out-quart, infinite)
    - 0% & 100%: translate(0, 0)
    - 50%: translate(-7px, 6px)
  - All use `will-change: transform` for performance

#### 2. Interactive Element Animations
- **Buttons & Links**:
  - Hover: `transform: translateY(-1px)` + border color change
  - Active: `transform: scale(0.97)`
  - Focus-visible: 2px solid primary outline + 2px offset
  - Transition: All properties 120ms ease-out-quart

- **Role Selector Buttons**:
  - Same base animation as standard buttons
  - Selected state: White background with colored text
  - Transition: background, border-color, color, transform (120ms ease-out-quart)

#### 3. Screenshot Section Animations
- **UI Shot Windows**:
  - Hover/Focus: `transform: translateY(-2px)` + border color intensification
  - Transition: border-color 150ms, transform 150ms (both ease-out-quart)
  - Scanning Line Effect:
    - `ui-shot-scan` animation (2.8s, ease-out-quart, infinite)
    - 0%-42%: translateX(-120%)
    - 70%-100%: translateX(260%)
    - Delay: Staggered per screenshot (index * 80ms)

#### 4. Role Explorer Animations
- **Role Panel Entrance**:
  - `role-panel-in` animation (240ms, cubic-bezier(0.22, 1, 0.36, 1))
  - From: blur(5px), opacity: 0, translateY(10px)
  - To: blur(0), opacity: 1, translateY(0)

- **Role Preview Stack Items**:
  - `role-stack-in` animation (220ms, cubic-bezier(0.22, 1, 0.36, 1))
  - From: opacity: 0, translateX(10px)
  - To: opacity: 1, translateX(0)
  - Delay: Staggered per item (index * 42ms)

#### 5. Cinematic Dashboard Animations
- **Premium Panel Entrance**:
  - `premium-panel-in` animation (220ms, cubic-bezier(0.22, 1, 0.36, 1))
  - From: opacity: 0.3, translateY(8px)
  - To: opacity: 1, translateY(0)

- **Premium Row Entrance**:
  - `premium-row-in` animation (220ms, cubic-bezier(0.22, 1, 0.36, 1))
  - From: opacity: 0.35, translateX(-8px)
  - To: opacity: 1, translateX(0)
  - Delay: Staggered per element (metric-delay, timeline-delay)

#### 6. Feature & Component Animations
- **Feature Pills**:
  - Hover: Background color change
  - Transition: background-color (motion-fast)

- **Legal Link Cards**:
  - Hover: `transform: translateY(-1px)` + border color change
  - Transition: border-color, transform (both motion-fast)

## Technical Requirements

### Performance
- **Core Web Vitals Target**:
  - LCP: < 2.5s
  - FID: < 100ms
  - CLS: < 0.1
- **Image Optimization**:
  - All screenshots optimized and served at appropriate sizes
  - Lazy loading for below-the-fold images
  - Modern formats (WebP/AVIF) where supported
- **Video Optimization**:
  - Cosmic campus video compressed and optimized for web
  - Appropriate resolution and bitrate
  - Poster frame for initial load
- **CSS Optimization**:
  - Critical CSS inlined for above-the-fold content
  - Non-critical CSS deferred
  - Minimal unused CSS

### Accessibility
- **WCAG 2.1 AA Compliance**:
  - Proper semantic HTML structure
  - Adequate color contrast (minimum 4.5:1 for text)
  - Keyboard navigable interface
  - ARIA labels and roles where appropriate
  - Focus visible indicators
  - Reduced motion support
  - Text scaling support (up to 200%)
  - Language attributes
  - Labelled form elements

### SEO
- **Structured Data**:
  - JSON-LD WebApplication schema
  - Proper metadata tags
  - Descriptive page title
  - Meaningful heading hierarchy
- **Performance**:
  - Fast loading times
  - Mobile-friendly design
  - Proper viewport configuration

### Browser Support
- **Supported Browsers**:
  - Chrome: Latest - 2 versions
  - Firefox: Latest - 2 versions
  - Safari: Latest - 2 versions
  - Edge: Latest - 2 versions
- **Graceful Degradation**:
  - Functional experience in unsupported browsers
  - Feature detection for advanced CSS/JS features
  - Polyfills where necessary and practical

## Content Requirements

### Text Content
- **Tone**: Professional, confident, clear, and helpful
- **Voice**: Third-person institutional, approachable but authoritative
- **Length**: Concise yet comprehensive
- **Localization**: English primary, designed for future i18n
- **Readability**: Target 8th-grade reading level

### Visual Content
- **Screenshots**: Authentic captures from a verified demo institute build
- **Icons**: Lucide React icon set with consistent styling
- **Illustrations**: Study doodle field with procedural SVG elements
- **Video**: Cosmic campus background video
- **Brand Assets**: Shii-Edu wordmark, logo, color palette

### Metrics & Proof Points
- Verified through actual platform usage
- Based on verified demo institute implementation
- Updated regularly to reflect current state
- Specific and measurable claims only

## Success Metrics

### Conversion Metrics
- Click-through rate to role selection
- Institute onboarding form submissions
- Email capture rate (if implemented)
- Time on page
- Scroll depth analytics

### Engagement Metrics
- Interaction rate with role explorer
- Screenshot views/expansions
- Feature cluster engagements
- Video playback completion rate

### Performance Metrics
- Page load time (target < 3s on 3G)
- Core Web Vitals scores
- Animation smoothness (60fps target)
- Error rates (JS errors, failed resource loads)

## Implementation Guidelines

### Development Approach
- **Component-Based**: Reusable, isolated components
- **Mobile-First**: Progressive enhancement from mobile to desktop
- **Performance Budget**: Strict adherence to performance targets
- **Accessibility First**: WCAG compliance integrated throughout
- **Testing**: Unit, integration, and visual regression testing

### Code Organization
- **Components**: Located in `/app/components/`
- **Styles**: Global styles in `/app/globals.css`, component-specific where needed
- **Assets**: Images in `/public/`, videos in `/public/assets/videos/`
- **Data**: Static data in page component or separate data files
- **Types**: TypeScript definitions where applicable

### Quality Standards
- **Code Quality**:
  - Consistent formatting (Prettier/ESLint)
  - Meaningful variable and function names
  - Proper component documentation
  - No console.log in production
  - Error boundaries where appropriate
- **Design Fidelity**:
  - Pixel-perfect implementation of specifications
  - Consistent spacing and typography
  - Accurate color implementation
  - Faithful animation reproduction

## Dependencies
- **React**: Latest stable version
- **Next.js**: App Router with SSR/RSC
- **Lucide React**: Icon set
- **CSS**: Custom properties and modern CSS features
- **External Assets**:
  - Cosmic campus video (/assets/videos/cosmic-campus.mp4)
  - Various screenshot assets (/screenshots/*)
  - Icon assets (lucide-react)
  - Font assets (system fonts with Aptos preference)

## Future Enhancements
- **A/B Testing Framework**: For iterative improvement
- **Personalization**: Based on visitor type/geography
- **Advanced Analytics**: Deeper interaction tracking
- **Internationalization**: Multi-language support
- **Dynamic Content**: CMS-driven updates
- **Interactive Demos**: Live sandbox experiences
- **Social Proof**: Testimonials and case studies
- **Accessibility Enhancements**: Continued WCAG AAA improvements

## Risk Assessment
- **Technical Risks**:
  - Video loading performance on slow connections
  - Animation performance on low-end devices
  - Third-party script impact on performance
- **Mitigation Strategies**:
  - Video preloading and fallback poster
  - Reduced motion alternatives
  - Performance budgets and monitoring
  - Lazy loading and code splitting

## Approval and Review
- **Stakeholders**: Product, Design, Engineering, Marketing
- **Review Process**: Design review → Technical review → QA → Stakeholder approval
- **Testing**: Cross-browser, cross-device, accessibility testing
- **Launch Plan**: Staged rollout with monitoring

---
*This PRD outlines the complete specifications for the Shii-Edu landing page, including all animations, interactions, and technical requirements as implemented in the current codebase.*
