import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type ReportBrand = {
  accentColor?: string | null;
  logoUrl?: string | null;
  name?: string | null;
  primaryColor?: string | null;
};

type StudentRecord = {
  class?: string | null;
  dept?: string | null;
  loginId?: string | null;
  name?: string | null;
  section?: string | null;
  sem?: string | null;
  uniqueId?: string | null;
};

type GradeRecord = {
  examType?: string | null;
  marks?: number | string | null;
  maxScore?: number | string | null;
  obtainedMarks?: number | string | null;
  percentage?: number | string | null;
  score?: number | string | null;
  subject?: string | null;
  totalMarks?: number | string | null;
};

type AttendanceRecord = {
  date?: string | null;
  status?: string | null;
};

type RosterRow = StudentRecord & {
  uid?: string | null;
};

type StudentReportCardInput = {
  attendance: AttendanceRecord[];
  brand: ReportBrand;
  grades: GradeRecord[];
  institutionType: 'COLLEGE' | 'SCHOOL';
  student: StudentRecord;
};

type ClassRosterInput = {
  brand: ReportBrand;
  institutionType: 'COLLEGE' | 'SCHOOL';
  scopeLabel: string;
  students: RosterRow[];
};

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const asNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const reportId = (student: StudentRecord): string => (
  student.loginId || student.uniqueId || 'ID pending'
);

const placementLabel = (
  student: StudentRecord,
  institutionType: 'COLLEGE' | 'SCHOOL'
): string => (
  institutionType === 'SCHOOL'
    ? `Class ${student.class || 'Unassigned'} - Section ${student.section || 'Unassigned'}`
    : `${student.dept || 'Department unassigned'} - Semester ${student.sem || 'Unassigned'}`
);

const buildDocument = ({
  brand,
  body,
  title,
}: {
  body: string;
  brand: ReportBrand;
  title: string;
}): string => {
  const primary = brand.primaryColor || '#1D4ED8';
  const accent = brand.accentColor || '#0EA5E9';
  const instituteName = escapeHtml(brand.name || 'Edu-Hub Institute');
  const logo = brand.logoUrl
    ? `<img class="logo" src="${escapeHtml(brand.logoUrl)}" alt="${instituteName} logo" />`
    : `<div class="logo-fallback">${escapeHtml((brand.name || 'EH').slice(0, 2).toUpperCase())}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 24px; size: A4; }
      * { box-sizing: border-box; }
      body {
        color: #0F172A;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        font-size: 12px;
        margin: 0;
      }
      .header {
        align-items: center;
        border-bottom: 3px solid ${primary};
        display: flex;
        gap: 14px;
        padding-bottom: 14px;
      }
      .logo, .logo-fallback {
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        height: 58px;
        object-fit: cover;
        width: 58px;
      }
      .logo-fallback {
        align-items: center;
        background: ${primary}18;
        color: ${primary};
        display: flex;
        font-size: 18px;
        font-weight: 900;
        justify-content: center;
      }
      .header-copy { flex: 1; }
      .institute { font-size: 20px; font-weight: 900; margin: 0; }
      .document-title { color: ${primary}; font-size: 12px; font-weight: 800; margin-top: 4px; text-transform: uppercase; }
      .meta-card {
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin: 18px 0;
        padding: 14px;
      }
      .meta-label { color: #64748B; display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; }
      .meta-value { color: #0F172A; display: block; font-size: 13px; font-weight: 800; margin-top: 3px; }
      .section-title { color: ${primary}; font-size: 14px; font-weight: 900; margin: 18px 0 8px; }
      table { border-collapse: collapse; width: 100%; }
      th {
        background: ${primary};
        color: #FFFFFF;
        font-size: 10px;
        font-weight: 900;
        padding: 9px 8px;
        text-align: left;
        text-transform: uppercase;
      }
      td { border-bottom: 1px solid #E2E8F0; padding: 9px 8px; vertical-align: top; }
      tr:nth-child(even) td { background: #F8FAFC; }
      .summary-grid { display: grid; gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 12px; }
      .summary-card { border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; }
      .summary-value { color: ${accent}; font-size: 18px; font-weight: 900; margin-top: 4px; }
      .footer { color: #64748B; font-size: 10px; margin-top: 26px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="header">
      ${logo}
      <div class="header-copy">
        <h1 class="institute">${instituteName}</h1>
        <div class="document-title">${escapeHtml(title)}</div>
      </div>
    </div>
    ${body}
    <div class="footer">Generated securely by Edu-Hub on ${escapeHtml(new Date().toLocaleString())}</div>
  </body>
</html>`;
};

export const buildStudentReportCardHtml = ({
  attendance,
  brand,
  grades,
  institutionType,
  student,
}: StudentReportCardInput): string => {
  const present = attendance.filter((record) => String(record.status || '').toLowerCase() === 'present').length;
  const attendancePercentage = attendance.length === 0 ? 0 : Math.round((present / attendance.length) * 100);
  const gradeRows = grades.map((grade) => {
    const score = grade.marks ?? grade.score ?? grade.obtainedMarks ?? 0;
    const total = grade.totalMarks ?? grade.maxScore ?? 0;
    const percentage = grade.percentage ?? (asNumber(total) > 0 ? (asNumber(score) / asNumber(total)) * 100 : 0);
    return `<tr>
      <td>${escapeHtml(grade.subject || 'General')}</td>
      <td>${escapeHtml(grade.examType || 'Assessment')}</td>
      <td>${escapeHtml(score)} / ${escapeHtml(total)}</td>
      <td>${escapeHtml(asNumber(percentage).toFixed(1))}%</td>
    </tr>`;
  }).join('');
  const average = grades.length === 0
    ? 0
    : grades.reduce((sum, grade) => sum + asNumber(grade.percentage), 0) / grades.length;

  const body = `
    <div class="meta-card">
      <div><span class="meta-label">Student</span><span class="meta-value">${escapeHtml(student.name || 'Student')}</span></div>
      <div><span class="meta-label">User ID</span><span class="meta-value">${escapeHtml(reportId(student))}</span></div>
      <div><span class="meta-label">Academic placement</span><span class="meta-value">${escapeHtml(placementLabel(student, institutionType))}</span></div>
      <div><span class="meta-label">Report date</span><span class="meta-value">${escapeHtml(new Date().toLocaleDateString())}</span></div>
    </div>
    <div class="section-title">Academic Performance</div>
    <table>
      <thead><tr><th>Subject</th><th>Assessment</th><th>Score</th><th>Percentage</th></tr></thead>
      <tbody>${gradeRows || '<tr><td colspan="4">No grade records are available.</td></tr>'}</tbody>
    </table>
    <div class="summary-grid">
      <div class="summary-card"><span class="meta-label">Assessments</span><div class="summary-value">${grades.length}</div></div>
      <div class="summary-card"><span class="meta-label">Average</span><div class="summary-value">${average.toFixed(1)}%</div></div>
      <div class="summary-card"><span class="meta-label">Attendance</span><div class="summary-value">${attendancePercentage}%</div></div>
    </div>`;

  return buildDocument({
    body,
    brand,
    title: 'Student Report Card',
  });
};

export const buildClassRosterHtml = ({
  brand,
  institutionType,
  scopeLabel,
  students,
}: ClassRosterInput): string => {
  const rows = students.map((student, index) => `<tr>
    <td>${index + 1}</td>
    <td>${escapeHtml(student.name || 'Student')}</td>
    <td>${escapeHtml(reportId(student))}</td>
    <td>${escapeHtml(placementLabel(student, institutionType))}</td>
  </tr>`).join('');
  const body = `
    <div class="meta-card">
      <div><span class="meta-label">Roster scope</span><span class="meta-value">${escapeHtml(scopeLabel)}</span></div>
      <div><span class="meta-label">Total students</span><span class="meta-value">${students.length}</span></div>
    </div>
    <div class="section-title">Enrolled Students</div>
    <table>
      <thead><tr><th>#</th><th>Student</th><th>User ID</th><th>Academic placement</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No students match this roster scope.</td></tr>'}</tbody>
    </table>`;

  return buildDocument({
    body,
    brand,
    title: 'Class Roster',
  });
};

const downloadHtmlOnWeb = (html: string, fileName: string) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const shareHtmlAsPdf = async ({
  fileName,
  html,
}: {
  fileName: string;
  html: string;
}) => {
  if (Platform.OS === 'web') {
    downloadHtmlOnWeb(html, fileName.replace(/\.pdf$/i, '.html'));
    return { uri: null };
  }

  const result = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri, {
      dialogTitle: fileName,
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
  }

  return result;
};
