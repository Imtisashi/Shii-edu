const {
  SITE_NAME,
  UPDATED_AT,
  renderDocument,
  resolveOrigin,
  sendHtml,
} = require('./_render');

module.exports = async function privacyPolicy(req, res) {
  const origin = resolveOrigin(req);
  const title = 'Privacy Policy';
  const description = 'Privacy commitments for Edu-shii covering student records, institute data, payments, media, transport data, and India DPDP Act aligned processing.';

  const sections = [
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
      id: 'media',
      title: 'Media, Documents, and Storage',
      body: [
        'Profile pictures, institute logos, gallery media, previous-year question papers, assignments, and documents may be stored in configured cloud storage providers such as Supabase Storage or Cloudinary depending on the upload pipeline in use.',
        'Uploaded files are associated with institute boundaries and access policies where supported. Users must not upload unlawful, infringing, malicious, or unrelated files.',
      ],
    },
    {
      id: 'security',
      title: 'Security and Institute Isolation',
      body: [
        'Edu-shii uses authentication, institute IDs, role-based authorization, Row-Level Security policies, API authorization checks, signed uploads, and environment-secret separation to reduce unauthorized access risk.',
        'No internet-connected system can be guaranteed perfectly secure. Institutes and users must protect credentials, rotate compromised passwords, and promptly report suspected unauthorized access.',
      ],
    },
    {
      id: 'retention',
      title: 'Retention and Deletion',
      body: [
        'Records are retained for as long as required for institute operations, legal compliance, dispute resolution, security auditing, backup integrity, or contractual obligations.',
        'Institutes may request deletion or export assistance subject to identity verification, legal retention requirements, backup windows, and third-party processor constraints.',
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PrivacyPolicy',
    dateModified: UPDATED_AT,
    description,
    inLanguage: 'en',
    name: `${SITE_NAME} Privacy Policy`,
    url: `${origin}/privacy`,
  };

  sendHtml(res, renderDocument({
    description,
    jsonLd,
    origin,
    path: '/privacy',
    sections,
    title,
  }));
};
