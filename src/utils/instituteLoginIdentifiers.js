import * as Crypto from 'expo-crypto';

const USER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const INSTITUTE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export const normalizeLoginIdentifier = (value) => String(value || '').trim();
export const toLoginIdentifierKey = (value) => normalizeLoginIdentifier(value).toLowerCase();

const createIdentifierError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

export const assertLoginUserId = (value) => {
  const userId = normalizeLoginIdentifier(value);
  if (!USER_ID_PATTERN.test(userId)) {
    throw createIdentifierError(
      'User ID must use only letters, numbers, dots, underscores, or hyphens.',
      'auth/invalid-user-id'
    );
  }

  return userId;
};

export const assertLoginInstituteId = (value) => {
  const instituteId = normalizeLoginIdentifier(value);
  if (!INSTITUTE_ID_PATTERN.test(instituteId)) {
    throw createIdentifierError('Institute ID is invalid.', 'auth/invalid-institute-id-format');
  }

  return instituteId;
};

export const toInstituteAuthEmail = async (instituteIdValue, userIdValue) => {
  const instituteId = assertLoginInstituteId(instituteIdValue);
  const userId = assertLoginUserId(userIdValue);
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${toLoginIdentifierKey(instituteId)}\u0000${toLoginIdentifierKey(userId)}`
  );

  return `${digest}@eduhub.local`;
};

export const toLegacyAuthEmail = (userIdValue) => {
  const userId = assertLoginUserId(userIdValue);
  return `${toLoginIdentifierKey(userId)}@eduhub.local`;
};
