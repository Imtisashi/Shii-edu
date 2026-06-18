import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { deleteInstituteAsSuperAdmin, updateInstituteFeatureSettings } from '../../services/firebaseAdminService';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import LoadingState, { SmoothSpinner } from '../../components/ui/LoadingState';
import {
  DEFAULT_FEATURE_TIER,
  FEATURE_DEFINITIONS,
  FEATURE_TIERS,
  getTierFeatureMap,
  resolveFeatureEntitlements,
} from '../../constants/featureEntitlements';
import rateLimitCatalog from '../../constants/rateLimitCatalog.json';

const RATE_LIMIT_TIERS = rateLimitCatalog.tiers || {};
const RATE_LIMIT_SCOPES = rateLimitCatalog.scopes || [];
const DEFAULT_RATE_LIMIT_TIER = rateLimitCatalog.defaultTier || 'standard';
const RATE_LIMIT_TIER_ALIASES = rateLimitCatalog.aliases || {};
const PLAN_ORDER = ['basic', 'pro', 'max'];
const PLAN_HIGHLIGHT_FEATURES = {
  basic: ['people', 'attendance', 'finance'],
  pro: ['ai_tools', 'bus_tracking', 'advanced_reports'],
  max: ['custom_subdomain', 'api_access', 'ai_agent'],
};
const SUBSCRIPTION_STATUS_OPTIONS = [
  { key: 'active', label: 'Active', tone: 'good' },
  { key: 'trialing', label: 'Trial', tone: 'good' },
  { key: 'past_due', label: 'Past Due', tone: 'warn' },
  { key: 'cancelled', label: 'Cancelled', tone: 'danger' },
  { key: 'expired', label: 'Expired', tone: 'danger' },
];

const normalizeRateLimitTier = (tier) => {
  const rawTier = String(tier || DEFAULT_RATE_LIMIT_TIER).trim().toLowerCase();
  const normalizedTier = RATE_LIMIT_TIER_ALIASES[rawTier] || rawTier;
  return RATE_LIMIT_TIERS[normalizedTier] ? normalizedTier : DEFAULT_RATE_LIMIT_TIER;
};

const resolveInstituteRateLimits = (institute = {}) => {
  const settings = institute.settings?.rateLimits ||
    institute.configuration?.rateLimits ||
    institute.rateLimits ||
    {};
  const tier = normalizeRateLimitTier(settings.tier);
  const overrides = settings.overrides && typeof settings.overrides === 'object' ? settings.overrides : {};
  return { overrides, tier };
};

const formatWindow = (windowMs) => {
  const seconds = Math.round(Number(windowMs || 60000) / 1000);
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${seconds}s`;
};

const asObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const normalizeSubscriptionStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  return SUBSCRIPTION_STATUS_OPTIONS.some((option) => option.key === normalized) ? normalized : 'active';
};

const getInstituteSubscription = (institute = {}) => {
  const subscription = asObject(
    institute.settings?.subscription ||
    institute.configuration?.subscription ||
    institute.subscription
  );
  return {
    ...subscription,
    status: normalizeSubscriptionStatus(subscription.status),
  };
};

const getFeatureAudit = (institute = {}) => asObject(
  institute.settings?.features ||
  institute.configuration?.features ||
  institute.features
);

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const normalizeInstituteId = (value) => String(value || '').trim();

const getUsageKey = (data = {}, fallbackId = '') => normalizeInstituteId(
  data.instituteId ||
  data.instituteID ||
  data.institutionId ||
  data.tenantId ||
  fallbackId
);

const createUsageEntry = ({ aiKnown = false, usersKnown = false } = {}) => ({
  aiRequestsToday: aiKnown ? 0 : null,
  users: usersKnown ? 0 : null,
});

const buildUsageByInstituteId = ({ aiUsageSnapshot, usersSnapshot }) => {
  const usageByInstituteId = {};
  const usersKnown = Boolean(usersSnapshot?.docs);
  const aiKnown = Boolean(aiUsageSnapshot?.docs);
  const ensureUsage = (instituteId) => {
    const key = normalizeInstituteId(instituteId);
    if (!key) return null;
    if (!usageByInstituteId[key]) usageByInstituteId[key] = createUsageEntry({ aiKnown, usersKnown });
    return usageByInstituteId[key];
  };

  usersSnapshot?.docs?.forEach((userDoc) => {
    const data = userDoc.data?.() || {};
    const entry = ensureUsage(getUsageKey(data));
    if (entry) entry.users = Number(entry.users || 0) + 1;
  });

  aiUsageSnapshot?.docs?.forEach((usageDoc) => {
    const data = usageDoc.data?.() || {};
    const entry = ensureUsage(getUsageKey(data));
    if (entry) entry.aiRequestsToday = Number(entry.aiRequestsToday || 0) + Number(data.requestCount || 0);
  });

  return { aiKnown, usageByInstituteId, usersKnown };
};

const resolveUsage = ({ aiKnown, instituteId, usageByInstituteId, usersKnown }) => ({
  ...createUsageEntry({ aiKnown, usersKnown }),
  ...(usageByInstituteId[normalizeInstituteId(instituteId)] || {}),
});

const formatCount = (value) => {
  if (value === null || value === undefined || value === '') return 'Unknown';
  return Number(value).toLocaleString();
};

const formatLimit = (value, unit = '') => {
  if (value === null || value === undefined) return 'Unlimited';
  return `${formatCount(value)}${unit}`;
};

const formatUsage = (used, limit, unit = '') => (
  `${formatCount(used)} / ${formatLimit(limit, unit)}`
);

const getFeatureLabel = (featureKey) => (
  FEATURE_DEFINITIONS.find((feature) => feature.key === featureKey)?.label || featureKey
);

const getPlanEnabledCount = (tierKey) => {
  const features = getTierFeatureMap(tierKey);
  return FEATURE_DEFINITIONS.filter((feature) => features[feature.key] !== false).length;
};

const getPlanHighlights = (tierKey) => {
  const planFeatures = getTierFeatureMap(tierKey);
  return (PLAN_HIGHLIGHT_FEATURES[tierKey] || [])
    .filter((featureKey) => planFeatures[featureKey] !== false)
    .map(getFeatureLabel);
};

export default function ManageInstitutes() {
  const navigation = useNavigation();
  const layout = useResponsiveLayout();
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [usageWarning, setUsageWarning] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInstituteId, setEditInstituteId] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingInstituteId, setDeletingInstituteId] = useState('');
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [featureInstitute, setFeatureInstitute] = useState(null);
  const [featureTier, setFeatureTier] = useState(DEFAULT_FEATURE_TIER);
  const [featureOverrides, setFeatureOverrides] = useState({});
  const [featureSubscriptionStatus, setFeatureSubscriptionStatus] = useState('active');
  const [featureSaveError, setFeatureSaveError] = useState('');
  const [rateLimitTier, setRateLimitTier] = useState(DEFAULT_RATE_LIMIT_TIER);
  const [rateLimitOverrides, setRateLimitOverrides] = useState({});
  const [savingFeatures, setSavingFeatures] = useState(false);

  const sortedInstitutes = useMemo(
    () => [...institutes].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [institutes]
  );
  const tierOptions = useMemo(
    () => [
      ...PLAN_ORDER
        .filter((key) => FEATURE_TIERS[key])
        .map((key) => ({ key, ...FEATURE_TIERS[key] })),
      ...Object.entries(FEATURE_TIERS)
        .filter(([key]) => !PLAN_ORDER.includes(key))
        .map(([key, value]) => ({ key, ...value })),
    ],
    []
  );
  const rateLimitTierOptions = useMemo(
    () => Object.entries(RATE_LIMIT_TIERS).map(([key, value]) => ({ key, ...value })),
    []
  );
  const groupedFeatures = useMemo(
    () => FEATURE_DEFINITIONS.reduce((groups, feature) => {
      const category = feature.category || 'Other';
      groups[category] = groups[category] || [];
      groups[category].push(feature);
      return groups;
    }, {}),
    []
  );
  const effectiveFeatureAccess = useMemo(
    () => resolveFeatureEntitlements({
      settings: {
        features: {
          tier: featureTier,
          overrides: featureOverrides,
        },
      },
    }),
    [featureOverrides, featureTier]
  );
  const selectedPlan = FEATURE_TIERS[featureTier] || {};
  const selectedPlanLimits = selectedPlan.limits || {};
  const selectedUsage = featureInstitute?.usage || createUsageEntry();
  const featureAudit = getFeatureAudit(featureInstitute || {});
  const featureUpdatedAt = featureAudit.updatedAt
    ? new Date(featureAudit.updatedAt).toLocaleString()
    : 'Not recorded';

  const fetchInstitutes = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true);
    setLoadError('');
    setUsageWarning('');
    try {
      const institutesRef = collection(db, 'institutes');
      const snapshot = await getDocs(institutesRef);
      const today = getTodayKey();
      const [usersResult, aiUsageResult] = await Promise.allSettled([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'aiUsageDailyCounters'), where('day', '==', today))),
      ]);
      const usersSnapshot = usersResult.status === 'fulfilled' ? usersResult.value : null;
      const aiUsageSnapshot = aiUsageResult.status === 'fulfilled' ? aiUsageResult.value : null;
      const usageState = buildUsageByInstituteId({ aiUsageSnapshot, usersSnapshot });
      const warnings = [];

      if (usersResult.status === 'rejected') warnings.push('User usage unavailable');
      if (aiUsageResult.status === 'rejected') warnings.push('AI usage unavailable');
      if (warnings.length) setUsageWarning(warnings.join('. '));

      const institutesList = snapshot.docs.map((instituteDoc) => {
        const data = instituteDoc.data();
        const instituteId = data.instituteId || instituteDoc.id;
        return {
          id: instituteDoc.id,
          ...data,
          instituteId,
          usage: resolveUsage({
            ...usageState,
            instituteId,
          }),
        };
      });

      setInstitutes(institutesList);
    } catch (error) {
      console.error('Error fetching institutes:', error);
      setLoadError(error.message || 'Failed to load institutes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInstitutes();
  }, []);

  const handleEditInstitute = (institute) => {
    setEditInstituteId(institute.id);
    setEditName(institute.name || '');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditInstituteId('');
    setEditName('');
  };

  const handleEditFeatures = (institute) => {
    const access = resolveFeatureEntitlements(institute);
    const rateLimits = resolveInstituteRateLimits(institute);
    const subscription = getInstituteSubscription(institute);
    setFeatureInstitute(institute);
    setFeatureTier(access.tier);
    setFeatureOverrides(access.overrides || {});
    setFeatureSubscriptionStatus(subscription.status);
    setFeatureSaveError('');
    setRateLimitTier(rateLimits.tier);
    setRateLimitOverrides(rateLimits.overrides || {});
    setShowFeaturesModal(true);
  };

  const closeFeaturesModal = () => {
    setShowFeaturesModal(false);
    setFeatureInstitute(null);
    setFeatureTier(DEFAULT_FEATURE_TIER);
    setFeatureOverrides({});
    setFeatureSubscriptionStatus('active');
    setFeatureSaveError('');
    setRateLimitTier(DEFAULT_RATE_LIMIT_TIER);
    setRateLimitOverrides({});
  };

  const selectTier = (tier) => {
    const tierFeatures = getTierFeatureMap(tier);
    const nextOverrides = { ...featureOverrides };
    Object.keys(nextOverrides).forEach((key) => {
      const tierValue = tierFeatures[key] !== false;
      if (nextOverrides[key] === tierValue) delete nextOverrides[key];
    });
    setFeatureTier(tier);
    setFeatureOverrides(nextOverrides);
  };

  const toggleFeature = (featureKey) => {
    const tierFeatures = getTierFeatureMap(featureTier);
    const tierValue = tierFeatures[featureKey] !== false;
    const currentValue = effectiveFeatureAccess.enabledFeatures[featureKey] !== false;
    const nextValue = !currentValue;
    setFeatureOverrides((current) => {
      const next = { ...current };
      if (nextValue === tierValue) {
        delete next[featureKey];
      } else {
        next[featureKey] = nextValue;
      }
      return next;
    });
  };

  const updateRateLimitOverride = (scope, limitValue) => {
    const numeric = String(limitValue || '').replace(/[^\d]/g, '');
    setRateLimitOverrides((current) => {
      const next = { ...current };
      if (!numeric) {
        delete next[scope.key];
        return next;
      }

      next[scope.key] = {
        limit: Number(numeric),
        windowMs: scope.windowMs,
      };
      return next;
    });
  };

  const handleSaveFeatures = async () => {
    if (!featureInstitute) return;

    setSavingFeatures(true);
    setFeatureSaveError('');
    try {
      const instituteId = featureInstitute.instituteId || featureInstitute.id;
      const result = await updateInstituteFeatureSettings(instituteId, {
        features: {
          overrides: featureOverrides,
          tier: featureTier,
        },
        rateLimits: {
          overrides: rateLimitOverrides,
          tier: rateLimitTier,
        },
        subscription: {
          status: featureSubscriptionStatus,
        },
      });

      if (!result.success) {
        setFeatureSaveError(result.error || 'Failed to update subscription access.');
        Alert.alert('Error', result.error || 'Failed to update feature access.');
        return;
      }

      Alert.alert('Success', 'Institute feature access and rate limits updated.');
      closeFeaturesModal();
      fetchInstitutes({ showLoader: false });
    } catch (error) {
      console.error('Error updating institute features:', error);
      setFeatureSaveError(error.message || 'Failed to update subscription access.');
      Alert.alert('Error', 'Failed to update feature access.');
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Institute name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'institutes', editInstituteId), {
        name: editName.trim(),
        updatedAt: new Date(),
      });
      Alert.alert('Success', 'Institute name updated successfully.');
      closeEditModal();
      fetchInstitutes({ showLoader: false });
    } catch (error) {
      console.error('Error updating institute:', error);
      Alert.alert('Error', 'Failed to update institute name.');
    } finally {
      setSaving(false);
    }
  };

  const performDeleteInstitute = async (institute) => {
    const instituteId = institute.instituteId || institute.id;
    setDeletingInstituteId(institute.id);
    try {
      const result = await deleteInstituteAsSuperAdmin(instituteId);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to delete institute.');
        return;
      }

      const userCount = result.deleted?.users || 0;
      Alert.alert('Success', `Institute deleted successfully. ${userCount} linked user profile${userCount === 1 ? '' : 's'} removed.`);
      fetchInstitutes({ showLoader: false });
    } catch (error) {
      console.error('Error deleting institute:', error);
      Alert.alert('Error', 'Failed to delete institute.');
    } finally {
      setDeletingInstituteId('');
    }
  };

  const handleDeleteInstitute = (institute) => {
    const message = `Delete ${institute.name || 'this institute'} and all linked users, attendance, payments, notices, routines, assignments, grades, gallery items, and papers? This cannot be undone.`;

    Alert.alert(
      'Delete Institute',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => performDeleteInstitute(institute),
        },
      ]
    );
  };

  const refreshInstitutes = () => {
    setRefreshing(true);
    fetchInstitutes({ showLoader: false });
  };

  const renderInstitute = ({ item }) => {
    const institutionType = String(item.institutionType || item.type || 'SCHOOL').toUpperCase();
    const isCollege = institutionType === 'COLLEGE';
    const featureAccess = resolveFeatureEntitlements(item);
    const enabledCount = Object.values(featureAccess.enabledFeatures).filter(Boolean).length;
    const totalFeatureCount = FEATURE_DEFINITIONS.length;
    const subscription = getInstituteSubscription(item);
    const statusOption = SUBSCRIPTION_STATUS_OPTIONS.find((option) => option.key === subscription.status) || SUBSCRIPTION_STATUS_OPTIONS[0];
    const plan = FEATURE_TIERS[featureAccess.tier] || {};
    const limits = plan.limits || {};
    const usage = item.usage || createUsageEntry();

    return (
      <View style={[styles.instituteCard, layout.isMobile && styles.instituteCardMobile, layout.listColumns > 1 && styles.instituteCardDesktop]}>
        <View style={[styles.iconBox, isCollege && styles.iconBoxCollege, layout.isMobile && styles.iconBoxMobile]}>
          <Ionicons name={isCollege ? 'library' : 'school'} size={22} color={isCollege ? '#C4B5FD' : '#67E8F9'} />
        </View>

        <View style={styles.instituteInfo}>
          <Text style={styles.instituteName} numberOfLines={1}>
            {item.name || 'Unnamed Institute'}
          </Text>
          <Text style={styles.instituteId} numberOfLines={1}>ID: {item.instituteId}</Text>
          <View style={[styles.modePill, isCollege && styles.modePillCollege]}>
            <Text style={[styles.modePillText, isCollege && styles.modePillTextCollege]}>
              {isCollege ? 'College' : 'School'}
            </Text>
          </View>
          <Text style={styles.instituteMeta}>
            Created {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'recently'}
          </Text>
          <View style={styles.featureSummary}>
            <Ionicons name="options-outline" size={13} color="#93C5FD" />
            <Text style={styles.featureSummaryText} numberOfLines={1}>
              {featureAccess.tierLabel} tier - {enabledCount}/{totalFeatureCount} features
            </Text>
          </View>
          <View style={styles.subscriptionSummary}>
            <View style={styles.subscriptionLine}>
              <Ionicons name="card-outline" size={13} color="#A7F3D0" />
              <Text style={styles.subscriptionSummaryText} numberOfLines={1}>
                {featureAccess.tierLabel} plan - {statusOption.label}
              </Text>
            </View>
            <View style={styles.usageMiniGrid}>
              <Text style={styles.usageMiniText} numberOfLines={1}>Users {formatUsage(usage.users, limits.maxUsers)}</Text>
              <Text style={styles.usageMiniText} numberOfLines={1}>AI today {formatUsage(usage.aiRequestsToday, limits.aiRequestsPerDay)}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.actionButtons, layout.isMobile && styles.actionButtonsMobile]}>
          <TouchableOpacity style={[styles.featuresButton, layout.isMobile && styles.smallActionButtonMobile]} onPress={() => handleEditFeatures(item)}>
            <Ionicons name="layers-outline" size={20} color="#A7F3D0" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.editButton, layout.isMobile && styles.smallActionButtonMobile]} onPress={() => handleEditInstitute(item)}>
            <Ionicons name="create-outline" size={20} color="#60A5FA" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteButton, layout.isMobile && styles.smallActionButtonMobile, deletingInstituteId === item.id && styles.disabledBtn]}
            onPress={() => handleDeleteInstitute(item)}
            disabled={deletingInstituteId === item.id}
          >
            {deletingInstituteId === item.id ? (
              <SmoothSpinner size={18} stroke={3} color="#F87171" trackColor="#7F1D1D" />
            ) : (
              <Ionicons name="trash-outline" size={20} color="#F87171" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <LoadingState variant="roster" />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        key={String(layout.listColumns)}
        data={sortedInstitutes}
        numColumns={layout.listColumns}
        columnWrapperStyle={layout.listColumns > 1 ? styles.columnWrapper : undefined}
        keyExtractor={(item) => item.id}
        renderItem={renderInstitute}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshInstitutes} tintColor="#67E8F9" />}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: layout.horizontalPadding },
          layout.isDesktop && styles.listContentDesktop,
          layout.isDesktop && { maxWidth: layout.maxContentWidth },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={[styles.header, layout.isMobile && styles.headerMobile, layout.isDesktop && styles.headerDesktop]}>
              <Text style={styles.eyebrow}>Institutes</Text>
              <Text style={[styles.title, layout.isMobile && styles.titleMobile]}>Manage Campuses</Text>
              <Text style={[styles.subtitle, layout.isMobile && styles.subtitleMobile]}>Rename institutes, audit identifiers, and remove duplicate or test campuses.</Text>
            </View>

            <TouchableOpacity style={[styles.addButton, layout.isMobile && styles.addButtonMobile]} onPress={() => { navigation.navigate('SuperAdminHome'); }}>
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.buttonText} numberOfLines={1}>Create Institute With Type</Text>
            </TouchableOpacity>

            {usageWarning ? (
              <View style={styles.warningBanner}>
                <Ionicons name="information-circle-outline" size={18} color="#FDE68A" />
                <Text style={styles.warningBannerText}>{usageWarning}. Plan controls are still available.</Text>
              </View>
            ) : null}

            {loadError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" />
                <Text style={styles.errorBannerText}>{loadError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => fetchInstitutes()}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name={loadError ? 'warning-outline' : 'school-outline'} size={48} color={loadError ? '#F97316' : '#2563EB'} />
            <Text style={styles.emptyTitle}>{loadError ? 'Could not load institutes' : 'No institutes found'}</Text>
            <Text style={styles.emptyText}>{loadError || 'Use the dashboard to add the first campus and administrator.'}</Text>
            {loadError ? (
              <TouchableOpacity style={styles.emptyRetryButton} onPress={() => fetchInstitutes()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      <Modal transparent visible={showEditModal} onRequestClose={closeEditModal} animationType="slide">
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIcon}>
                  <Ionicons name="create" size={26} color="#2563EB" />
                </View>
                <Text style={styles.modalTitle}>Edit Institute</Text>
                <Text style={styles.modalSubtitle}>Update the display name used throughout the platform.</Text>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="school-outline" size={20} color="#64748B" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Institute Name"
                  placeholderTextColor="#94A3B8"
                  value={editName}
                  onChangeText={setEditName}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveEdit}
                />
              </View>

              <TouchableOpacity style={[styles.modalBtn, saving && styles.disabledBtn]} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <SmoothSpinner size={18} stroke={3} color="#FFFFFF" trackColor="#CBD5E1" /> : <Text style={styles.modalBtnText}>Save Changes</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeEditModal} disabled={saving}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal transparent visible={showFeaturesModal} onRequestClose={closeFeaturesModal} animationType="slide">
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.featureModalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.featureModalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIcon}>
                  <Ionicons name="layers" size={26} color="#2563EB" />
                </View>
                <Text style={[styles.modalTitle, styles.featureModalTitle]}>Subscription Management</Text>
                <Text style={[styles.modalSubtitle, styles.featureModalSubtitle]}>
                  {featureInstitute?.name || 'Institute'} - plan defaults, feature overrides, usage, and rate limits.
                </Text>
              </View>

              <View style={styles.subscriptionPanel}>
                <View style={styles.subscriptionPanelHeader}>
                  <View style={styles.subscriptionPanelCopy}>
                    <Text style={styles.featureGroupTitle}>Subscription Status</Text>
                    <Text style={styles.featureToggleDescription}>
                      Status is saved with the institute entitlement record. Last entitlement update: {featureUpdatedAt}.
                    </Text>
                  </View>
                  <View style={styles.currentPlanBadge}>
                    <Text style={styles.currentPlanBadgeText}>{effectiveFeatureAccess.tierLabel}</Text>
                  </View>
                </View>

                <View style={styles.statusGrid}>
                  {SUBSCRIPTION_STATUS_OPTIONS.map((status) => {
                    const selected = featureSubscriptionStatus === status.key;
                    return (
                      <TouchableOpacity
                        key={status.key}
                        onPress={() => setFeatureSubscriptionStatus(status.key)}
                        style={[
                          styles.statusButton,
                          selected && styles.statusButtonSelected,
                          selected && status.tone === 'warn' && styles.statusButtonWarn,
                          selected && status.tone === 'danger' && styles.statusButtonDanger,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusButtonText,
                            selected && styles.statusButtonTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {status.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.usageGrid}>
                  <View style={styles.usageCard}>
                    <Text style={styles.usageLabel}>Users</Text>
                    <Text style={styles.usageValue}>{formatUsage(selectedUsage.users, selectedPlanLimits.maxUsers)}</Text>
                  </View>
                  <View style={styles.usageCard}>
                    <Text style={styles.usageLabel}>AI today</Text>
                    <Text style={styles.usageValue}>{formatUsage(selectedUsage.aiRequestsToday, selectedPlanLimits.aiRequestsPerDay)}</Text>
                  </View>
                  <View style={styles.usageCard}>
                    <Text style={styles.usageLabel}>Storage</Text>
                    <Text style={styles.usageValue}>{formatLimit(selectedPlanLimits.storageQuotaGB, ' GB')}</Text>
                  </View>
                  <View style={styles.usageCard}>
                    <Text style={styles.usageLabel}>SMS / month</Text>
                    <Text style={styles.usageValue}>{formatLimit(selectedPlanLimits.smsQuotaPerMonth)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.tierGrid}>
                {tierOptions.map((tier) => {
                  const selected = featureTier === tier.key;
                  const enabledFeatureCount = getPlanEnabledCount(tier.key);
                  const highlights = getPlanHighlights(tier.key);
                  const limits = tier.limits || {};
                  return (
                    <TouchableOpacity
                      key={tier.key}
                      onPress={() => selectTier(tier.key)}
                      style={[styles.tierCard, selected && styles.tierCardSelected]}
                    >
                      <View style={styles.tierCardHeader}>
                        <Text style={[styles.tierTitle, selected && styles.tierTitleSelected]}>{tier.label}</Text>
                        {selected ? <Ionicons name="checkmark-circle" size={18} color="#2563EB" /> : null}
                      </View>
                      <Text style={styles.tierDescription}>{tier.description}</Text>
                      <View style={styles.planMetrics}>
                        <Text style={styles.planMetric}>{enabledFeatureCount}/{FEATURE_DEFINITIONS.length} features</Text>
                        <Text style={styles.planMetric}>{formatLimit(limits.aiRequestsPerDay)} AI/day</Text>
                        <Text style={styles.planMetric}>{formatLimit(limits.maxUsers)} users</Text>
                      </View>
                      {highlights.length ? (
                        <View style={styles.planHighlights}>
                          {highlights.map((label) => (
                            <View key={label} style={styles.planHighlightPill}>
                              <Text style={styles.planHighlightText}>{label}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.featureGroups}>
                {Object.entries(groupedFeatures).map(([category, features]) => (
                  <View key={category} style={styles.featureGroup}>
                    <Text style={styles.featureGroupTitle}>{category}</Text>
                    {features.map((feature) => {
                      const enabled = effectiveFeatureAccess.enabledFeatures[feature.key] !== false;
                      const isOverride = featureOverrides[feature.key] !== undefined;
                      const source = effectiveFeatureAccess.featureSources?.[feature.key];
                      const sourceLabel = source?.source === 'override'
                        ? 'Institute override'
                        : `${effectiveFeatureAccess.tierLabel} default`;
                      return (
                        <TouchableOpacity
                          key={feature.key}
                          onPress={() => toggleFeature(feature.key)}
                          style={[styles.featureToggle, enabled ? styles.featureToggleEnabled : styles.featureToggleDisabled]}
                        >
                          <View style={styles.featureToggleCopy}>
                            <Text style={styles.featureToggleTitle}>{feature.label}</Text>
                            <Text style={styles.featureToggleDescription}>{feature.description}</Text>
                            <View style={styles.sourceRow}>
                              <Text style={[styles.sourceLabel, isOverride && styles.overrideLabel]}>
                                {sourceLabel}
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.toggleRail, enabled && styles.toggleRailEnabled]}>
                            <View style={[styles.toggleThumb, enabled && styles.toggleThumbEnabled]} />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={styles.rateLimitSection}>
                <View style={styles.rateLimitHeader}>
                  <View>
                    <Text style={styles.featureGroupTitle}>Subscription Rate Limits</Text>
                    <Text style={styles.featureToggleDescription}>
                      Control mutation and automation traffic per institute. Empty overrides use the selected tier.
                    </Text>
                  </View>
                </View>

                <View style={styles.rateTierGrid}>
                  {rateLimitTierOptions.map((tier) => {
                    const selected = rateLimitTier === tier.key;
                    return (
                      <TouchableOpacity
                        key={tier.key}
                        onPress={() => setRateLimitTier(tier.key)}
                        style={[styles.rateTierCard, selected && styles.rateTierCardSelected]}
                      >
                        <View style={styles.tierCardHeader}>
                          <Text style={[styles.tierTitle, selected && styles.tierTitleSelected]}>{tier.label}</Text>
                          {selected ? <Ionicons name="checkmark-circle" size={18} color="#2563EB" /> : null}
                        </View>
                        <Text style={styles.tierDescription}>{tier.description}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {RATE_LIMIT_SCOPES.map((scope) => {
                  const overrideLimit = rateLimitOverrides[scope.key]?.limit;
                  return (
                    <View key={scope.key} style={styles.rateScopeRow}>
                      <View style={styles.rateScopeCopy}>
                        <Text style={styles.featureToggleTitle}>{scope.label}</Text>
                        <Text style={styles.featureToggleDescription}>
                          {scope.description} Window: {formatWindow(scope.windowMs)}. Bounds: {scope.min}-{scope.max}.
                        </Text>
                      </View>
                      <TextInput
                        accessibilityLabel={`${scope.label} rate limit`}
                        keyboardType="number-pad"
                        maxLength={3}
                        onChangeText={(value) => updateRateLimitOverride(scope, value)}
                        placeholder="Tier"
                        placeholderTextColor="#64748B"
                        style={styles.rateInput}
                        value={overrideLimit ? String(overrideLimit) : ''}
                      />
                    </View>
                  );
                })}
              </View>

              {featureSaveError ? (
                <View style={styles.modalErrorBanner}>
                  <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
                  <Text style={styles.modalErrorText}>{featureSaveError}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[styles.modalBtn, savingFeatures && styles.disabledBtn]} onPress={handleSaveFeatures} disabled={savingFeatures}>
                {savingFeatures ? <SmoothSpinner size={18} stroke={3} color="#FFFFFF" trackColor="#CBD5E1" /> : <Text style={styles.modalBtnText}>Save Access Rules</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeFeaturesModal} disabled={savingFeatures}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02030A', overflow: 'hidden' },
  listContent: { paddingVertical: 16, paddingBottom: 32 },
  listContentDesktop: { width: '100%', alignSelf: 'center', paddingTop: 24 },
  header: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#075985',
  },
  headerMobile: { padding: 18, borderRadius: 8 },
  headerDesktop: { padding: 30 },
  eyebrow: { color: '#67E8F9', fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '900', color: '#F8FAFC', marginTop: 8 },
  titleMobile: { fontSize: 24, lineHeight: 29 },
  subtitle: { fontSize: 14, color: '#B9C6DD', marginTop: 8, lineHeight: 21 },
  subtitleMobile: { fontSize: 13, lineHeight: 19 },
  addButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  addButtonMobile: { paddingHorizontal: 12, paddingVertical: 13, borderRadius: 8 },
  buttonText: { flexShrink: 1, color: '#FFFFFF', fontWeight: '900', fontSize: 15, marginLeft: 8 },
  instituteCard: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  instituteCardMobile: { padding: 13, borderRadius: 8, alignItems: 'flex-start' },
  columnWrapper: { gap: 12 },
  instituteCardDesktop: { flex: 1 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#082F49',
    borderWidth: 1,
    borderColor: '#075985',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconBoxCollege: {
    backgroundColor: '#1E1B4B',
    borderColor: '#6D28D9',
  },
  iconBoxMobile: { width: 40, height: 40, borderRadius: 8, marginRight: 10 },
  instituteInfo: { flex: 1, minWidth: 0 },
  instituteName: { fontSize: 17, fontWeight: '900', color: '#F8FAFC' },
  instituteId: { fontSize: 12, color: '#8EA4C8', marginTop: 3, fontWeight: '700' },
  featureSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 7,
  },
  featureSummaryText: {
    color: '#BCD7FF',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  subscriptionSummary: {
    backgroundColor: '#020617',
    borderColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 8,
  },
  subscriptionLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  subscriptionSummaryText: {
    color: '#D1FAE5',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
  },
  usageMiniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  usageMiniText: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    color: '#B9C6DD',
    flexGrow: 1,
    fontSize: 11,
    fontWeight: '800',
    minWidth: 116,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  modePill: {
    alignSelf: 'flex-start',
    marginTop: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#082F49',
    borderWidth: 1,
    borderColor: '#075985',
  },
  modePillCollege: {
    backgroundColor: '#1E1B4B',
    borderColor: '#6D28D9',
  },
  modePillText: { fontSize: 11, color: '#67E8F9', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  modePillTextCollege: { color: '#C4B5FD' },
  instituteMeta: { fontSize: 12, color: '#64748B', marginTop: 5 },
  actionButtons: { flexDirection: 'row', marginLeft: 10 },
  actionButtonsMobile: { marginLeft: 8 },
  featuresButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#082F49',
    borderWidth: 1,
    borderColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#450A0A',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionButtonMobile: { width: 38, height: 38, borderRadius: 8 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 34,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyTitle: { fontSize: 20, color: '#F8FAFC', fontWeight: '900', marginTop: 14 },
  emptyText: { fontSize: 14, color: '#8EA4C8', textAlign: 'center', marginTop: 8, lineHeight: 21 },
  emptyRetryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  warningBanner: {
    alignItems: 'center',
    backgroundColor: '#422006',
    borderColor: '#A16207',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 12,
  },
  warningBannerText: {
    color: '#FEF3C7',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginLeft: 8,
  },
  errorBanner: {
    alignItems: 'center',
    backgroundColor: '#450A0A',
    borderColor: '#7F1D1D',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
    padding: 12,
  },
  errorBannerText: {
    color: '#FECACA',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    minWidth: 180,
  },
  retryButton: {
    backgroundColor: '#991B1B',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  modalContainer: { flex: 1, backgroundColor: '#0F172A' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  featureModalScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureModalContent: {
    width: '100%',
    maxWidth: 820,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeader: { alignItems: 'center', marginBottom: 18 },
  modalIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  modalSubtitle: { color: '#64748B', fontSize: 13, marginTop: 5, textAlign: 'center' },
  featureModalTitle: { color: '#0F172A' },
  featureModalSubtitle: { color: '#475569' },
  subscriptionPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  subscriptionPanelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  subscriptionPanelCopy: {
    flex: 1,
    minWidth: 220,
  },
  currentPlanBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currentPlanBadgeText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  statusButton: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 40,
    minWidth: 104,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  statusButtonSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  statusButtonWarn: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  statusButtonDanger: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  statusButtonText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '900',
  },
  statusButtonTextSelected: {
    color: '#0F172A',
  },
  usageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  usageCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 150,
    flexGrow: 1,
    padding: 10,
  },
  usageLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  usageValue: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  tierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  tierCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 220,
    flexGrow: 1,
    minHeight: 108,
    padding: 14,
  },
  tierCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  tierCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tierTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
  },
  tierTitleSelected: {
    color: '#1D4ED8',
  },
  tierDescription: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
  },
  planMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  planMetric: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    color: '#334155',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  planHighlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },
  planHighlightPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  planHighlightText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '900',
  },
  featureGroups: {
    gap: 14,
  },
  rateInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    minHeight: 44,
    outlineStyle: 'none',
    paddingHorizontal: 12,
    textAlign: 'center',
    width: 78,
  },
  rateLimitHeader: {
    marginBottom: 12,
  },
  rateLimitSection: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  rateScopeCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  rateScopeRow: {
    alignItems: 'center',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    minHeight: 74,
    padding: 12,
  },
  rateTierCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 180,
    flexGrow: 1,
    minHeight: 98,
    padding: 12,
  },
  rateTierCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  rateTierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  featureGroup: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  featureGroupTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  featureToggle: {
    alignItems: 'center',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
    minHeight: 74,
    padding: 12,
  },
  featureToggleEnabled: {
    backgroundColor: '#F8FAFC',
  },
  featureToggleDisabled: {
    backgroundColor: '#F1F5F9',
  },
  featureToggleCopy: {
    flex: 1,
    minWidth: 0,
  },
  featureToggleTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
  },
  featureToggleDescription: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 3,
  },
  overrideLabel: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceRow: {
    flexDirection: 'row',
    marginTop: 7,
  },
  sourceLabel: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    color: '#475569',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  toggleRail: {
    backgroundColor: '#CBD5E1',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 52,
  },
  toggleRailEnabled: {
    backgroundColor: '#2563EB',
  },
  toggleThumb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 22,
    width: 22,
  },
  toggleThumbEnabled: {
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 12,
  },
  icon: { paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 15, fontSize: 15, color: '#0F172A', outlineStyle: 'none' },
  modalBtn: { backgroundColor: '#2563EB', paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  modalErrorBanner: {
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 14,
    padding: 12,
  },
  modalErrorText: {
    color: '#991B1B',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginLeft: 8,
  },
  disabledBtn: { opacity: 0.6 },
  modalBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 13 },
  modalCancelBtnText: { fontSize: 15, color: '#64748B', fontWeight: '800' },
});
