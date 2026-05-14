// Detalle `support_tickets` + mensajes (panel plataforma).

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../../hooks/useStaffWebHideInlineBack';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE, screenHeaderTopPadding } from '../../theme/mobileSpec';

const STATUSES = ['open', 'pending', 'closed'];

function isMissingRelation(err) {
  const c = String(err?.code || '');
  const m = String(err?.message || '').toLowerCase();
  return c === '42P01' || m.includes('does not exist');
}

export default function SuperadminTicketDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const ticketId = route.params?.ticketId || null;
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { isPlatformAdmin, session } = useAuth() || {};

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const allowed = typeof isPlatformAdmin === 'function' ? isPlatformAdmin() : false;
  const uid = session?.user?.id || null;

  const load = useCallback(async () => {
    if (!allowed || !ticketId) {
      setTicket(null);
      setMessages([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: trow, error: te } = await supabase
        .from('support_tickets')
        .select('id, organization_id, created_by, status, subject, body, created_at, updated_at, organizations(name)')
        .eq('id', ticketId)
        .maybeSingle();
      if (te) throw te;
      if (!trow) {
        setTicket(null);
        setError('missing');
        setMessages([]);
        return;
      }
      setTicket(trow);
      const { data: msgs, error: me } = await supabase
        .from('support_ticket_messages')
        .select('id, author_id, body, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (me) throw me;
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      if (isMissingRelation(e)) setError('migration');
      else setError(e?.message || 'err');
      setTicket(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, ticketId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const setStatus = async (next) => {
    if (!ticketId || !allowed) return;
    try {
      const { error: e } = await supabase
        .from('support_tickets')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', ticketId);
      if (e) throw e;
      setTicket((prev) => (prev ? { ...prev, status: next } : prev));
      Alert.alert(tStr('common_ok'), tStr('superadmin_ticket_status_updated'));
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('superadmin_ticket_reply_error'));
    }
  };

  const sendReply = async () => {
    const body = String(reply || '').trim();
    if (!body || !ticketId || !uid) return;
    setSending(true);
    try {
      const { error: e } = await supabase.from('support_ticket_messages').insert({
        ticket_id: ticketId,
        author_id: uid,
        body,
      });
      if (e) throw e;
      setReply('');
      await load();
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('superadmin_ticket_reply_error'));
    } finally {
      setSending(false);
    }
  };

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
        scroll: { flex: 1, width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: MOBILE_SPACING.lg },
        err: { color: t.brand, marginBottom: MOBILE_SPACING.md },
        subj: { color: t.text, fontSize: MOBILE_TYPE.headline, fontWeight: '800', marginBottom: MOBILE_SPACING.sm },
        meta: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginBottom: MOBILE_SPACING.md },
        body: { color: t.subText, fontSize: MOBILE_TYPE.body, lineHeight: 22, marginBottom: MOBILE_SPACING.lg },
        rowStatus: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: MOBILE_SPACING.lg },
        chip: {
          paddingHorizontal: MOBILE_SPACING.md,
          paddingVertical: MOBILE_SPACING.sm,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        chipOn: { borderColor: t.brand, backgroundColor: hexToRgba(t.brand, 0.12) },
        chipText: { color: t.text, fontWeight: '700', fontSize: MOBILE_TYPE.caption },
        section: { color: t.text, fontWeight: '800', marginBottom: MOBILE_SPACING.sm },
        msg: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          padding: MOBILE_SPACING.md,
          marginBottom: MOBILE_SPACING.sm,
          backgroundColor: t.boxBg,
        },
        msgBody: { color: t.text, fontSize: MOBILE_TYPE.body, lineHeight: 20 },
        msgMeta: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 6 },
        input: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          padding: MOBILE_SPACING.md,
          color: t.text,
          backgroundColor: t.inputBg,
          minHeight: 88,
          textAlignVertical: 'top',
          marginBottom: MOBILE_SPACING.sm,
        },
        sendBtn: {
          alignSelf: 'flex-start',
          paddingVertical: MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.lg,
          borderRadius: MOBILE_RADII.md,
          backgroundColor: t.brand,
          marginBottom: MOBILE_SPACING.xl,
        },
        sendText: { color: '#fff', fontWeight: '800' },
      }),
    [t, insets.top],
  );

  if (!allowed) {
    return (
      <BackgroundWrapper screen="Admin">
        <View style={[styles.scroll, { paddingTop: screenHeaderTopPadding(insets.top) }]}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.err}>{tStr('superadmin_access_denied')}</Text>
        </View>
      </BackgroundWrapper>
    );
  }

  if (!ticketId) {
    return (
      <BackgroundWrapper screen="Admin">
        <View style={[styles.scroll, { paddingTop: screenHeaderTopPadding(insets.top) }]}>
          <BackNavButton onPress={() => navigation.navigate('SuperadminTickets')} label={tStr('superadmin_tickets_title')} />
          <Text style={styles.err}>{tStr('superadmin_ticket_missing')}</Text>
        </View>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper screen="Admin">
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}
      >
        <View style={styles.header}>
          {!hideInlineBack ? (
            <BackNavButton onPress={() => navigation.navigate('SuperadminTickets')} label={tStr('superadmin_tickets_title')} />
          ) : null}
          <Text style={styles.title} numberOfLines={1}>
            {tStr('superadmin_ticket_detail_title')}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator color={t.brand} style={{ marginTop: 24 }} />
        ) : error === 'migration' ? (
          <View style={styles.scroll}>
            <Text style={styles.err}>{tStr('superadmin_data_migration_hint')}</Text>
          </View>
        ) : error === 'missing' || !ticket ? (
          <View style={styles.scroll}>
            <Text style={styles.err}>{tStr('superadmin_ticket_missing')}</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => String(m.id)}
            style={styles.scroll}
            ListHeaderComponent={
              <View>
                <Text style={styles.subj}>{ticket.subject}</Text>
                <Text style={styles.meta}>
                  {tStr('superadmin_ticket_org')}: {ticket.organizations?.name || ticket.organization_id}
                </Text>
                <Text style={styles.meta}>
                  {tStr('superadmin_ticket_created')}: {String(ticket.created_at || '').replace('T', ' ').slice(0, 19)}
                </Text>
                <Text style={styles.meta}>{tStr('superadmin_ticket_status')}:</Text>
                <View style={styles.rowStatus}>
                  {STATUSES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, ticket.status === s ? styles.chipOn : null]}
                      onPress={() => setStatus(s)}
                    >
                      <Text style={styles.chipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {ticket.body ? <Text style={styles.body}>{ticket.body}</Text> : null}
                <Text style={styles.section}>{tStr('superadmin_ticket_messages')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.msg}>
                <Text style={styles.msgBody}>{item.body}</Text>
                <Text style={styles.msgMeta}>
                  {item.author_id?.slice(0, 8)}… · {String(item.created_at || '').replace('T', ' ').slice(0, 19)}
                </Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.meta}>{tStr('superadmin_ticket_no_messages')}</Text>}
            ListFooterComponent={
              <View>
                <TextInput
                  style={styles.input}
                  multiline
                  placeholder={tStr('superadmin_ticket_reply_placeholder')}
                  placeholderTextColor={t.placeholder}
                  value={reply}
                  onChangeText={setReply}
                  editable={!sending}
                />
                <TouchableOpacity style={styles.sendBtn} onPress={sendReply} disabled={sending || !reply.trim()}>
                  <Text style={styles.sendText}>{tStr('superadmin_ticket_reply_send')}</Text>
                </TouchableOpacity>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}

function hexToRgba(hex, alpha = 1) {
  const clean = String(hex || '#000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}
