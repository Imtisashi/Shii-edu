const {
  authenticateUserProfile,
  createRequestId,
  getAdminServices,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../_lib/firebaseAdmin');

const ACTIONS = new Set(['smartSearch', 'gradingAnalytics', 'studyGuide', 'general']);
const FACULTY_ROLES = new Set(['teacher', 'professor', 'admin', 'superadmin']);
const STUDENT_ROLES = new Set(['student', 'teacher', 'professor', 'admin', 'superadmin']);
const SEARCH_COLLECTIONS = ['courses', 'notices', 'assignments', 'pyqs', 'routines'];

const normalizeText = (value) => String(value || '').trim();
const lowerText = (value) => normalizeText(value).toLowerCase();
const limitText = (value, maxLength = 6000) => normalizeText(value).slice(0, maxLength);

const getOpenAIConfig = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not configured.');
    error.statusCode = 503;
    throw error;
  }

  return {
    apiKey,
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  };
};

const assertAllowedAction = (action, role) => {
  if (!ACTIONS.has(action)) {
    const error = new Error('Unsupported AI action.');
    error.statusCode = 400;
    throw error;
  }

  if (action === 'gradingAnalytics' && !FACULTY_ROLES.has(role)) {
    const error = new Error('Only faculty or administrators can use grading analytics.');
    error.statusCode = 403;
    throw error;
  }

  if (action === 'studyGuide' && !STUDENT_ROLES.has(role)) {
    const error = new Error('You do not have access to study guide generation.');
    error.statusCode = 403;
    throw error;
  }
};

const actorInstituteId = (actor, body) => {
  if (actor.role === 'superadmin' && body.instituteId) return body.instituteId;
  const instituteId = actor.profile?.instituteId;
  if (!instituteId) {
    const error = new Error('Your profile is not linked to an institute.');
    error.statusCode = 403;
    throw error;
  }
  return instituteId;
};

const queryInstituteCollection = async ({ firestore, collectionName, instituteId, max = 24 }) => {
  const snapshot = await firestore
    .collection(collectionName)
    .where('instituteId', '==', instituteId)
    .limit(max)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), collectionName }));
};

const stringifySearchRecord = (record) => [
  record.title,
  record.name,
  record.subject,
  record.description,
  record.message,
  record.body,
  record.year,
  record.targetPrimary,
  record.targetSecondary,
].filter(Boolean).join(' ');

const scoreRecord = (record, queryText) => {
  const haystack = lowerText(stringifySearchRecord(record));
  const terms = lowerText(queryText).split(/\s+/).filter(Boolean);
  if (!terms.length) return 0;
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
};

const buildSearchContext = async ({ firestore, instituteId, queryText }) => {
  const recordGroups = await Promise.all(
    SEARCH_COLLECTIONS.map((collectionName) => queryInstituteCollection({ firestore, collectionName, instituteId }))
  );
  const records = recordGroups.flat()
    .map((record) => ({ ...record, relevance: scoreRecord(record, queryText) }))
    .filter((record) => record.relevance > 0 || lowerText(queryText).length < 3)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 18);

  return records.map((record) => ({
    id: record.id,
    type: record.collectionName,
    title: record.title || record.name || record.subject || record.id,
    summary: limitText(stringifySearchRecord(record), 280),
  }));
};

const buildGradesContext = async ({ firestore, instituteId, body }) => {
  const grades = await queryInstituteCollection({ firestore, collectionName: 'grades', instituteId, max: 60 });
  const filtered = body.scope
    ? grades.filter((grade) => {
      const scope = lowerText(body.scope);
      return lowerText([grade.subject, grade.class, grade.section, grade.dept, grade.sem].filter(Boolean).join(' ')).includes(scope);
    })
    : grades;

  return filtered.slice(0, 50).map((grade) => ({
    studentId: grade.studentId || grade.studentUid || grade.studentUniqueId,
    subject: grade.subject || 'General',
    score: grade.score ?? grade.marks ?? grade.obtainedMarks ?? null,
    maxScore: grade.maxScore ?? grade.totalMarks ?? null,
    examType: grade.examType || grade.type || 'Assessment',
  }));
};

const buildStudyContext = async ({ firestore, instituteId, body, actor }) => {
  const courseId = body.courseId;
  if (courseId) {
    const courseSnap = await firestore.collection('courses').doc(courseId).get();
    if (!courseSnap.exists) {
      const error = new Error('Course not found.');
      error.statusCode = 404;
      throw error;
    }

    const course = courseSnap.data();
    if (actor.role !== 'superadmin' && course.instituteId !== instituteId) {
      const error = new Error('Course is outside your institute.');
      error.statusCode = 403;
      throw error;
    }

    return [{
      title: course.title || 'Course',
      description: course.description || '',
      modules: course.modules || [],
    }];
  }

  return queryInstituteCollection({ firestore, collectionName: 'courses', instituteId, max: 12 });
};

const createPrompt = async ({ action, body, actor, firestore, instituteId }) => {
  if (action === 'smartSearch') {
    const queryText = limitText(body.query, 400);
    if (!queryText) {
      const error = new Error('Search query is required.');
      error.statusCode = 400;
      throw error;
    }

    const results = await buildSearchContext({ firestore, instituteId, queryText });
    return {
      responseShape: 'Return JSON with keys: answer, highlights, results.',
      input: `Search query: ${queryText}\nInstitution records:\n${JSON.stringify(results, null, 2)}`,
      metadata: { results },
    };
  }

  if (action === 'gradingAnalytics') {
    const grades = await buildGradesContext({ firestore, instituteId, body });
    return {
      responseShape: 'Return JSON with keys: summary, weakPoints, trendSignals, recommendedActions.',
      input: `Instructor: ${actor.profile?.name || actor.uid}\nAssessment scope: ${body.scope || 'All'}\nGrade records:\n${JSON.stringify(grades, null, 2)}`,
      metadata: { gradeCount: grades.length },
    };
  }

  if (action === 'studyGuide') {
    const studyContext = await buildStudyContext({ firestore, instituteId, body, actor });
    return {
      responseShape: 'Return JSON with keys: title, overview, keyConcepts, practiceQuestions, revisionPlan.',
      input: `Student: ${actor.profile?.name || actor.uid}\nRequested focus: ${body.focus || 'Complete review'}\nCourse context:\n${JSON.stringify(studyContext, null, 2)}`,
      metadata: { contextCount: studyContext.length },
    };
  }

  return {
    responseShape: 'Return JSON with keys: answer, nextSteps.',
    input: limitText(body.prompt, 6000),
    metadata: {},
  };
};

const callOpenAI = async ({ config, action, prompt }) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      instructions: [
        'You are Edu-Hub alpha, a precise educational SaaS assistant.',
        'Use only the institution-scoped context provided.',
        'Do not invent records, grades, courses, attendance, policies, or people.',
        prompt.responseShape,
      ].join(' '),
      input: prompt.input,
      max_output_tokens: action === 'studyGuide' ? 1800 : 1200,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'AI generation failed.');
    error.statusCode = response.status;
    throw error;
  }

  return {
    id: payload.id,
    text: payload.output_text || '',
    raw: payload,
  };
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
    const body = await getBody(req);
    const action = body.action || 'general';
    const actor = await authenticateUserProfile(req);
    assertAllowedAction(action, actor.role);

    const { firestore } = getAdminServices();
    const instituteId = actorInstituteId(actor, body);
    const config = getOpenAIConfig();
    const prompt = await createPrompt({ action, body, actor, firestore, instituteId });
    const generation = await callOpenAI({ config, action, prompt });

    res.status(200).json({
      success: true,
      action,
      instituteId,
      model: config.model,
      output: generation.text,
      responseId: generation.id,
      metadata: prompt.metadata,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'AI request failed.', requestId);
  }
};
