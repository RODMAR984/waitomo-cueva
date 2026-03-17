// ChatScreen — Mensajes de un canal; envía mensajes y suscripción en tiempo real

import React, { useEffect, useState, useRef, useMemo } from 'react';
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

import BackgroundWrapper from '../components/BackgroundWrapper';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
import { useThemeContext } from '../contexts/ThemeContext';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const formatTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth() || {};
  const channelId = route.params?.channelId;
  const channelName = route.params?.channelName || 'Chat';

  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const displayNameFor = (userId, fallback = 'Usuario') => {
    if (userId === user?.id) return profile?.full_name || profile?.username || 'Vos';
    return profiles[userId] || fallback;
  };

  const fetchProfiles = async (userIds) => {
    if (!userIds?.length) return {};
    const { data } = await supabase.from('profiles').select('id, full_name, username').in('id', userIds);
    const map = {};
    (data || []).forEach((p) => {
      const name = (p.full_name || p.username || '').trim();
      map[p.id] = name || 'Usuario';
    });
    return map;
  };

  useEffect(() => {
    AsyncStorage.setItem('waitomo_chat_last_open', new Date().toISOString()).catch(() => {});
  }, []);

  useEffect(() => {
    if (!channelId) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
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
        setProfiles((prev) => ({ ...prev, ...profs }));
      } catch {
        if (alive) setMessages([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [channelId]);

  useEffect(() => {
    if (user?.id && (profile?.full_name || profile?.username)) {
      setProfiles((prev) => ({
        ...prev,
        [user.id]: profile.full_name || profile.username || 'Vos',
      }));
    }
  }, [user?.id, profile?.full_name, profile?.username]);

  useEffect(() => {
    if (!channelId) return;
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
              setProfiles((p) => ({ ...p, ...next }));
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
  }, [channelId]);

  const send = async () => {
    const text = (body || '').trim();
    if (!text || !user?.id || !channelId || sending) return;
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
        setProfiles((prev) => (prev[user.id] ? prev : { ...prev, [user.id]: profile?.full_name || profile?.username || 'Vos' }));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Chat send error', e?.message || e);
      Alert.alert('Error al enviar', e?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const { t } = useThemeContext();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 56,
          paddingBottom: 12,
        },
        backBtn: { padding: 8, marginLeft: -8 },
        title: { color: t.brand ?? t.text, fontSize: 20, fontWeight: '800', marginLeft: 8 },
        list: { flex: 1, paddingHorizontal: 16, paddingVertical: 8 },
        msgRow: { marginBottom: 12, maxWidth: '85%' },
        msgRowMe: { alignSelf: 'flex-end' },
        msgBubble: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderBottomRightRadius: 4,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        msgBubbleMe: {
          backgroundColor: hexToRgba(t.brand, 0.35),
          borderColor: hexToRgba(t.brand, 0.65),
          borderBottomRightRadius: 16,
          borderBottomLeftRadius: 4,
        },
        msgSender: { color: t.placeholder, fontSize: 11, marginBottom: 2 },
        msgSenderMe: { color: t.onBrand, fontSize: 11, marginBottom: 2 },
        msgBody: { color: t.text, fontSize: 15 },
        msgBodyMe: { color: t.text, fontSize: 15 },
        msgTime: { color: t.placeholder, fontSize: 10, marginTop: 4 },
        msgTimeMe: { color: t.onBrand, fontSize: 10, marginTop: 4 },
        inputRow: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: 16,
          paddingVertical: 12,
          paddingBottom: Math.max(insets.bottom || 0, Platform.OS === 'android' ? 28 : 12) + (Platform.OS === 'ios' ? 16 : 0),
          borderTopWidth: 1,
          borderTopColor: t.overlayBorder,
          backgroundColor: hexToRgba(colors.dark.background, 0.95),
        },
        input: {
          flex: 1,
          minHeight: 44,
          maxHeight: 100,
          borderRadius: 22,
          borderWidth: 1.5,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          color: t.text,
          paddingHorizontal: 18,
          paddingVertical: 10,
          fontSize: 15,
        },
        sendBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          ...t.buttonPrimary,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 10,
        },
        empty: { paddingVertical: 40, alignItems: 'center' },
        emptyText: { color: t.placeholder, fontSize: 15 },
      }),
    [t, insets.bottom]
  );

  const renderMessage = ({ item }) => {
    const isMe = item.user_id === user?.id;
    const name = displayNameFor(item.user_id, 'Miembro');
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
          <Text style={isMe ? styles.msgSenderMe : styles.msgSender}>{name}</Text>
          <Text style={isMe ? styles.msgBodyMe : styles.msgBody}>{item.body}</Text>
          <Text style={isMe ? styles.msgTimeMe : styles.msgTime}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <BackgroundWrapper screen="ClientScreen">
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={26} color={t.brand ?? t.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{channelName}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1 }}>
          {loading ? (
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
                <Text style={styles.emptyText}>Nadie escribió aún. ¡Escribí el primer mensaje!</Text>
              </View>
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Escribí un mensaje..."
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
            <Ionicons name="send" size={20} color={colors.brand.primary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
