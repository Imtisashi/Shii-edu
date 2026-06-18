import { access, stat } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const apkCatalog = {
  driver: {
    fileName: 'shii-edu-driver.apk',
    label: 'Shii-Edu Driver',
    packageName: 'com.shiiedu.driver',
  },
  institute: {
    fileName: 'shii-edu-institute.apk',
    label: 'Shii-Edu Institute',
    packageName: 'com.shiiedu.institute',
  },
  parents: {
    fileName: 'shii-edu-parents.apk',
    label: 'Shii-Edu Parents',
    packageName: 'com.shiiedu.parents',
  },
  superadmin: {
    fileName: 'shii-edu-superadmin.apk',
    label: 'Shii-Edu Superadmin',
    packageName: 'com.shiiedu.superadmin',
  },
};

const jsonHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const role = String(requestUrl.searchParams.get('role') || '').trim().toLowerCase();
  const entry = apkCatalog[role];

  if (!entry) {
    return Response.json(
      { available: false, error: 'Unknown role.', role },
      { headers: jsonHeaders, status: 400 }
    );
  }

  const href = `/downloads/apk/${entry.fileName}`;
  const absolutePath = path.join(process.cwd(), 'public', 'downloads', 'apk', entry.fileName);

  try {
    await access(absolutePath);
    const file = await stat(absolutePath);
    return Response.json(
      {
        available: file.isFile(),
        fileName: entry.fileName,
        href,
        label: entry.label,
        packageName: entry.packageName,
        sizeBytes: file.isFile() ? file.size : 0,
      },
      { headers: jsonHeaders }
    );
  } catch {
    return Response.json(
      {
        available: false,
        fileName: entry.fileName,
        href,
        label: entry.label,
        packageName: entry.packageName,
        sizeBytes: 0,
      },
      { headers: jsonHeaders }
    );
  }
}
