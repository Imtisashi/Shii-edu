const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';

const getGeminiConfig = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY is not configured.');
    error.statusCode = 503;
    throw error;
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
  };
};

const providerError = (response, payload, fallbackMessage) => {
  const message = payload?.error?.message || fallbackMessage;
  const error = new Error(/api key|credential|permission denied/i.test(message)
    ? 'AI provider credentials are not configured correctly.'
    : message);
  error.statusCode = /api key|credential|permission denied/i.test(message) ? 503 : response.status;
  error.providerCode = payload?.error?.status || '';
  return error;
};

const generateStructured = async ({
  apiKey,
  model,
  prompt,
  systemPrompt,
  responseJsonSchema,
  maxOutputTokens = 1200,
}) => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      generationConfig: {
        maxOutputTokens,
        responseMimeType: 'application/json',
        responseJsonSchema,
        temperature: 0,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw providerError(response, payload, 'AI generation failed.');

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    const error = new Error('AI provider returned invalid structured output.');
    error.statusCode = 502;
    throw error;
  }

  return {
    id: payload.candidates?.[0]?.candidateId || '',
    model,
    parsed,
    text,
  };
};

const embedContent = async ({
  apiKey,
  embeddingModel,
  text,
  taskType,
  title,
  outputDimensionality = 768,
}) => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: `models/${embeddingModel}`,
      content: {
        parts: [{ text }],
      },
      outputDimensionality,
      taskType,
      ...(title ? { title } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw providerError(response, payload, 'Embedding generation failed.');
  const values = payload.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    const error = new Error('Embedding provider returned an empty vector.');
    error.statusCode = 502;
    throw error;
  }
  return values;
};

const batchEmbedContents = async ({
  apiKey,
  embeddingModel,
  items,
  taskType,
  outputDimensionality = 768,
}) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  const requests = items.map((item) => ({
    model: `models/${embeddingModel}`,
    content: {
      parts: [{ text: item.text }],
    },
    outputDimensionality,
    taskType,
    ...(item.title ? { title: item.title } : {}),
  }));
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:batchEmbedContents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({ requests }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw providerError(response, payload, 'Embedding generation failed.');
  const embeddings = payload.embeddings || [];
  if (embeddings.length !== items.length) {
    const error = new Error('Embedding provider returned an incomplete batch.');
    error.statusCode = 502;
    throw error;
  }
  return embeddings.map((embedding) => embedding.values);
};

const cosineSimilarity = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
};

module.exports = {
  batchEmbedContents,
  cosineSimilarity,
  embedContent,
  generateStructured,
  getGeminiConfig,
};
