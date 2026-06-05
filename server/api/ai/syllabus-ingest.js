const pdfParse = require('pdf-parse');
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
} = require('../_lib/firebaseAdmin');
const { batchEmbedContents, getGeminiConfig } = require('../_lib/gemini');
const { assertNoPromptInjection } = require('../_lib/promptSafety');
const { assertFeatureEnabled } = require('../_lib/featureEntitlements');
const {
  enqueueBackgroundTask,
  isInternalTaskExecution,
  startBackgroundTask,
} = require('../_lib/backgroundTasks');
const { assertRateLimit } = require('../_lib/rateLimit');

const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_CHUNKS = 160;
const EMBEDDING_BATCH_SIZE = 16;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 180;

const RequestSchema = z.object({
  courseId: z.string().trim().max(180).optional().default(''),
  fileUrl: z.string().url().max(2000),
  idempotencyKey: z.string().trim().max(180).optional().default(''),
  publicId: z.string().trim().min(1).max(800),
  subject: z.string().trim().min(2).max(160),
  title: z.string().trim().min(3).max(180),
}).strict();

const parseBody = (body) => {
  const result = RequestSchema.safeParse(body);
  if (result.success) return result.data;
  const error = new Error(result.error.issues[0]?.message || 'Invalid syllabus ingestion request.');
  error.statusCode = 400;
  throw error;
};

const assertApprovedSyllabusUpload = ({ fileUrl, publicId, instituteId }) => {
  const url = new URL(fileUrl);
  const legacyCloudinaryPath = `institutions/${instituteId}/syllabi/`;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  let supabaseHost = '';
  try {
    supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : '';
  } catch (_error) {
    supabaseHost = '';
  }
  const normalizedPublicId = String(publicId || '').replace(/^\/+/, '');
  const isLegacyCloudinary = url.hostname === 'res.cloudinary.com' && normalizedPublicId.includes(legacyCloudinaryPath);
  const isSupabaseAsset = Boolean(supabaseHost) &&
    url.hostname === supabaseHost &&
    url.pathname.includes(`/storage/v1/object/public/assets/${instituteId}/syllabi/`) &&
    normalizedPublicId.startsWith(`${instituteId}/syllabi/`);

  if (url.protocol !== 'https:' || (!isLegacyCloudinary && !isSupabaseAsset)) {
    const error = new Error('The syllabus PDF must be an approved Supabase upload owned by this institute.');
    error.statusCode = 400;
    throw error;
  }
};

const fetchPdf = async (fileUrl) => {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    const error = new Error('The uploaded syllabus PDF could not be downloaded.');
    error.statusCode = 400;
    throw error;
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_PDF_BYTES) {
    const error = new Error('Syllabus PDFs must be smaller than 12 MB.');
    error.statusCode = 400;
    throw error;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_PDF_BYTES) {
    const error = new Error('Syllabus PDFs must be smaller than 12 MB.');
    error.statusCode = 400;
    throw error;
  }
  return buffer;
};

const normalizePdfText = (value) => String(value || '')
  .replace(/\r/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const chunkText = (text) => {
  const chunks = [];
  let cursor = 0;
  while (cursor < text.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(cursor + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      const sentenceBreak = text.lastIndexOf('. ', end);
      const preferredBreak = Math.max(paragraphBreak, sentenceBreak);
      if (preferredBreak > cursor + Math.floor(CHUNK_SIZE * 0.55)) end = preferredBreak + 1;
    }
    const chunk = text.slice(cursor, end).trim();
    if (chunk.length >= 80) chunks.push(chunk);
    if (end >= text.length) break;
    cursor = Math.max(end - CHUNK_OVERLAP, cursor + 1);
  }
  return chunks;
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

module.exports = async function handler(req, res) {
  const requestId = createRequestId();
  setCorsHeaders(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  try {
    const actor = await authenticateUserProfile(req, ['admin', 'teacher', 'professor']);
    if (!isInternalTaskExecution(req)) {
      assertRateLimit({ actor, req, scope: 'ai:syllabus-ingest', limit: 10, windowMs: 60 * 1000 });
    }
    const instituteId = actor.profile?.instituteId;
    if (!instituteId) {
      const error = new Error('Your profile is not linked to an institute.');
      error.statusCode = 403;
      throw error;
    }
    const body = parseBody(await getBody(req));
    assertApprovedSyllabusUpload({ ...body, instituteId });
    const { firestore } = getAdminServices();
    await assertFeatureEnabled({ firestore, instituteId, featureKey: 'ai' });

    if (!isInternalTaskExecution(req)) {
      const task = await enqueueBackgroundTask({
        actor,
        idempotencyKey: body.idempotencyKey || `syllabus-ingest:${body.publicId}`,
        instituteId,
        payload: body,
        type: 'syllabus_ingest',
      });
      startBackgroundTask(task.id);
      res.status(task.created ? 202 : 200).json({
        success: true,
        background: true,
        taskId: task.id,
        status: task.status,
        requestId,
      });
      return;
    }

    const pdfBuffer = await fetchPdf(body.fileUrl);
    const parsedPdf = await pdfParse(pdfBuffer);
    const text = normalizePdfText(parsedPdf.text);
    assertNoPromptInjection(text, 'Uploaded syllabus');
    if (text.length < 120) {
      const error = new Error('The PDF does not contain enough readable syllabus text.');
      error.statusCode = 400;
      throw error;
    }
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      const error = new Error('No searchable syllabus sections could be extracted.');
      error.statusCode = 400;
      throw error;
    }

    const config = getGeminiConfig();
    const embeddings = [];
    for (const batch of chunkArray(chunks, EMBEDDING_BATCH_SIZE)) {
      const batchEmbeddings = await batchEmbedContents({
        apiKey: config.apiKey,
        embeddingModel: config.embeddingModel,
        items: batch.map((chunk) => ({ text: chunk, title: body.title })),
        taskType: 'RETRIEVAL_DOCUMENT',
      });
      embeddings.push(...batchEmbeddings);
    }

    const syllabusRef = firestore.collection('syllabi').doc();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const syllabus = {
      id: syllabusRef.id,
      instituteId,
      title: body.title,
      subject: body.subject,
      courseId: body.courseId || null,
      fileUrl: body.fileUrl,
      publicId: body.publicId,
      provider: body.fileUrl.includes('/storage/v1/object/public/assets/') ? 'supabase' : 'cloudinary',
      pageCount: parsedPdf.numpages || null,
      chunkCount: chunks.length,
      embeddingModel: config.embeddingModel,
      status: 'ready',
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: actor.uid,
    };

    const writeBatches = chunkArray(chunks.map((chunk, index) => ({ chunk, embedding: embeddings[index], index })), 350);
    for (let batchIndex = 0; batchIndex < writeBatches.length; batchIndex += 1) {
      const batch = firestore.batch();
      if (batchIndex === 0) batch.set(syllabusRef, syllabus);
      writeBatches[batchIndex].forEach(({ chunk, embedding, index }) => {
        const chunkRef = firestore.collection('syllabusChunks').doc(`${syllabusRef.id}_${String(index).padStart(4, '0')}`);
        batch.set(chunkRef, {
          id: chunkRef.id,
          instituteId,
          syllabusId: syllabusRef.id,
          syllabusTitle: body.title,
          subject: body.subject,
          courseId: body.courseId || null,
          chunkIndex: index,
          text: chunk,
          embedding,
          embeddingModel: config.embeddingModel,
          createdAt: timestamp,
          createdBy: actor.uid,
        });
      });
      await batch.commit();
    }

    res.status(201).json({
      success: true,
      syllabusId: syllabusRef.id,
      chunkCount: chunks.length,
      pageCount: parsedPdf.numpages || null,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'Syllabus ingestion failed.', requestId);
  }
};
