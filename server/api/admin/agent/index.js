const { z } = require('zod');
const {
  admin,
  authenticateUserProfile,
  createRequestId,
  getAdminServices,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../../_lib/firebaseAdmin');
const { assertRateLimit } = require('../../_lib/rateLimit');
const { assertAiDailyUsage } = require('../../_lib/subscriptionEntitlements');

const MAX_STUDENTS = 650;
const MAX_ATTENDANCE_RECORDS = 3200;
const MAX_INVOICES = 3200;
const MAX_EXPORT_ROWS = 350;

const RequestSchema = z.object({
  exportFormat: z.enum(['none', 'excel', 'pdf', 'both']).optional().default('both'),
  instituteId: z.string().trim().min(1).max(160).optional(),
  prompt: z.string().trim().min(3).max(600),
  threshold: z.coerce.number().min(1).max(100).optional(),
}).strict();

const normalize = (value) => String(value || '').trim();
const normalizeLower = (value) => normalize(value).toLowerCase();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const getStudentId = (student) => (
  student.loginId ||
  student.uniqueId ||
  student.studentId ||
  student.id ||
  ''
);

const getStudentGroup = (student) => (
  [student.class || student.standard || student.dept || student.department, student.section || student.sem || student.semester]
    .filter(Boolean)
    .join(' - ') || 'Not assigned'
);

const extractThreshold = (prompt, explicitThreshold) => {
  if (explicitThreshold) return explicitThreshold;
  const match = prompt.match(/(\d{1,3})\s*%?/);
  const parsed = match ? Number(match[1]) : 75;
  return Math.max(1, Math.min(100, Number.isFinite(parsed) ? parsed : 75));
};

const detectTool = (prompt) => {
  const text = normalizeLower(prompt);
  const asksAttendance = /attendance|absent|present|below\s*\d|under\s*\d|less\s+than/.test(text);
  const asksFees = /fee|fees|dues|due|unpaid|pending|balance/.test(text);

  if (asksAttendance) return 'attendance_below_threshold';
  if (asksFees) return 'fee_dues';
  return 'unsupported';
};

const base64Text = (value) => Buffer.from(value, 'utf8').toString('base64');

const rowsToCsv = (headers, rows) => [
  headers.join(','),
  ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
].join('\n');

const escapePdfText = (value) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')
  .replace(/[^\x20-\x7E]/g, ' ');

const truncate = (value, length = 96) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
};

const createPdfBuffer = ({ lines, title }) => {
  const pageLines = [];
  const safeLines = [title, `Generated: ${new Date().toISOString()}`, '', ...lines]
    .map((line) => truncate(line, 104));
  for (let index = 0; index < safeLines.length; index += 42) {
    pageLines.push(safeLines.slice(index, index + 42));
  }

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogRef = addObject('<< /Type /Catalog /Pages 2 0 R >>');
  void catalogRef;
  addObject('__PAGES__');
  const fontRef = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const pageRefs = [];
  pageLines.forEach((page, pageIndex) => {
    const contentLines = [
      'BT',
      '/F1 11 Tf',
      '40 800 Td',
      '14 TL',
      ...page.map((line, lineIndex) => `${lineIndex === 0 ? '' : 'T* '}(${escapePdfText(line)}) Tj`),
      'ET',
    ].join('\n');
    const contentRef = addObject(`<< /Length ${Buffer.byteLength(contentLines, 'utf8')} >>\nstream\n${contentLines}\nendstream`);
    const pageRef = addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRef} 0 R >> >> /Contents ${contentRef} 0 R /StructParents ${pageIndex} >>`);
    pageRefs.push(pageRef);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
};

const buildFiles = ({ exportFormat, headers, pdfLines, reportName, rows }) => {
  const files = {};
  const safeRows = rows.slice(0, MAX_EXPORT_ROWS);

  if (exportFormat === 'excel' || exportFormat === 'both') {
    const csv = rowsToCsv(headers, safeRows);
    files.excel = {
      contentBase64: base64Text(csv),
      fileName: `${reportName}.csv`,
      mimeType: 'text/csv;charset=utf-8',
    };
  }

  if (exportFormat === 'pdf' || exportFormat === 'both') {
    const pdf = createPdfBuffer({
      lines: pdfLines.slice(0, MAX_EXPORT_ROWS + 12),
      title: reportName.replace(/-/g, ' '),
    });
    files.pdf = {
      contentBase64: pdf.toString('base64'),
      fileName: `${reportName}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  return files;
};

const loadStudents = async ({ firestore, instituteId }) => {
  const snapshot = await firestore
    .collection('users')
    .where('instituteId', '==', instituteId)
    .where('role', '==', 'student')
    .limit(MAX_STUDENTS)
    .get();

  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
};

const runAttendanceReport = async ({ body, firestore, instituteId }) => {
  const threshold = extractThreshold(body.prompt, body.threshold);
  const students = await loadStudents({ firestore, instituteId });
  const studentByKey = new Map();

  students.forEach((student) => {
    [student.id, student.loginId, student.uniqueId, student.studentId]
      .filter(Boolean)
      .forEach((key) => studentByKey.set(normalizeLower(key), student));
  });

  const statsByStudent = new Map(students.map((student) => [student.id, { present: 0, total: 0 }]));
  const attendanceSnapshot = await firestore
    .collection('attendance')
    .where('instituteId', '==', instituteId)
    .limit(MAX_ATTENDANCE_RECORDS)
    .get();

  attendanceSnapshot.docs.forEach((document) => {
    const record = document.data() || {};
    const keys = [record.studentUid, record.studentDocId, record.studentId, record.studentUniqueId].filter(Boolean);
    const student = keys.map((key) => studentByKey.get(normalizeLower(key))).find(Boolean);
    if (!student) return;

    const stats = statsByStudent.get(student.id) || { present: 0, total: 0 };
    stats.total += 1;
    if (record.isPresent === true || ['present', 'late'].includes(normalizeLower(record.status))) {
      stats.present += 1;
    }
    statsByStudent.set(student.id, stats);
  });

  const rows = students
    .map((student) => {
      const stats = statsByStudent.get(student.id) || { present: 0, total: 0 };
      const storedPercent = toNumber(student.attendancePercent ?? student.attendancePercentage, NaN);
      const percent = stats.total > 0
        ? Math.round((stats.present / stats.total) * 100)
        : Number.isFinite(storedPercent)
          ? Math.round(storedPercent)
          : null;
      return {
        attendancePercent: percent === null ? '' : percent,
        classOrGroup: getStudentGroup(student),
        markedClasses: stats.total,
        parentContact: student.parentPhone || student.guardianPhone || '',
        presentClasses: stats.present,
        studentId: getStudentId(student),
        studentName: student.name || 'Unnamed student',
      };
    })
    .filter((row) => row.attendancePercent !== '' && Number(row.attendancePercent) < threshold)
    .sort((left, right) => Number(left.attendancePercent) - Number(right.attendancePercent));

  const pdfLines = [
    `Institute: ${instituteId}`,
    `Report: Students with attendance below ${threshold}%`,
    `Students scanned: ${students.length}`,
    `Attendance records scanned: ${attendanceSnapshot.size}`,
    `Matches: ${rows.length}`,
    '',
    ...rows.map((row) => `${row.studentName} (${row.studentId}) - ${row.attendancePercent}% - ${row.classOrGroup}`),
  ];

  return {
    files: buildFiles({
      exportFormat: body.exportFormat,
      headers: ['studentName', 'studentId', 'classOrGroup', 'attendancePercent', 'presentClasses', 'markedClasses', 'parentContact'],
      pdfLines,
      reportName: `shii-edu-attendance-under-${threshold}`,
      rows,
    }),
    rows,
    summary: rows.length === 0
      ? `No students were found below ${threshold}% attendance in the scanned records.`
      : `Found ${rows.length} student${rows.length === 1 ? '' : 's'} below ${threshold}% attendance.`,
    threshold,
    tool: 'attendance_below_threshold',
  };
};

const runFeeDuesReport = async ({ body, firestore, instituteId }) => {
  const students = await loadStudents({ firestore, instituteId });
  const studentsByUid = new Map(students.map((student) => [student.id, student]));
  const dueByStudent = new Map();
  const invoiceSnapshot = await firestore
    .collection('feeInvoices')
    .where('instituteId', '==', instituteId)
    .limit(MAX_INVOICES)
    .get();

  invoiceSnapshot.docs.forEach((document) => {
    const invoice = document.data() || {};
    const studentUid = invoice.studentUid;
    if (!studentUid) return;
    const balance = toNumber(invoice.balanceAmount, toNumber(invoice.balanceAmountMinor, 0) / 100);
    if (balance <= 0 || normalizeLower(invoice.status) === 'paid') return;
    const current = dueByStudent.get(studentUid) || { invoiceCount: 0, pendingAmount: 0 };
    current.invoiceCount += 1;
    current.pendingAmount += balance;
    dueByStudent.set(studentUid, current);
  });

  students.forEach((student) => {
    if (dueByStudent.has(student.id)) return;
    const pending = Math.max(0, toNumber(student.totalFee) - toNumber(student.feePaid));
    if (pending > 0) {
      dueByStudent.set(student.id, { invoiceCount: 0, pendingAmount: pending });
    }
  });

  const rows = Array.from(dueByStudent.entries())
    .map(([studentUid, due]) => {
      const student = studentsByUid.get(studentUid) || {};
      return {
        classOrGroup: getStudentGroup(student),
        invoiceCount: due.invoiceCount,
        parentContact: student.parentPhone || student.guardianPhone || '',
        pendingAmount: Math.round(due.pendingAmount * 100) / 100,
        studentId: getStudentId(student) || studentUid,
        studentName: student.name || 'Unnamed student',
      };
    })
    .sort((left, right) => Number(right.pendingAmount) - Number(left.pendingAmount));

  const totalPending = rows.reduce((sum, row) => sum + Number(row.pendingAmount || 0), 0);
  const pdfLines = [
    `Institute: ${instituteId}`,
    'Report: Students with pending fee dues',
    `Students scanned: ${students.length}`,
    `Invoices scanned: ${invoiceSnapshot.size}`,
    `Matches: ${rows.length}`,
    `Total pending: Rs. ${totalPending.toLocaleString()}`,
    '',
    ...rows.map((row) => `${row.studentName} (${row.studentId}) - Rs. ${Number(row.pendingAmount).toLocaleString()} - ${row.classOrGroup}`),
  ];

  return {
    files: buildFiles({
      exportFormat: body.exportFormat,
      headers: ['studentName', 'studentId', 'classOrGroup', 'pendingAmount', 'invoiceCount', 'parentContact'],
      pdfLines,
      reportName: 'shii-edu-fee-dues',
      rows,
    }),
    rows,
    summary: rows.length === 0
      ? 'No pending fee dues were found in the scanned records.'
      : `Found ${rows.length} student${rows.length === 1 ? '' : 's'} with pending dues totaling Rs. ${totalPending.toLocaleString()}.`,
    tool: 'fee_dues',
  };
};

const writeAuditLog = async ({ actor, firestore, instituteId, prompt, result }) => {
  try {
    await firestore.collection('agentAuditLogs').add({
      actorRole: actor.role,
      actorUid: actor.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      instituteId,
      prompt: prompt.slice(0, 600),
      rowCount: Array.isArray(result.rows) ? result.rows.length : 0,
      tool: result.tool,
    });
  } catch (error) {
    console.warn('Admin agent audit log failed:', error?.message || error);
  }
};

module.exports = async function handler(req, res) {
  const requestId = createRequestId();
  setCorsHeaders(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  try {
    const actor = await authenticateUserProfile(req, ['admin', 'superadmin']);
    await assertRateLimit({ actor, req, scope: 'admin:ai-agent', limit: 8, windowMs: 60 * 1000 });
    const parsed = RequestSchema.safeParse(await getBody(req));
    if (!parsed.success) {
      const error = new Error(parsed.error.issues[0]?.message || 'The agent request was not valid.');
      error.statusCode = 400;
      throw error;
    }

    const body = parsed.data;
    const instituteId = actor.role === 'superadmin'
      ? normalize(body.instituteId || actor.profile?.instituteId)
      : normalize(actor.profile?.instituteId);
    if (!instituteId) {
      const error = new Error('Choose an institute before running the admin agent.');
      error.statusCode = 400;
      throw error;
    }

    const { firestore } = getAdminServices();
    await assertAiDailyUsage({
      actor,
      firestore,
      instituteId,
      featureKey: 'ai_agent',
      requestCount: 1,
    });

    const tool = detectTool(body.prompt);
    let result;
    if (tool === 'attendance_below_threshold') {
      result = await runAttendanceReport({ body, firestore, instituteId });
    } else if (tool === 'fee_dues') {
      result = await runFeeDuesReport({ body, firestore, instituteId });
    } else {
      result = {
        files: {},
        rows: [],
        skills: [
          'attendance below a percentage threshold',
          'pending fee dues',
        ],
        summary: 'I can run bounded attendance and fee reports right now. Try: "Fetch students with attendance less than 75%".',
        tool: 'unsupported',
      };
    }

    await writeAuditLog({ actor, firestore, instituteId, prompt: body.prompt, result });

    res.status(200).json({
      success: true,
      agent: {
        ...result,
        costMode: 'bounded-firestore-read-no-open-ended-llm',
        exportLimit: MAX_EXPORT_ROWS,
        instituteId,
        requestId,
      },
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'The admin agent could not finish this report. Please try again.', requestId);
  }
};
