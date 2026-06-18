export type LandingMetric = {
  label: string;
  value: string;
};

export type MegaMenuItem = {
  description: string;
  href: string;
  title: string;
};

export type NavGroup = {
  href: string;
  items: MegaMenuItem[];
  label: string;
  summary: string;
};

export type FeatureTab = {
  bullets: string[];
  description: string;
  eyebrow: string;
  id: string;
  preview: {
    lead: string;
    rows: string[];
    stat: string;
  };
  title: string;
};

export type ProofCard = {
  body: string;
  icon: 'fingerprint' | 'route' | 'spark' | 'layers' | 'receipt' | 'users';
  title: string;
};

export type CaseStudy = {
  category: string;
  href: string;
  metrics: LandingMetric[];
  note: string;
  title: string;
};

export type Testimonial = {
  quote: string;
  role: string;
  tag: string;
};

export type ResourceCard = {
  category: string;
  cta: string;
  href: string;
  summary: string;
  title: string;
};

export type UiFeatureCard = {
  demo: {
    primary: string;
    rows: {
      label: string;
      status: string;
      value: string;
    }[];
    stats: LandingMetric[];
  };
  detail: string;
  id: string;
  kicker: string;
  steps: string[];
  summary: string;
  title: string;
  tone: 'blue' | 'amber' | 'teal' | 'violet';
};

export type PricingPlan = {
  badge?: string;
  description: string;
  features: string[];
  key: 'basic' | 'pro' | 'max';
  monthly: number;
  title: string;
  yearly: number;
};

export type PricingComparisonRow = {
  aspect: string;
  basic: string;
  pro: string;
  max: string;
};

const contactMailto =
  'mailto:sashimiofficials@gmail.com?subject=Institute%20onboarding%20request&body=Hello%20Shii-Edu%20team%2C%0A%0APlease%20contact%20us%20about%20registering%20our%20institute.%0A%0AInstitute%20name%3A%0AContact%20person%3A%0APhone%3A';

export const landingContent = {
  brand: {
    descriptor: 'Institute operating system',
    name: 'Shii-Edu',
  },
  nav: [
    {
      href: '#platform',
      label: 'Platform',
      summary: 'A role-scoped workspace for daily campus operations.',
      items: [
        {
          description: 'Attendance, notices, fees, transport, files, and people records in one operator surface.',
          href: '#platform',
          title: 'Operations desk',
        },
        {
          description: 'Admin, teacher, student, parent, and driver interfaces stay focused on their own work.',
          href: '#inside-app',
          title: 'Role apps',
        },
        {
          description: 'Institute theme, feature access, and subscription limits are managed centrally.',
          href: '#pricing',
          title: 'Subscription control',
        },
      ],
    },
    {
      href: '#features',
      label: 'Features',
      summary: 'The modules institutes actually need after launch.',
      items: [
        {
          description: 'Routines, attendance, assignments, grades, reports, courses, and shared resources.',
          href: '#features',
          title: 'Academic workflow',
        },
        {
          description: 'Bulk fee allocation, offline payment marking, payroll, receipts, and ledgers.',
          href: '#features',
          title: 'Finance workflow',
        },
        {
          description: 'Coordinates, assigned drivers, parent route views, and simple driver screens.',
          href: '#inside-app',
          title: 'Map transport',
        },
      ],
    },
    {
      href: '#pricing',
      label: 'Pricing',
      summary: 'Basic, Pro, and Max plans with yearly options.',
      items: [
        {
          description: 'Start with the required school operations without AI or bus tracking.',
          href: '#pricing',
          title: 'Basic',
        },
        {
          description: 'Add transport, AI tools, advanced reports, and higher operational limits.',
          href: '#pricing',
          title: 'Pro',
        },
        {
          description: 'Unlock Max agent, custom subdomain support, advanced controls, and higher AI limits.',
          href: '#pricing',
          title: 'Max',
        },
      ],
    },
  ] satisfies NavGroup[],
  hero: {
    badge: 'Built for serious institute operations',
    contactCta: {
      href: contactMailto,
      label: 'Contact registration',
      text: 'Is your institute not registered? Contact us to onboard.',
    },
    description:
      'Shii-Edu coordinates academics, fees, payroll, parent support, transport, files, notices, and bounded AI reports inside role-specific apps.',
    flipWords: ['attendance', 'fees', 'routes', 'reports'],
    metrics: [
      { label: 'installable role apps', value: '3' },
      { label: 'monthly plans from', value: 'Rs. 3k' },
      { label: 'Max AI report tier', value: '1' },
    ] satisfies LandingMetric[],
    primaryCta: {
      href: '/roles',
      label: 'Sign in',
    },
    secondaryCta: {
      href: '#pricing',
      label: 'View pricing',
    },
    title: 'The campus operating system for every role.',
  },
  mockup: {
    activity: [
      'Bulk fee allocation is ready for Class 8 and Semester 2',
      'Teacher payroll is queued for Stripe review',
      'Parent support has 6 accounts needing office help',
      'Route B has driver and destination coordinates assigned',
    ],
    cards: [
      { label: 'Attendance', tone: 'blue', value: 'Live' },
      { label: 'Fees', tone: 'amber', value: 'Bulk' },
      { label: 'Transport', tone: 'teal', value: 'Map' },
    ],
    status: 'Role-scoped system',
    workspace: 'Institute command desk',
  },
  logos: {
    eyebrow: 'Capability rail',
    items: [
      'Role access',
      'Bulk fees',
      'Payroll',
      'Route maps',
      'Parent desk',
      'Secure uploads',
      'AI reports',
      'Custom theme',
      'Max subdomain',
    ],
    note: 'Product areas shown here are platform capabilities, not fake customer logos or invented proof.',
  },
  features: [
    {
      bullets: ['Today, My Child, Fees, Help', 'Parent-link readiness checks', 'Office support path'],
      description:
        'Parent screens stay simple while admins get the tools to help families who are not comfortable with apps.',
      eyebrow: 'School-ready parent mode',
      id: 'school-ready',
      preview: {
        lead: 'Parent home',
        rows: ['Today', 'My Child', 'Fees', 'Help'],
        stat: '4 actions',
      },
      title: 'Parents get clarity, not a training manual.',
    },
    {
      bullets: ['Routines and attendance', 'Assignments and grades', 'Reports and learning files'],
      description:
        'Academic work is grouped by class, section, department, semester, teacher, and student visibility.',
      eyebrow: 'Academic spine',
      id: 'academics',
      preview: {
        lead: 'Classroom flow',
        rows: ['Roster', 'Marked attendance', 'Published progress'],
        stat: 'Role-aware',
      },
      title: 'Teaching records stay connected.',
    },
    {
      bullets: ['Whole institute allocation', 'Class, section, semester scopes', 'Offline payment marking'],
      description:
        'Finance teams can assign fees in groups, reconcile offline payments, and review dues without repeating the same form.',
      eyebrow: 'Finance workflow',
      id: 'finance',
      preview: {
        lead: 'Fee desk',
        rows: ['Class allocation', 'Receipt review', 'Parent ledger'],
        stat: 'Bulk first',
      },
      title: 'Fee work starts with cohorts.',
    },
    {
      bullets: ['Origin and destination coordinates', 'Driver assignment', 'Parent route visibility'],
      description:
        'Transport records use map points and readable route labels so drivers and parents see the same assignment.',
      eyebrow: 'Map transport',
      id: 'transport',
      preview: {
        lead: 'Route control',
        rows: ['Origin', 'Destination', 'Assigned driver'],
        stat: 'Map based',
      },
      title: 'Bus routing belongs on a map.',
    },
    {
      bullets: ['MCQ inputs', 'Voting prompts', 'Opinion collection'],
      description:
        'Announcements can ask for structured responses when teachers or admins need choices, votes, or short opinions.',
      eyebrow: 'Interactive notices',
      id: 'communication',
      preview: {
        lead: 'Response builder',
        rows: ['Choice prompt', 'Vote', 'Opinion'],
        stat: 'Input ready',
      },
      title: 'Broadcasts can collect answers.',
    },
    {
      bullets: ['Attendance risk reports', 'Fee follow-up exports', 'Audited daily AI limits'],
      description:
        'Max institutes get a bounded admin agent for approved reports and exports, not open-ended database access.',
      eyebrow: 'Max AI agent',
      id: 'max-ai-agent',
      preview: {
        lead: 'Admin agent',
        rows: ['Attendance below 75%', 'Unpaid fee review', 'Export file'],
        stat: 'Bounded',
      },
      title: 'AI works inside defined tools.',
    },
  ] satisfies FeatureTab[],
  pricing: {
    comparison: [
      {
        aspect: 'Core role apps',
        basic: 'Admin, teacher, student, parent',
        pro: 'Admin, teacher, student, parent, driver',
        max: 'All role apps plus platform controls',
      },
      {
        aspect: 'Attendance and routines',
        basic: 'Included',
        pro: 'Included with advanced review',
        max: 'Included with Max report tooling',
      },
      {
        aspect: 'Fees and offline marking',
        basic: 'Bulk assignment and manual reconciliation',
        pro: 'Bulk assignment, reports, priority controls',
        max: 'Bulk assignment, reports, exports, audit-heavy workflows',
      },
      {
        aspect: 'Parent support',
        basic: 'Standard parent access',
        pro: 'Support desk and readiness checks',
        max: 'Support desk with higher operating limits',
      },
      {
        aspect: 'Messages',
        basic: 'Not included',
        pro: 'Included',
        max: 'Included with higher rate limits',
      },
      {
        aspect: 'Transport',
        basic: 'Not included',
        pro: 'Map routes, driver assignment, parent route view',
        max: 'Transport plus higher limits and premium controls',
      },
      {
        aspect: 'Courses, media, and PYQ',
        basic: 'Not included',
        pro: 'Included',
        max: 'Included with advanced customization',
      },
      {
        aspect: 'AI tools',
        basic: 'Off',
        pro: 'Supported workflow tools',
        max: 'Workflow tools plus Max admin agent',
      },
      {
        aspect: 'AI usage ceiling',
        basic: '0 requests per day',
        pro: '150 requests per day',
        max: '1,500 requests per day',
      },
      {
        aspect: 'Custom subdomain',
        basic: 'Not included',
        pro: 'Not included',
        max: 'Request workflow included',
      },
      {
        aspect: 'Rate-limit tier',
        basic: 'Basic allowance',
        pro: 'Pro allowance',
        max: 'Max allowance',
      },
      {
        aspect: 'Best fit',
        basic: 'Smaller institutes launching core operations',
        pro: 'Institutes that need transport and richer workflows',
        max: 'Institutes that want premium control and AI reports',
      },
    ] satisfies PricingComparisonRow[],
    note: 'Yearly billing includes two months at no additional cost.',
    plans: [
      {
        description: 'Core institute operations for teams that need a clean daily system.',
        features: ['Admin, teacher, student, and parent portals', 'Attendance, routines, grades, notices', 'Bulk fee allocation and offline marking', 'Standard reports and secure uploads'],
        key: 'basic',
        monthly: 3000,
        title: 'Basic',
        yearly: 30000,
      },
      {
        badge: 'Recommended',
        description: 'Adds transport, AI tools, advanced reports, and stronger operating limits.',
        features: ['Everything in Basic', 'Map-based bus tracking and driver assignment', 'AI tools for supported workflows', 'Advanced reports and priority controls'],
        key: 'pro',
        monthly: 8000,
        title: 'Pro',
        yearly: 80000,
      },
      {
        description: 'Highest-control plan for institutes that want agent reports and premium configuration.',
        features: ['Everything in Pro', 'Max admin agent with daily usage limits', 'Custom subdomain request API', 'Advanced customization and higher rate limits'],
        key: 'max',
        monthly: 15000,
        title: 'Max',
        yearly: 150000,
      },
    ] satisfies PricingPlan[],
  },
  proofCards: [
    {
      body: 'Feature access is tied to institute settings and enforced from server routes where sensitive work happens.',
      icon: 'fingerprint',
      title: 'Subscription gates are not decorative',
    },
    {
      body: 'Fee allocation supports cohorts first, then individual corrections when a student needs a separate adjustment.',
      icon: 'receipt',
      title: 'Finance is built for real office work',
    },
    {
      body: 'Route assignment stores map points, labels, driver links, and safe parent visibility through institute-scoped records.',
      icon: 'route',
      title: 'Transport has a shared route record',
    },
    {
      body: 'The Max agent uses approved report tools, rate limits, audit logs, and export boundaries.',
      icon: 'spark',
      title: 'AI has guardrails',
    },
    {
      body: 'Parent mode is deliberately simple, with office support available when a family needs help using the system.',
      icon: 'users',
      title: 'Low-tech families are accounted for',
    },
    {
      body: 'Institute, Parents, and Driver apps can keep separate app identities, scopes, icons, and login surfaces.',
      icon: 'layers',
      title: 'Role apps stay separate',
    },
  ] satisfies ProofCard[],
  uiFeatureCards: [
    {
      demo: {
        primary: 'Generate attendance risk report',
        rows: [
          { label: 'Attendance below 75%', status: 'Ready', value: 'Export' },
          { label: 'Fee allocation', status: 'Bulk', value: 'Class 8' },
          { label: 'Parent links', status: 'Review', value: '6 accounts' },
        ],
        stats: [
          { label: 'operator groups', value: '4' },
          { label: 'export paths', value: '2' },
        ],
      },
      detail:
        'Admin work is arranged around decisions: assign fees in bulk, review payroll, approve reset requests, open route maps, and run bounded Max reports.',
      id: 'admin-control',
      kicker: 'Admin UI',
      steps: ['Open operator work by intent', 'Run the specific workflow', 'Export or publish with an audit trail'],
      summary: 'A calmer control room for fees, users, routes, payroll, notices, and Max reports.',
      title: 'Admin becomes an operations desk.',
      tone: 'blue',
    },
    {
      demo: {
        primary: 'Open today roster',
        rows: [
          { label: 'Period 2', status: 'Next', value: 'Class 9A' },
          { label: 'Attendance', status: 'Open', value: '42 students' },
          { label: 'Assignment', status: 'Draft', value: '1 pending' },
        ],
        stats: [
          { label: 'daily actions', value: '3' },
          { label: 'tap targets', value: 'Large' },
        ],
      },
      detail:
        'Teacher screens prioritize the routine, roster, attendance, assignments, and class messages so daily work stays fast.',
      id: 'teacher-flow',
      kicker: 'Teacher UI',
      steps: ['See the next class first', 'Mark attendance from the assigned roster', 'Publish class work without admin clutter'],
      summary: 'The teacher app should feel like a workbench, not a full admin console.',
      title: 'Teachers see the next class first.',
      tone: 'teal',
    },
    {
      demo: {
        primary: 'Ask the school office',
        rows: [
          { label: 'Today', status: 'Clear', value: 'No urgent update' },
          { label: 'My Child', status: 'Linked', value: 'Student ID' },
          { label: 'Fees', status: 'Simple', value: 'Due status' },
        ],
        stats: [
          { label: 'main choices', value: '4' },
          { label: 'jargon', value: 'Low' },
        ],
      },
      detail:
        'Parent and student views use plain labels, larger tap areas, and an office help path because many families need assisted rollout.',
      id: 'family-view',
      kicker: 'Parent and Student UI',
      steps: ['Start with Today', 'Check student details', 'Use Help when the family needs the office'],
      summary: 'Families should not need to understand school software vocabulary.',
      title: 'Families get a simple front door.',
      tone: 'violet',
    },
    {
      demo: {
        primary: 'Start route preview',
        rows: [
          { label: 'Vehicle', status: 'Assigned', value: 'Route B' },
          { label: 'Destination', status: 'Mapped', value: 'Nagaland' },
          { label: 'Live sharing', status: 'Fallback', value: 'Device preview' },
        ],
        stats: [
          { label: 'primary controls', value: '2' },
          { label: 'map mode', value: 'English' },
        ],
      },
      detail:
        'The driver app remains useful even if realtime GPS is unavailable: vehicle, route, destination, and a map-first fallback stay visible.',
      id: 'driver-console',
      kicker: 'Driver UI',
      steps: ['Confirm vehicle and route', 'Preview the map', 'Start live sharing or device preview'],
      summary: 'Drivers need a large, readable route surface with minimal decisions.',
      title: 'Drivers get the map, then the controls.',
      tone: 'amber',
    },
  ] satisfies UiFeatureCard[],
  editorial: {
    body:
      'A useful institute platform does not flatten every person into the same dashboard. It gives each role the shortest responsible path to the work they need to finish.',
    cards: [
      {
        body: 'Admins need fees, users, routes, payroll, reports, and support requests grouped by the decision they are making.',
        title: 'Operators need command, not clutter.',
      },
      {
        body: 'Teachers need a fast path to the next class, not every module the institute owns.',
        title: 'Staff need speed.',
      },
      {
        body: 'Parents need plain labels, visible help, and a school office fallback.',
        title: 'Families need confidence.',
      },
      {
        body: 'Max AI should prepare reports and exports inside strict limits, not behave like an unrestricted database chat.',
        title: 'AI needs boundaries.',
      },
    ],
    eyebrow: 'Product philosophy',
    title: 'Different roles deserve different software.',
  },
  resources: [
    {
      category: 'Pricing',
      cta: 'Compare plans',
      href: '#pricing',
      summary: 'Basic, Pro, and Max pricing with yearly billing logic.',
      title: 'Choose the right subscription tier',
    },
    {
      category: 'Operations',
      cta: 'See parent mode',
      href: '#inside-app',
      summary: 'A simple parent app plus admin support for families who need help.',
      title: 'Launch parent access without overwhelming families',
    },
    {
      category: 'Finance',
      cta: 'Review finance flow',
      href: '#features',
      summary: 'Bulk fee allocation by institute, class, section, semester, or individual exception.',
      title: 'Make fee work practical for the office',
    },
    {
      category: 'Transport',
      cta: 'View route workflow',
      href: '#inside-app',
      summary: 'Map-based route records for admins, drivers, and parents.',
      title: 'Coordinate routes before realtime tracking',
    },
    {
      category: 'Security',
      cta: 'Read policy',
      href: '/privacy',
      summary: 'How role access, uploads, payments, and institute boundaries are handled.',
      title: 'Review data boundaries',
    },
    {
      category: 'Legal',
      cta: 'Read terms',
      href: '/terms',
      summary: 'Terms for app access, uploads, payments, AI use, and platform responsibilities.',
      title: 'Understand platform terms',
    },
  ] satisfies ResourceCard[],
  footer: {
    columns: [
      {
        links: [
          { href: '#platform', label: 'Platform' },
          { href: '#features', label: 'Features' },
          { href: '#inside-app', label: 'Inside app' },
          { href: '#pricing', label: 'Pricing' },
        ],
        title: 'Product',
      },
      {
        links: [
          { href: '/auth/institute', label: 'Institute login' },
          { href: '/auth/parents', label: 'Parents login' },
          { href: '/auth/driver', label: 'Driver login' },
          { href: '/roles', label: 'Choose role' },
        ],
        title: 'Access',
      },
      {
        links: [
          { href: contactMailto, label: 'Contact registration' },
          { href: '#enterprise-proof', label: 'Security model' },
          { href: '#resources', label: 'Resources' },
          { href: '/', label: 'Home' },
        ],
        title: 'Company',
      },
      {
        links: [
          { href: '/privacy', label: 'Privacy' },
          { href: '/terms', label: 'Terms' },
          { href: '/sitemap.xml', label: 'Sitemap' },
          { href: '/robots.txt', label: 'Robots' },
        ],
        title: 'Legal',
      },
    ],
  },
};

export const landingJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  applicationCategory: 'EducationalApplication',
  description:
    'Shii-Edu is an institute operations platform for academics, fees, parent support, communication, transport, AI-assisted reports, and role-aware administration.',
  name: 'Shii-Edu',
  offers: [
    {
      '@type': 'Offer',
      name: 'Basic',
      price: '3000',
      priceCurrency: 'INR',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '8000',
      priceCurrency: 'INR',
    },
    {
      '@type': 'Offer',
      name: 'Max',
      price: '15000',
      priceCurrency: 'INR',
    },
  ],
  operatingSystem: 'Web, Android, iOS',
  url: 'https://shii-edu.vercel.app',
};
