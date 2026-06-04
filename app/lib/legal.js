import { SITE, absoluteUrl } from './site';

export const legalUpdatedAt = SITE.updatedAt;

export const privacySections = [
  {
    id: 'scope',
    title: 'Scope and Controller Roles',
    body: [
      'This Privacy Policy explains how Edu-shii processes information for schools, colleges, administrators, teachers, students, parents, drivers, and platform operators.',
      'Institutes remain responsible for the accuracy, lawful basis, and administrative use of the education records they create. Edu-shii acts as a technology platform and processor for institute-managed data unless a separate written agreement states otherwise.',
    ],
  },
  {
    id: 'data-collected',
    title: 'Information Processed',
    body: [
      'Edu-shii may process account identifiers, institute IDs, role assignments, attendance records, grades, routines, notices, assignments, fee records, uploaded documents, profile pictures, institute logos, transport route information, support metadata, and security logs.',
      'The platform keeps institute workspaces isolated so records are associated with an institute ID and role-based access rules. Users should not upload unnecessary sensitive personal information into free-text fields or document uploads.',
    ],
  },
  {
    id: 'children',
    title: 'Students, Minors, and Guardian Alignment',
    body: [
      'Edu-shii is intended for institute-supervised education workflows. Student access is provisioned by institutes or authorized guardians, and the platform is not intended for unsupervised direct collection from children.',
      'Where child or minor data is processed, the institute is responsible for obtaining required parental, guardian, school-board, or statutory authorization. Edu-shii supports COPPA-aligned minimization principles and restricts commercial behavioral advertising within student workflows.',
    ],
  },
  {
    id: 'dpdp',
    title: 'India DPDP Act Alignment',
    body: [
      'Edu-shii is designed to support India Digital Personal Data Protection Act principles including purpose limitation, data minimization, reasonable security safeguards, access control, correction workflows, and deletion assistance where legally permitted.',
      'Institutes must use the platform only for lawful education administration purposes and must respond to student, parent, staff, or data principal requests according to their statutory obligations.',
    ],
  },
  {
    id: 'payments',
    title: 'Zero-Retention Financial Processing',
    body: [
      'Edu-shii does not intentionally store raw card numbers, UPI credentials, CVV values, banking passwords, or payment authentication secrets on Edu-shii application servers.',
      'Payment processing is delegated to third-party payment processors such as Stripe or other configured gateways. Edu-shii may store non-sensitive transaction metadata such as invoice ID, payment status, amount, currency, gateway reference, and timestamps for reconciliation and audit trails.',
    ],
  },
  {
    id: 'security',
    title: 'Security and Institute Isolation',
    body: [
      'Edu-shii uses authentication, institute IDs, role-based authorization, PostgreSQL Row-Level Security policies, API authorization checks, signed uploads, and environment-secret separation to reduce unauthorized access risk.',
      'No internet-connected system can be guaranteed perfectly secure. Institutes and users must protect credentials, rotate compromised passwords, and promptly report suspected unauthorized access.',
    ],
  },
  {
    id: 'third-parties',
    title: 'Third-Party Processors',
    body: [
      'Edu-shii may use infrastructure and service providers including hosting, database, authentication, storage, analytics, notification, payment, AI, and communication providers.',
      'Third-party services operate under their own security and privacy terms. Edu-shii is not responsible for independent third-party acts outside the platform operator direct control, except where applicable law provides otherwise.',
    ],
  },
  {
    id: 'liability',
    title: 'Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, Edu-shii and its platform operator are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from institute administrative decisions, transport operations, third-party processors, network failures, user credential compromise, or inaccurate data entered by institute personnel.',
      'Nothing in this policy excludes liability that cannot legally be excluded. Claims must be directed to the contracting platform entity or service operator rather than any founder, employee, developer, or representative in a personal capacity where permitted by law.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    body: [
      'Privacy and security requests should be sent through the official Edu-shii support or administrator contact channel provided to the institute.',
      'For urgent suspected security incidents, institute administrators should immediately revoke affected credentials and contact platform support with the institute ID, affected user IDs, and incident timeline.',
    ],
  },
];

export const termsSections = [
  {
    id: 'acceptance',
    title: 'Acceptance of Terms',
    body: [
      'By accessing Edu-shii, users agree to these Terms of Service and any institute-specific policies that apply to their account.',
      'If a user accesses Edu-shii on behalf of a school, college, trust, organization, or administrative body, that user confirms they are authorized to bind that organization to these terms.',
    ],
  },
  {
    id: 'institute-access',
    title: 'Institute Workspace Access',
    body: [
      'Edu-shii provides institute-managed education workspaces. Users must sign in only with the institute ID and user ID assigned to them by an authorized administrator.',
      'Attempting to access another institute workspace, bypass role restrictions, enumerate user IDs, or manipulate institute IDs is prohibited and may result in account suspension, data access revocation, and legal action.',
    ],
  },
  {
    id: 'responsibilities',
    title: 'Institute and User Responsibilities',
    body: [
      'Institutes are responsible for the legality, accuracy, timeliness, and authorization of records entered into Edu-shii, including student data, teacher assignments, attendance, grades, fee records, notices, transport details, and uploaded media.',
      'Users must keep credentials confidential, use the platform only for lawful education operations, and immediately report suspected account compromise or inaccurate records to their institute administrator.',
    ],
  },
  {
    id: 'payments',
    title: 'Payments and Financial Records',
    body: [
      'Edu-shii may display fee balances, invoices, payment statuses, gateway references, and reconciliation metadata. Raw card numbers, CVV values, UPI authentication credentials, or banking passwords must never be entered into Edu-shii text fields.',
      'Payment gateways, banks, and processors are independent third parties. Edu-shii is not responsible for payment processor outages, bank delays, card issuer decisions, UPI network failures, chargebacks, refund timing, or third-party compliance failures except where applicable law requires otherwise.',
    ],
  },
  {
    id: 'uploads',
    title: 'Uploads and Content',
    body: [
      'Users may upload profile images, institute logos, gallery assets, documents, question papers, assignments, and education media only when they have the rights and authorization to do so.',
      'Users must not upload malware, illegal content, infringing works, abusive material, sensitive data unrelated to institute operations, or files designed to evade security controls.',
    ],
  },
  {
    id: 'ai',
    title: 'AI Assistance',
    body: [
      'AI features may assist with routine generation, reports, tutoring, summarization, import mapping, or administrative recommendations. AI output is advisory and must be reviewed by qualified institute staff before operational use.',
      'Edu-shii is not liable for decisions made solely from AI suggestions, including timetable conflicts, academic recommendations, notices, reports, or substitute assignments.',
    ],
  },
  {
    id: 'transport',
    title: 'Transport and Location Features',
    body: [
      'Transport, bus route, and location features are operational aids and do not replace human supervision, transport safety obligations, driver judgment, or institute transport policies.',
      'Edu-shii is not liable for third-party map inaccuracies, network loss, GPS drift, driver device failure, route changes, traffic incidents, or administrative transport errors except where liability cannot legally be excluded.',
    ],
  },
  {
    id: 'indemnity',
    title: 'Indemnity',
    body: [
      'Institutes and users agree to defend, indemnify, and hold harmless Edu-shii, its platform operator, founder, developers, employees, contractors, and representatives from claims arising from unauthorized use, unlawful uploads, inaccurate records, third-party disputes, credential misuse, or violation of these terms.',
      'This indemnity applies to the maximum extent permitted by law and does not limit rights that cannot legally be waived.',
    ],
  },
  {
    id: 'liability',
    title: 'Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, Edu-shii and its platform operator are not liable for indirect, incidental, consequential, special, exemplary, punitive, loss-of-profit, loss-of-data, interruption, administrative, academic, transport, or third-party processor damages.',
      'Claims must be brought against the contracting platform entity or official service operator, not against a founder, developer, employee, contractor, or representative personally, where such limitation is permitted by applicable law.',
    ],
  },
  {
    id: 'governing-law',
    title: 'Governing Law and Compliance',
    body: [
      'These terms are intended to operate consistently with applicable Indian law, including the Digital Personal Data Protection Act where relevant, and with education-sector obligations imposed on institutes.',
      'If a provision is unenforceable, the remaining provisions remain effective to the maximum extent permitted by law.',
    ],
  },
];

export function legalJsonLd({ description, path, title, type }) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    dateModified: legalUpdatedAt,
    description,
    inLanguage: 'en',
    name: `${SITE.name} ${title}`,
    url: absoluteUrl(path),
  };
}
