import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';

const isNotice = (notification) => {
  const originalType = notification?.data?.originalType;
  return (
    notification?.type === 'announcement' ||
    notification?.relatedType === 'notice' ||
    notification?.relatedType === 'broadcast' ||
    originalType === 'admin_notice' ||
    originalType === 'campus_broadcast'
  );
};

const getAuthorName = (author) => {
  if (!author) return 'Campus';
  if (typeof author === 'string') return author;
  return author.name || author.email || 'Campus';
};

const formatDate = (createdAt) => {
  if (!createdAt) return 'Just now';
  if (typeof createdAt.toDate === 'function') return createdAt.toDate().toLocaleDateString();
  if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleDateString();
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? 'Just now' : parsed.toLocaleDateString();
};

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

function NoticeHeader({ count }) {
  const { colors, typography } = useRootLayout();

  return (
    <View style={styles.headerBlock}>
      <Text style={[styles.eyebrow, { color: colors.muted }]}>Campus signal</Text>
      <Text style={[styles.screenTitle, { color: colors.text, fontFamily: typography.title }]}>Notices</Text>
      <Text style={[styles.screenSubtitle, { color: colors.textSoft }]}>
        Broadcasts and announcements from your institute, organized for quick reading.
      </Text>
      <View style={[styles.summaryPill, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
        <Ionicons name="megaphone-outline" size={16} color={colors.accent} />
        <Text style={[styles.summaryText, { color: colors.text }]}>{count} notice{count === 1 ? '' : 's'}</Text>
      </View>
    </View>
  );
}

function NoticeCard({ item, index }) {
  const { colors, radii } = useRootLayout();
  const accent = index % 2 === 0 ? colors.accent : colors.violet;
  const accentSoft = index % 2 === 0 ? colors.accentSoft : colors.violetSoft;

  return (
    <View
      style={[
        styles.noticeCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.hairline,
          borderRadius: radii.card,
        },
      ]}
    >
      <View style={styles.noticeTopRow}>
        <View style={[styles.iconOrb, { backgroundColor: accentSoft, borderColor: colors.hairline }]}>
          <Ionicons name="megaphone" size={21} color={accent} />
        </View>
        <View style={styles.noticeTitleBlock}>
          <Text numberOfLines={2} style={[styles.noticeTitle, { color: colors.text }]}>
            {item.title || 'Campus Notice'}
          </Text>
          <Text numberOfLines={1} style={[styles.noticeMeta, { color: colors.muted }]}>
            {getAuthorName(item.author)} - {formatDate(item.createdAt)}
          </Text>
        </View>
      </View>

      <Text numberOfLines={5} style={[styles.noticeBody, { color: colors.textSoft }]}>
        {item.message || item.content || 'No additional details.'}
      </Text>
    </View>
  );
}

function EmptyState() {
  const { colors } = useRootLayout();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft, borderColor: colors.hairline }]}>
        <Ionicons name="moon-outline" size={34} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No notices yet</Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>Campus broadcasts will appear here.</Text>
    </View>
  );
}

export default function Notices() {
  const { notifications } = useAuth();
  const { colors, insets, isDesktop, maxContentWidth, spacing } = useRootLayout();

  const notices = useMemo(
    () => (notifications || [])
      .filter(isNotice)
      .sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt)),
    [notifications]
  );

  const listStyle = useMemo(() => ({
    alignSelf: 'center',
    maxWidth: isDesktop ? maxContentWidth : undefined,
    paddingBottom: Math.max(insets.bottom, 10) + 104,
    paddingHorizontal: spacing.pageX,
    paddingTop: Math.max(insets.top, 12) + 26,
    width: '100%',
  }), [insets.bottom, insets.top, isDesktop, maxContentWidth, spacing.pageX]);

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]}>
      <FlatList
        data={notices}
        keyExtractor={(item, index) => item.id || `notice-${index}`}
        ListEmptyComponent={<EmptyState />}
        ListHeaderComponent={<NoticeHeader count={notices.length} />}
        contentContainerStyle={listStyle}
        renderItem={({ item, index }) => <NoticeCard index={index} item={item} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    marginBottom: 16,
    width: 72,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  headerBlock: {
    marginBottom: 22,
  },
  iconOrb: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  noticeBody: {
    backgroundColor: '#111827',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 22,
    padding: 14,
  },
  noticeCard: {
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    padding: 18,
  },
  noticeMeta: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  noticeTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  noticeTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  noticeTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  screenSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 620,
  },
  screenTitle: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 4,
  },
  summaryPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '900',
  },
});
