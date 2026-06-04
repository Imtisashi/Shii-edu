const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const sendExpoPushToUsers = async ({
  firestore,
  instituteId,
  recipientUids,
  title,
  body,
  data = {},
}) => {
  if (!instituteId || !Array.isArray(recipientUids) || recipientUids.length === 0) {
    return { sent: 0 };
  }

  const tokensSnapshot = await firestore
    .collection('pushTokens')
    .where('instituteId', '==', instituteId)
    .get();
  const recipients = new Set(recipientUids);
  const messages = tokensSnapshot.docs
    .map((document) => document.data() || {})
    .filter((token) => recipients.has(token.uid) && typeof token.token === 'string' && token.token.startsWith('ExponentPushToken'))
    .map((token) => ({
      to: token.token,
      sound: 'default',
      title,
      body,
      data,
    }));

  for (const chunk of chunkArray(messages, 100)) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });
    if (!response.ok) {
      console.warn('Expo push delivery failed:', await response.text().catch(() => response.statusText));
    }
  }

  return { sent: messages.length };
};

module.exports = {
  sendExpoPushToUsers,
};
