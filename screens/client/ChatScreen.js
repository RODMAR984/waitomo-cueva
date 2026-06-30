// ChatScreen — Mensajes de un canal; envía mensajes y suscripción en tiempo real

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ScreenShell from '../../components/ScreenShell';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import BackNavButton from '../../components/BackNavButton';
import { normalizePlanKey } from '../../utils/planKeyNormalize';
import { fetchLatestUserAbono } from '../../utils/userAbonoFetch';
import { resolveFreeClassGrant } from '../../services/booking/trialClassGrant';
import { evaluateCalendarioAccess } from '../../utils/clientWorkoutEntitlement';
import { draftChatReplyWithAi } from '../../utils/aiAssistant';
import { trackEvent } from '../../utils/observability';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Badge «STAFF» en burbujas del chat para roles de equipo */
const STAFF_CHAT_ROLES = new Set(['coach', 'admin', 'superadmin']);

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t: tStr, locale } = useLocale();
  const { user, profile, organization, organizationMemberships } = useAuth() || {};
  const channelId = route.params?.channelId;
  const channelName = route.params?.channelName || tStr('chat_title');

  const formatTime = (iso) => {
    if (!iso) return '';
    try {
      const loc = locale === 'en' ? 'en-US' : 'es-AR';
      return new Date(iso).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const [messages, setMessages] = useState([]);
  /** userId -> display name */
  const [profiles, setProfiles] = useState({});
  /** userId -> profiles.role (coach, admin, …) */
  const [profileRoles, setProfileRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiTemplate, setAiTemplate] = useState('');
  const listRef = useRef(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessOk, setAccessOk] = useState(false);
  const [channelOrgId, setChannelOrgId] = useState(null);

  const staffRoles = useMemo(() => new Set(['owner', 'coach', 'admin', 'superadmin']), []);

  const isStaffForOrg = useCallback(
    (orgId) => {
      if (!orgId) return false;
      const r = String(profile?.role || '').toLowerCase();
      if (r === 'superadmin') return true;
      const list = Array.isArray(organizationMemberships) ? organizationMemberships : [];
      return list.some(
        (m) =>
          m?.active &&
          m?.organization_id === orgId &&
          staffRoles.has(String(m?.role || '').toLowerCase()),
      );
    },
    [organizationMemberships, profile?.role, staffRoles],
  );

  const displayNameFor = (userId, fallback) => {
    const fb = fallback ?? tStr('common_user');
    if (userId === user?.id) return profile?.full_name || profile?.username || tStr('chat_you');
    return profiles[userId] || fb;
  };

  const fetchProfiles = async (userIds) => {
    if (!userIds?.length) return { names: {}, roles: {} };
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, username, role')
      .in('id', userIds);
    const names = {};
    const roles = {};
    (data || []).forEach((p) => {
      const name = (p.full_name || p.username || '').trim();
      names[p.id] = name || tStr('common_user');
      roles[p.id] = p.role || null;
    });
    return { names, roles };
  };

  useEffect(() => {
    AsyncStorage.setItem('waitomo_chat_last_open', new Date().toISOString()).catch(() => {});
  }, []);

  useEffect(() => {
    if (!channelId) {
      setAccessLoading(false);
      setAccessOk(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      setAccessLoading(true);
      try {
        const { data: ch, error: chErr } = await supabase
          .from('chat_channels')
          .select('organization_id, plan_id')
          .eq('id', channelId)
          .maybeSingle();
        if (!alive) return;
        if (chErr || !ch?.organization_id) {
          setChannelOrgId(null);
          setAccessOk(false);
          return;
        }
        const orgId = ch.organization_id;
        setChannelOrgId(orgId);
        if (isStaffForOrg(orgId)) {
          setAccessOk(true);
          return;
        }
        const orgForUser = organization?.id ?? profile?.organization_id ?? null;
        const channelPlan = normalizePlanKey(ch.plan_id);
        const [abonoRow, grant] = await Promise.all([
          user?.id ? fetchLatestUserAbono(user.id) : Promise.resolve(null),
          resolveFreeClassGrant(user?.id),
        ]);
        const ent = evaluateCalendarioAccess({
          planCanonKey: channelPlan,
          organizationId: orgForUser,
          abonoRow,
          abonoLoading: false,
          freeClassGrant: grant,
        });
        setAccessOk(!!ent.ok);
      } catch {
        if (alive) {
          setChannelOrgId(null);
          setAccessOk(false);
        }
      } finally {
        if (alive) setAccessLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [channelId, user?.id, profile?.plan_actual, profile?.planActual, organization?.id, profile?.organization_id, isStaffForOrg]);

  useEffect(() => {
    if (!channelId || !accessOk) {
      setLoading(false);
      setMessages([]);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('id, channel_id, user_id, body, created_at')
          .eq('channel_id', channelId)
          .order('created_at', { ascending: true });
        if (!alive) return;
        if (error) throw error;
        const list = Array.isArray(data) ? data : [];
        setMessages(list);
        const ids = [...new Set(list.map((m) => m.user_id))];
        const profs = await fetchProfiles(ids);
        if (!alive) return;
        setProfiles((prev) => ({ ...prev, ...profs.names }));
        setProfileRoles((prev) => ({ ...prev, ...profs.roles }));
      } catch {
        if (alive) setMessages([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [channelId, accessOk]);

  useEffect(() => {
    if (user?.id && (profile?.full_name || profile?.username)) {
      setProfiles((prev) => ({
        ...prev,
        [user.id]: profile.full_name || profile.username || 'Vos',
      }));
    }
    if (user?.id && profile?.role) {
      setProfileRoles((prev) => ({ ...prev, [user.id]: profile.role }));
    }
  }, [user?.id, profile?.full_name, profile?.username, profile?.role]);

  useEffect(() => {
    if (!channelId || !accessOk) return;
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const newRow = payload.new;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newRow.id)) return prev;
            return [...prev, newRow];
          });
          setProfiles((prev) => {
            if (prev[newRow.user_id]) return prev;
            fetchProfiles([newRow.user_id]).then((next) => {
              setProfiles((p) => ({ ...p, ...next.names }));
              setProfileRoles((r) => ({ ...r, ...next.roles }));
            });
            return prev;
          });
          listRef.current?.scrollToEnd({ animated: true });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, accessOk]);

  const send = async () => {
    const text = (body || '').trim();
    if (!text || !user?.id || !channelId || sending || !accessOk) return;
    setSending(true);
    try {
      const { data: inserted, error } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: channelId,
          user_id: user.id,
          body: text,
        })
        .select('id, channel_id, user_id, body, created_at')
        .single();
      if (error) throw error;
      setBody('');
      if (inserted) {
        setMessages((prev) => [...prev, inserted]);
        setProfiles((prev) =>
          prev[user.id] ? prev : { ...prev, [user.id]: profile?.full_name || profile?.username || tStr('chat_you') },
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Chat send error', e?.message || e);
      Alert.alert(tStr('chat_send_error_title'), e?.message || tStr('chat_send_error_body'));
    } finally {
      setSending(false);
    }
  };

  const buildConversationContext = useCallback(() => {
    const recent = (messages || []).slice(-12);
    const lines = recent.map((m) => {
      const name = displayNameFor(m.user_id, tStr('chat_member'));
      return `${name}: ${String(m.body || '').trim()}`;
    });
    return lines.join('\n');
  }, [messages, tStr]);

  const suggestReply = async () => {
    if (!channelOrgId) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('chat_ai_need_org'));
      return;
    }
    const context = buildConversationContext();
    if (!context.trim()) {
      Alert.alert(tStr('chat_ai_title'), tStr('chat_empty_thread'));
      return;
    }
    setAiBusy(true);
    try {
      const out = await draftChatReplyWithAi({
        organizationId: channelOrgId,
        channelName,
        conversationText: context,
        draftIntent: body,
        templateType: aiTemplate,
        locale,
      });
      const text = String(out?.result?.result_text || '').trim();
      if (!text) throw new Error(tStr('chat_ai_error'));
      trackEvent('chat_ai_reply_suggested', { organization_id: channelOrgId, channel_id: channelId });
      Alert.alert(tStr('chat_ai_title'), text.length > 900 ? `${text.slice(0, 900)}…` : text, [
        { text: tStr('common_cancel'), style: 'cancel' },
        { text: tStr('chat_ai_replace'), onPress: () => setBody(text) },
        {
          text: tStr('chat_ai_append'),
          onPress: () =>
            setBody((prev) => {
              const p = String(prev || '').trim();
              return p ? `${p}\n\n${text}` : text;
            }),
        },
      ]);
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('quota')) {
        Alert.alert(tStr('admin_ai_quota_title'), tStr('admin_ai_quota_body'));
      } else {
        Alert.alert(tStr('chat_send_error_title'), msg || tStr('chat_ai_error'));
      }
    } finally {
      setAiBusy(false);
    }
  };

  const { t } = useThemeContext();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingTop: 56,
          paddingBottom: 8,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        title: { color: t.brand ?? t.text, fontSize: MOBILE_TYPE.title, fontWeight: '800', marginTop: 6, marginBottom: 8 },
        list: { flex: 1, paddingHorizontal: MOBILE_SPACING.lg, paddingVertical: 8, width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, alignSelf: 'center' },
        msgRow: { marginBottom: 12, maxWidth: '85%' },
        msgRowMe: { alignSelf: 'flex-end' },
        msgBubble: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: MOBILE_RADII.lg,
          borderBottomRightRadius: 4,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        msgBubbleMe: {
          backgroundColor: hexToRgba(t.brand, 0.35),
          borderColor: hexToRgba(t.brand, 0.65),
          borderBottomRightRadius: MOBILE_RADII.lg,
          borderBottomLeftRadius: 4,
        },
        senderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 2,
        },
        msgSender: { color: t.placeholder, fontSize: MOBILE_TYPE.caption },
        msgSenderMe: { color: t.onBrand, fontSize: MOBILE_TYPE.caption },
        staffBadge: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: MOBILE_RADII.xs,
          backgroundColor: hexToRgba(t.brand, 0.2),
          borderWidth: 1,
          borderColor: hexToRgba(t.brand, 0.45),
        },
        staffBadgeText: { color: t.brand, fontSize: MOBILE_TYPE.micro, fontWeight: '800', letterSpacing: 0.3 },
        msgBody: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong },
        msgBodyMe: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong },
        msgTime: { color: t.placeholder, fontSize: MOBILE_TYPE.micro, marginTop: 4 },
        msgTimeMe: { color: t.onBrand, fontSize: MOBILE_TYPE.micro, marginTop: 4 },
        inputRow: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingVertical: 12,
          paddingBottom: Math.max(insets.bottom || 0, Platform.OS === 'android' ? 28 : 12) + (Platform.OS === 'ios' ? 16 : 0),
          borderTopWidth: 1,
          borderTopColor: t.overlayBorder,
          backgroundColor: hexToRgba(t.bg, 0.96),
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        input: {
          flex: 1,
          minHeight: 44,
          maxHeight: 100,
          borderRadius: MOBILE_RADII.bubble,
          borderWidth: 1.5,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          color: t.text,
          paddingHorizontal: 18,
          paddingVertical: 10,
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        sendBtn: {
          width: 44,
          height: 44,
          borderRadius: MOBILE_RADII.bubble,
          ...t.buttonPrimary,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 10,
        },
        aiBtn: {
          minWidth: 44,
          height: 44,
          borderRadius: MOBILE_RADII.bubble,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 8,
          backgroundColor: t.boxBg,
        },
        templatesRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingTop: 8,
          paddingBottom: 2,
        },
        templateChip: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.pill,
          paddingVertical: 6,
          paddingHorizontal: 10,
          backgroundColor: t.boxBg,
        },
        templateChipOn: {
          borderColor: t.brand,
          backgroundColor: hexToRgba(t.brand, 0.14),
        },
        templateChipText: { color: t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        templateChipTextOn: { color: t.brand },
        empty: { paddingVertical: 40, alignItems: 'center' },
        emptyText: { color: t.placeholder, fontSize: MOBILE_TYPE.bodyStrong },
      }),
    [t, insets.bottom, locale]
  );

  const renderMessage = ({ item }) => {
    const isMe = item.user_id === user?.id;
    const name = displayNameFor(item.user_id, tStr('chat_member'));
    const r = profileRoles[item.user_id];
    const showStaff = r && STAFF_CHAT_ROLES.has(r);
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
          <View style={styles.senderRow}>
            <Text style={isMe ? styles.msgSenderMe : styles.msgSender}>{name}</Text>
            {showStaff ? (
              <View style={styles.staffBadge}>
                <Text style={styles.staffBadgeText}>STAFF</Text>
              </View>
            ) : null}
          </View>
          <Text style={isMe ? styles.msgBodyMe : styles.msgBody}>{item.body}</Text>
          <Text style={isMe ? styles.msgTimeMe : styles.msgTime}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  const isStaffHere = !!channelOrgId && isStaffForOrg(channelOrgId);
  const templateOptions = useMemo(
    () => [
      { id: '', label: tStr('chat_ai_template_none') },
      { id: 'payment_reminder', label: tStr('chat_ai_template_payment') },
      { id: 'schedule_change', label: tStr('chat_ai_template_schedule') },
      { id: 'win_back', label: tStr('chat_ai_template_winback') },
    ],
    [tStr],
  );

  return (
    <ScreenShell screen="ClientScreen">
      <View style={styles.header}>
        <BackNavButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{channelName}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1 }}>
          {accessLoading ? (
            <View style={[styles.empty, { flex: 1, justifyContent: 'center' }]}>
              <ActivityIndicator size="large" color={t.brand} />
            </View>
          ) : !accessOk ? (
            <View style={[styles.empty, { flex: 1, justifyContent: 'center', paddingHorizontal: 22 }]}>
              <Text style={[styles.emptyText, { textAlign: 'center', fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800', color: t.text }]}>
                {tStr('client_community_locked_title')}
              </Text>
              <Text style={[styles.emptyText, { textAlign: 'center', marginTop: 10, lineHeight: 20 }]}>
                {tStr('client_community_locked_body')}
              </Text>
            </View>
          ) : loading ? (
            <View style={[styles.empty, { flex: 1, justifyContent: 'center' }]}>
              <ActivityIndicator size="large" color={t.brand} />
            </View>
          ) : (
          <FlatList
            ref={listRef}
            style={styles.list}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{tStr('chat_empty_thread')}</Text>
              </View>
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
          )}
        </View>

        {isStaffHere ? (
          <View style={styles.templatesRow}>
            {templateOptions.map((opt) => {
              const on = aiTemplate === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id || 'none'}
                  style={[styles.templateChip, on && styles.templateChipOn]}
                  onPress={() => setAiTemplate(opt.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.templateChipText, on && styles.templateChipTextOn]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <View style={styles.inputRow}>
          {isStaffHere ? (
            <TouchableOpacity
              style={[styles.aiBtn, (aiBusy || sending || !accessOk) && { opacity: 0.5 }]}
              onPress={suggestReply}
              disabled={aiBusy || sending || !accessOk}
              activeOpacity={0.85}
            >
              {aiBusy ? (
                <ActivityIndicator size="small" color={t.brand} />
              ) : (
                <Ionicons name="sparkles-outline" size={20} color={t.brand} />
              )}
            </TouchableOpacity>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder={isStaffHere ? tStr('chat_placeholder_staff') : tStr('chat_placeholder')}
            placeholderTextColor={t.placeholder}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!body.trim() || sending) && { opacity: 0.5 }]}
            onPress={send}
            disabled={!body.trim() || sending}
          >
            <Ionicons name="send" size={20} color={t.brand} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
