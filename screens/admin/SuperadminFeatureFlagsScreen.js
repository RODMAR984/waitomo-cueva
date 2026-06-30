// `platform_feature_flags`: lectura para staff; edición JSON para admins de plataforma.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenShell from '../../components/ScreenShell';
import BackNavButton from '../../components/BackNavButton';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../../hooks/useStaffWebHideInlineBack';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE, screenHeaderTopPadding } from '../../theme/mobileSpec';

function isMissingRelation(err) {
  const c = String(err?.code || '');
  const m = String(err?.message || '').toLowerCase();
  return c === '42P01' || m.includes('does not exist');
}

export default function SuperadminFeatureFlagsScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { isPlatformAdmin, session } = useAuth() || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingKey, setSavingKey] = useState(null);

  const allowed = typeof isPlatformAdmin === 'function' ? isPlatformAdmin() : false;

  const load = useCallback(async () => {
    if (!allowed) {
      setRows([]);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('platform_feature_flags')
        .select('key, value, updated_at, updated_by')
        .order('key', { ascending: true });
      if (e) throw e;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      if (isMissingRelation(e)) setError('migration');
      else setError(e?.message || 'err');
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowed]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: 'transparent' },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: screenHeaderTopPadding(insets.top),
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingBottom: 8,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        title: { flex: 1, color: t.text, fontSize: MOBILE_TYPE.title, fontWeight: '900' },
        listWrap: { flex: 1, width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: MOBILE_SPACING.lg },
        hint: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginBottom: MOBILE_SPACING.md, lineHeight: 18 },
        err: { color: t.brand, fontSize: MOBILE_TYPE.body, marginBottom: MOBILE_SPACING.md },
        row: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          padding: MOBILE_SPACING.md,
          marginBottom: MOBILE_SPACING.sm,
          backgroundColor: t.boxBg,
        },
        key: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800' },
        meta: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 4 },
        val: { color: t.placeholder, fontSize: MOBILE_TYPE.meta, marginTop: 8, lineHeight: 18 },
        empty: { color: t.subText, fontSize: MOBILE_TYPE.body, textAlign: 'center', marginTop: 24 },
        input: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          padding: MOBILE_SPACING.sm,
          color: t.text,
          backgroundColor: t.inputBg,
          minHeight: 120,
          fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
          textAlignVertical: 'top',
          marginTop: MOBILE_SPACING.sm,
        },
        rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: MOBILE_SPACING.sm },
        btn: {
          paddingVertical: MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.md,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        btnPrimary: { backgroundColor: t.brand, borderColor: t.brand },
        btnText: { color: t.text, fontWeight: '700', fontSize: MOBILE_TYPE.caption },
        btnTextOn: { color: '#fff', fontWeight: '800', fontSize: MOBILE_TYPE.caption },
      }),
    [t, insets.top],
  );

  const saveFlag = useCallback(
    async (key) => {
      let parsed;
      try {
        parsed = JSON.parse(editDraft || '{}');
      } catch {
        Alert.alert(tStr('gym_config_alert_title_error'), tStr('superadmin_flags_json_error'));
        return;
      }
      const uid = session?.user?.id || null;
      setSavingKey(key);
      try {
        const { error: e } = await supabase
          .from('platform_feature_flags')
          .update({
            value: parsed,
            updated_at: new Date().toISOString(),
            ...(uid ? { updated_by: uid } : {}),
          })
          .eq('key', key);
        if (e) throw e;
        setEditingKey(null);
        setEditDraft('');
        Alert.alert(tStr('common_ok'), tStr('superadmin_flags_saved'));
        await load();
      } catch (e) {
        Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('superadmin_flags_load_error'));
      } finally {
        setSavingKey(null);
      }
    },
    [editDraft, load, session?.user?.id, tStr],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const isEditing = editingKey === item.key;
      return (
        <View style={styles.row}>
          <Text style={styles.key}>{item.key}</Text>
          <Text style={styles.meta}>
            {tStr('superadmin_flags_updated')}: {String(item.updated_at || '').replace('T', ' ').slice(0, 19)}
          </Text>
          {isEditing ? (
            <>
              <TextInput
                style={styles.input}
                multiline
                value={editDraft}
                onChangeText={setEditDraft}
                editable={!savingKey}
                autoCorrect={false}
                spellCheck={false}
              />
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => saveFlag(item.key)}
                  disabled={!!savingKey}
                >
                  <Text style={styles.btnTextOn}>{tStr('superadmin_flags_save')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => {
                    setEditingKey(null);
                    setEditDraft('');
                  }}
                  disabled={!!savingKey}
                >
                  <Text style={styles.btnText}>{tStr('superadmin_flags_cancel')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.val}>
                {tStr('superadmin_flags_value_label')}: {JSON.stringify(item.value ?? {}).slice(0, 400)}
              </Text>
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => {
                    setEditingKey(item.key);
                    setEditDraft(JSON.stringify(item.value ?? {}, null, 2));
                  }}
                >
                  <Text style={styles.btnText}>{tStr('superadmin_flags_edit')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      );
    },
    [editDraft, editingKey, saveFlag, savingKey, styles, tStr],
  );

  if (!allowed) {
    return (
      <ScreenShell screen="Admin">
        <View style={[styles.listWrap, { paddingTop: screenHeaderTopPadding(insets.top) }]}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.err}>{tStr('superadmin_access_denied')}</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell screen="Admin">
      <View style={styles.root} testID="screen-superadmin-flags">
        <View style={styles.header}>
          {!hideInlineBack ? (
            <BackNavButton
              testID="superadmin-nav-to-hub"
              onPress={() => navigation.navigate('Superadmin')}
              label={tStr('superadmin_back_hub')}
            />
          ) : null}
          <Text style={styles.title}>{tStr('superadmin_flags_title')}</Text>
        </View>
        <View style={styles.listWrap}>
          <Text style={styles.hint}>{tStr('superadmin_flags_hint')}</Text>
          {error === 'migration' ? <Text style={styles.err}>{tStr('superadmin_data_migration_hint')}</Text> : null}
          {error && error !== 'migration' ? <Text style={styles.err}>{tStr('superadmin_flags_load_error')}</Text> : null}
          {loading && !refreshing ? (
            <ActivityIndicator color={t.brand} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={rows}
              extraData={{ editingKey, editDraft, savingKey }}
              keyExtractor={(it) => String(it.key)}
              renderItem={renderItem}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              ListEmptyComponent={
                !loading && !error ? <Text style={styles.empty}>{tStr('superadmin_flags_empty')}</Text> : null
              }
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}
        </View>
      </View>
    </ScreenShell>
  );
}
