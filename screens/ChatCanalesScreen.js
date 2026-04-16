// ChatCanalesScreen — Lista de canales de chat (por plan). RLS filtra según rol y plan_actual.

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { normalizePlanKey } from '../utils/planKeyNormalize';
import { fetchLatestUserAbono } from '../utils/userAbonoFetch';
import { resolveFreeClassGrant } from '../utils/trialClassGrantSupabase';
import { evaluateCalendarioAccess, evaluateClientCommunityAccess } from '../utils/clientWorkoutEntitlement';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function ChatCanalesScreen() {
  const navigation = useNavigation();
  const { t: tStr } = useLocale();
  const { profile, activePlanId, organization, user, hasStaffMembership } = useAuth() || {};
  const orgId = organization?.id ?? profile?.organization_id ?? null;
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abonoRow, setAbonoRow] = useState(null);
  const [abonoLoading, setAbonoLoading] = useState(true);
  const [freeClassGrant, setFreeClassGrant] = useState(null);

  const dbPlan = (profile?.plan_actual ?? profile?.planActual ?? '').trim();
  const hasDbPlan = !!dbPlan;
  const hasLocalPlan = !!(activePlanId && String(activePlanId).trim());

  const planCanon = useMemo(() => normalizePlanKey(profile?.plan_actual ?? profile?.planActual), [
    profile?.plan_actual,
    profile?.planActual,
  ]);

  const communityAccess = useMemo(
    () =>
      evaluateClientCommunityAccess({
        planCanonKey: planCanon,
        organizationId: orgId,
        abonoRow,
        abonoLoading,
        freeClassGrant,
      }),
    [planCanon, orgId, abonoRow, abonoLoading, freeClassGrant],
  );

  const showAllChatChannels = useMemo(() => {
    if (hasStaffMembership) return true;
    const r = String(profile?.role || '').toLowerCase();
    return r === 'owner' || r === 'admin' || r === 'superadmin' || r === 'coach';
  }, [hasStaffMembership, profile?.role]);

  useEffect(() => {
    AsyncStorage.setItem('waitomo_chat_last_open', new Date().toISOString()).catch(() => {});
  }, []);

  const planRefetchKey = profile?.plan_actual ?? profile?.planActual;

  useEffect(() => {
    if (!user?.id) {
      setAbonoLoading(false);
      setAbonoRow(null);
      return undefined;
    }
    let alive = true;
    (async () => {
      setAbonoLoading(true);
      try {
        const row = await fetchLatestUserAbono(user.id);
        if (alive) setAbonoRow(row);
      } catch {
        if (alive) setAbonoRow(null);
      } finally {
        if (alive) setAbonoLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      if (communityAccess.reason === 'loading') {
        setChannels([]);
        return;
      }
      if (!communityAccess.ok) {
        setChannels([]);
        return;
      }
      let q = supabase.from('chat_channels').select('id, plan_id, name').order('name');
      if (orgId) q = q.eq('organization_id', orgId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      if (showAllChatChannels) {
        setChannels(rows);
        return;
      }
      const filtered = rows.filter((ch) =>
        evaluateCalendarioAccess({
          planCanonKey: normalizePlanKey(ch.plan_id),
          organizationId: orgId,
          abonoRow,
          abonoLoading,
          freeClassGrant,
        }).ok,
      );
      setChannels(filtered);
    } catch {
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, communityAccess.ok, communityAccess.reason, showAllChatChannels, abonoRow, abonoLoading, freeClassGrant]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const g = await resolveFreeClassGrant(user?.id);
        if (alive) setFreeClassGrant(g);
      })();
      loadChannels();
      return () => {
        alive = false;
      };
    }, [loadChannels, planRefetchKey, orgId, user?.id]),
  );

  const { t } = useThemeContext();

  const emptyHint = !orgId
    ? tStr('chat_hint_no_org')
    : communityAccess.reason === 'loading'
      ? tStr('client_loading_abono')
      : !communityAccess.ok
        ? tStr('client_community_locked_body')
        : !hasDbPlan && hasLocalPlan
          ? tStr('chat_hint_plan_not_synced')
          : !hasDbPlan
            ? tStr('chat_hint_plan_missing_profile')
            : tStr('chat_hint_no_channels_staff');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 56,
          paddingBottom: 16,
        },
        backBtn: { padding: 8, marginLeft: -8 },
        title: { color: t.brand ?? t.text, fontSize: 22, fontWeight: '800' },
        list: { flex: 1, paddingHorizontal: 20, paddingBottom: 40 },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 18,
          paddingVertical: 18,
          paddingHorizontal: 16,
          marginBottom: 12,
          borderWidth: 1.5,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        cardIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: hexToRgba(t.brand, 0.2),
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        },
        cardName: { color: t.text, fontSize: 17, fontWeight: '700' },
        cardPlan: { color: t.placeholder, fontSize: 12, marginTop: 2 },
        empty: { paddingVertical: 32, alignItems: 'center', paddingHorizontal: 20 },
        emptyText: { color: t.placeholder, fontSize: 16, textAlign: 'center' },
        emptyHint: {
          color: t.subText ?? t.placeholder,
          fontSize: 14,
          marginTop: 12,
          textAlign: 'center',
          lineHeight: 20,
        },
        cta: {
          marginTop: 20,
          paddingVertical: 12,
          paddingHorizontal: 22,
          borderRadius: 12,
          ...t.buttonPrimary,
        },
        ctaText: { ...t.buttonPrimaryText, fontWeight: '700', fontSize: 15 },
      }),
    [t],
  );

  const openChannel = (ch) => {
    navigation.navigate('Chat', { channelId: ch.id, channelName: ch.name });
  };

  return (
    <BackgroundWrapper screen="ClientScreen">
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={26} color={t.brand ?? t.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{tStr('chat_title')}</Text>
        <View style={{ width: 42 }} />
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={t.brand} />
        </View>
      ) : channels.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {!communityAccess.ok ? tStr('client_community_locked_title') : tStr('chat_no_channels')}
          </Text>
          <Text style={styles.emptyHint}>{emptyHint}</Text>
          {!orgId ? null : !communityAccess.ok ? (
            <>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => navigation.navigate('AbonosPases')}
                activeOpacity={0.9}
              >
                <Text style={styles.ctaText}>{tStr('client_entitlement_go_pay')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => navigation.navigate('PlanSelector')}
                activeOpacity={0.9}
              >
                <Text style={styles.ctaText}>{tStr('client_entitlement_go_plans')}</Text>
              </TouchableOpacity>
            </>
          ) : !hasDbPlan ? (
            <TouchableOpacity
              style={styles.cta}
              onPress={() => navigation.navigate('PlanSelector')}
              activeOpacity={0.9}
            >
              <Text style={styles.ctaText}>{tStr('chat_btn_choose_plan')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={channels}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openChannel(item)} activeOpacity={0.9}>
              <View style={styles.cardIcon}>
                <Ionicons name="chatbubbles" size={24} color={t.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name || item.plan_id}</Text>
                <Text style={styles.cardPlan}>{item.plan_id}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={t.placeholder} />
            </TouchableOpacity>
          )}
        />
      )}
    </BackgroundWrapper>
  );
}
