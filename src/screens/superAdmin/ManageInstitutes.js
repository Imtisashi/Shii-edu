import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
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
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { deleteInstituteAsSuperAdmin, updateInstituteFeatureSettings } from '../../services/firebaseAdminService';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import LoadingState, { SmoothSpinner } from '../../components/ui/LoadingState';
import {
  FEATURE_DEFINITIONS,
  FEATURE_TIERS,
  getTierFeatureMap,
  resolveFeatureEntitlements,
} from '../../constants/featureEntitlements';

export default function ManageInstitutes() {
  const navigation = useNavigation();
  const layout = useResponsiveLayout();
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInstituteId, setEditInstituteId] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingInstituteId, setDeletingInstituteId] = useState('');
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [featureInstitute, setFeatureInstitute] = useState(null);
  const [featureTier, setFeatureTier] = useState('complete');
  const [featureOverrides, setFeatureOverrides] = useState({});
  const [savingFeatures, setSavingFeatures] = useState(false);

  const sortedInstitutes = useMemo(
    () => [...institutes].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [institutes]
  );
  const tierOptions = useMemo(
    () => Object.entries(FEATURE_TIERS).map(([key, value]) => ({ key, ...value })),
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

  const fetchInstitutes = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const institutesRef = collection(db, 'institutes');
      const snapshot = await getDocs(institutesRef);
      const institutesList = snapshot.docs.map((instituteDoc) => {
        const data = instituteDoc.data();
        return {
          id: instituteDoc.id,
          ...data,
          instituteId: data.instituteId || instituteDoc.id,
        };
      });

      setInstitutes(institutesList);
    } catch (error) {
      console.error('Error fetching institutes:', error);
      Alert.alert('Error', 'Failed to load institutes.');
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
    setFeatureInstitute(institute);
    setFeatureTier(access.tier);
    setFeatureOverrides(access.overrides || {});
    setShowFeaturesModal(true);
  };

  const closeFeaturesModal = () => {
    setShowFeaturesModal(false);
    setFeatureInstitute(null);
    setFeatureTier('complete');
    setFeatureOverrides({});
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

  const handleSaveFeatures = async () => {
    if (!featureInstitute) return;

    setSavingFeatures(true);
    try {
      const instituteId = featureInstitute.instituteId || featureInstitute.id;
      const result = await updateInstituteFeatureSettings(instituteId, {
        overrides: featureOverrides,
        tier: featureTier,
      });

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to update feature access.');
        return;
      }

      Alert.alert('Success', 'Institute feature access updated.');
      closeFeaturesModal();
      fetchInstitutes({ showLoader: false });
    } catch (error) {
      console.error('Error updating institute features:', error);
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

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        performDeleteInstitute(institute);
      }
      return;
    }

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
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={48} color="#2563EB" />
            <Text style={styles.emptyTitle}>No institutes found</Text>
            <Text style={styles.emptyText}>Use the dashboard to add the first campus and administrator.</Text>
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
                <Text style={[styles.modalTitle, styles.featureModalTitle]}>Feature Access</Text>
                <Text style={[styles.modalSubtitle, styles.featureModalSubtitle]}>
                  {featureInstitute?.name || 'Institute'} - tier preset with per-feature overrides.
                </Text>
              </View>

              <View style={styles.tierGrid}>
                {tierOptions.map((tier) => {
                  const selected = featureTier === tier.key;
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
                      return (
                        <TouchableOpacity
                          key={feature.key}
                          onPress={() => toggleFeature(feature.key)}
                          style={[styles.featureToggle, enabled ? styles.featureToggleEnabled : styles.featureToggleDisabled]}
                        >
                          <View style={styles.featureToggleCopy}>
                            <Text style={styles.featureToggleTitle}>{feature.label}</Text>
                            <Text style={styles.featureToggleDescription}>{feature.description}</Text>
                            {isOverride ? <Text style={styles.overrideLabel}>Override</Text> : null}
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

              <TouchableOpacity style={[styles.modalBtn, savingFeatures && styles.disabledBtn]} onPress={handleSaveFeatures} disabled={savingFeatures}>
                {savingFeatures ? <SmoothSpinner size={18} stroke={3} color="#FFFFFF" trackColor="#CBD5E1" /> : <Text style={styles.modalBtnText}>Save Feature Access</Text>}
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
  modalContainer: { flex: 1, backgroundColor: '#020617' },
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
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featureModalContent: {
    width: '100%',
    maxWidth: 820,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 22,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalHeader: { alignItems: 'center', marginBottom: 18 },
  modalIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#082F49',
    borderWidth: 1,
    borderColor: '#075985',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#F8FAFC' },
  modalSubtitle: { color: '#8EA4C8', fontSize: 13, marginTop: 5, textAlign: 'center' },
  featureModalTitle: { color: '#0F172A' },
  featureModalSubtitle: { color: '#475569' },
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
  featureGroups: {
    gap: 14,
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
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    marginBottom: 12,
  },
  icon: { paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 15, fontSize: 15, color: '#F8FAFC', outlineStyle: 'none' },
  modalBtn: { backgroundColor: '#2563EB', paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  disabledBtn: { opacity: 0.6 },
  modalBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 13 },
  modalCancelBtnText: { fontSize: 15, color: '#8EA4C8', fontWeight: '800' },
});
