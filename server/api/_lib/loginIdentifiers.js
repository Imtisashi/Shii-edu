const { createHash } = require('crypto');

const USER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const INSTITUTE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const normalizeIdentifier = (value) => String(value || '').trim();
const toIdentifierKey = (value) => normalizeIdentifier(value).toLowerCase();

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const assertUserId = (value, label = 'User ID') => {
  const userId = normalizeIdentifier(value);
  if (!USER_ID_PATTERN.test(userId)) {
    throw createValidationError(
      `${label} must use only letters, numbers, dots, underscores, or hyphens.`
    );
  }

  return userId;
};

const assertInstituteId = (value) => {
  const instituteId = normalizeIdentifier(value);
  if (!INSTITUTE_ID_PATTERN.test(instituteId)) {
    throw createValidationError('Institute ID is invalid.');
  }

  return instituteId;
};

const toInstituteAuthEmail = (instituteIdValue, userIdValue) => {
  const instituteId = assertInstituteId(instituteIdValue);
  const userId = assertUserId(userIdValue);
  const digest = createHash('sha256')
    .update(`${toIdentifierKey(instituteId)}\u0000${toIdentifierKey(userId)}`, 'utf8')
    .digest('hex');

  return `${digest}@eduhub.local`;
};

const toLegacyAuthEmail = (userIdValue) => {
  const userId = assertUserId(userIdValue);
  return `${toIdentifierKey(userId)}@eduhub.local`;
};

module.exports = {
  assertInstituteId,
  assertUserId,
  normalizeIdentifier,
  toIdentifierKey,
  toLegacyAuthEmail,
  toInstituteAuthEmail,
};
