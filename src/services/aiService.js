import { auth } from '../../firebaseConfig';
import { authenticatedFetch } from './apiClient';

const ensureUser = () => {
  if (!auth.currentUser) {
    throw new Error('You must be signed in to use Shii-Edu AI.');
  }

  return auth.currentUser;
};

const parseAIOutput = (output) => {
  if (!output) return null;

  try {
    return JSON.parse(output);
  } catch (_error) {
    return { answer: output };
  }
};

export const runAIAction = async (action, payload = {}) => {
  const response = await authenticatedFetch('/api/ai', ensureUser(), {
    method: 'POST',
    timeoutMs: 60000,
    retryCount: 0,
    body: {
      action,
      ...payload,
    },
  });

  return {
    ...response,
    parsed: parseAIOutput(response.output),
  };
};

export const aiSmartSearch = async (query, options = {}) => runAIAction('smartSearch', {
  query,
  ...options,
});

export const aiGradingAnalytics = async ({ scope, instituteId } = {}) => runAIAction('gradingAnalytics', {
  scope,
  instituteId,
});

export const aiStudyGuide = async ({ courseId, focus, instituteId } = {}) => runAIAction('studyGuide', {
  courseId,
  focus,
  instituteId,
});

export const aiSyllabusTutor = async ({ courseId, question, syllabusId, instituteId } = {}) => runAIAction('syllabusTutor', {
  courseId,
  question,
  syllabusId,
  instituteId,
});

export const aiSmartCompose = async ({ roughThought, targetLevel = 'Overall', instituteId } = {}) => {
  const response = await runAIAction('smartCompose', {
    roughThought,
    targetLevel,
    instituteId,
  });
  const draft = response.draft || response.parsed;

  if (!draft?.title || !draft?.message) {
    throw new Error('Smart Compose did not return a usable notice draft.');
  }

  return {
    ...response,
    draft: {
      title: String(draft.title).trim(),
      message: String(draft.message).trim(),
    },
  };
};

export const askGemini = async (prompt) => {
  const response = await runAIAction('general', { prompt });
  return response.output;
};
