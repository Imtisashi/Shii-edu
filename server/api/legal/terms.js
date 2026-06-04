const {
  SITE_NAME,
  UPDATED_AT,
  renderDocument,
  resolveOrigin,
  sendHtml,
} = require('./_render');

module.exports = async function termsOfService(req, res) {
  const origin = resolveOrigin(req);
  const title = 'Terms of Service';
  const description = 'Shii-Edu Terms of Service for institute-managed education administration, payments, uploads, AI assistance, transport workflows, and workspace access.';

  const sections = [
    {
      id: 'acceptance',
      title: 'Acceptance of Terms',
      body: [
        'By accessing Shii-Edu, users agree to these Terms of Service and any institute-specific policies that apply to their account.',
        'If a user accesses Shii-Edu on behalf of a school, college, trust, organization, or administrative body, that user confirms they are authorized to bind that organization to these terms.',
      ],
    },
    {
      id: 'institute-access',
      title: 'Institute Workspace Access',
      body: [
        'Shii-Edu provides institute-managed education workspaces. Users must sign in only with the institute ID and user ID assigned to them by an authorized administrator.',
        'Attempting to access another institute workspace, bypass role restrictions, enumerate user IDs, or manipulate institute IDs is prohibited and may result in account suspension, data access revocation, and legal action.',
      ],
    },
    {
      id: 'responsibilities',
      title: 'Institute and User Responsibilities',
      body: [
        'Institutes are responsible for the legality, accuracy, timeliness, and authorization of records entered into Shii-Edu, including student data, teacher assignments, attendance, grades, fee records, notices, transport details, and uploaded media.',
        'Users must keep credentials confidential, use the platform only for lawful education operations, and immediately report suspected account compromise or inaccurate records to their institute administrator.',
      ],
    },
    {
      id: 'payments',
      title: 'Payments and Financial Records',
      body: [
        'Shii-Edu may display fee balances, invoices, payment statuses, gateway references, and reconciliation metadata. Raw card numbers, CVV values, UPI authentication credentials, or banking passwords must never be entered into Shii-Edu text fields.',
        'Payment gateways, banks, and processors are independent third parties. Shii-Edu is not responsible for payment processor outages, bank delays, card issuer decisions, UPI network failures, chargebacks, refund timing, or third-party compliance failures except where applicable law requires otherwise.',
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
        'Shii-Edu is not liable for decisions made solely from AI suggestions, including timetable conflicts, academic recommendations, notices, reports, or substitute assignments.',
      ],
    },
    {
      id: 'transport',
      title: 'Transport and Location Features',
      body: [
        'Transport, bus route, and location features are operational aids and do not replace human supervision, transport safety obligations, driver judgment, or institute transport policies.',
        'Shii-Edu is not liable for third-party map inaccuracies, network loss, GPS drift, driver device failure, route changes, traffic incidents, or administrative transport errors except where liability cannot legally be excluded.',
      ],
    },
    {
      id: 'availability',
      title: 'Availability and Changes',
      body: [
        'Shii-Edu may change, suspend, or discontinue features to improve security, performance, compliance, or reliability.',
        'The platform may experience downtime due to maintenance, hosting providers, database providers, payment processors, cloud storage providers, device limitations, network failures, or events beyond reasonable control.',
      ],
    },
    {
      id: 'indemnity',
      title: 'Indemnity',
      body: [
        'Institutes and users agree to defend, indemnify, and hold harmless Shii-Edu, its platform operator, founder, developers, employees, contractors, and representatives from claims arising from unauthorized use, unlawful uploads, inaccurate records, third-party disputes, credential misuse, or violation of these terms.',
        'This indemnity applies to the maximum extent permitted by law and does not limit rights that cannot legally be waived.',
      ],
    },
    {
      id: 'liability',
      title: 'Limitation of Liability',
      body: [
        'To the maximum extent permitted by law, Shii-Edu and its platform operator are not liable for indirect, incidental, consequential, special, exemplary, punitive, loss-of-profit, loss-of-data, interruption, administrative, academic, transport, or third-party processor damages.',
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TermsOfService',
    dateModified: UPDATED_AT,
    description,
    inLanguage: 'en',
    name: `${SITE_NAME} Terms of Service`,
    url: `${origin}/terms`,
  };

  sendHtml(res, renderDocument({
    description,
    jsonLd,
    origin,
    path: '/terms',
    sections,
    title,
  }));
};
