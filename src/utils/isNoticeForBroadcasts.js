/**
 * Determines if a notification should be displayed in the Broadcasts/Notices section
 * @param {Object} notification - The notification object to check
 * @returns {boolean} True if the notification is a notice/broadcast, false otherwise
 */
export const isNoticeForBroadcasts = (notification) => {
  const originalType = notification?.data?.originalType;
  return (
    notification?.type === 'announcement' ||
    notification?.relatedType === 'notice' ||
    notification?.relatedType === 'broadcast' ||
    originalType === 'admin_notice' ||
    originalType === 'campus_broadcast'
  );
};