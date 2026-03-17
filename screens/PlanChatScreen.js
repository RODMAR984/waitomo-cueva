// screens/PlanChatScreen.js
// Chat por Plan – aislado del chat del día.
// Usa el fondo rotativo del BackgroundWrapper.

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../supabaseClient';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../contexts/ThemeContext';

export default function PlanChatScreen({ route }) {
  const { plan } = route.params;
  const { t } = useThemeContext();
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  const channelId = `chat_plan_${plan?.id}`;

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat' }, payload => {
        if (payload.new.channel_id === channelId) {
          setMessages(prev => [...prev, payload.new]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadMessages() {
    const { data } = await supabase
      .from('chat')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (data) setMessages(data);
  }

  async function sendMessage() {
    if (!text.trim()) return;

    await supabase.from('chat').insert({
      user_id: user.id,
      message: text.trim(),
      channel_id: channelId,
    });

    setText('');
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, padding: 20 },
        title: { color: t.text, fontSize: 22, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
        msgList: { flex: 1 },
        msg: { marginBottom: 10, backgroundColor: t.boxBg, padding: 10, borderRadius: 8 },
        msgUser: { color: t.brand, fontWeight: 'bold' },
        msgText: { color: t.text },
        row: { flexDirection: 'row', alignItems: 'center' },
        input: {
          flex: 1,
          backgroundColor: t.inputBg,
          padding: 12,
          borderRadius: 8,
          color: t.text,
        },
        btn: { padding: 10, borderRadius: 8, ...t.buttonPrimary },
      }),
    [t],
  );

  return (
    <BackgroundWrapper screen="planchat" plan={plan}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>{plan.title} – Chat</Text>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.msg}>
              <Text style={styles.msgUser}>{item.user_id === user.id ? 'Vos' : 'Usuario'}:</Text>
              <Text style={styles.msgText}>{item.message}</Text>
            </View>
          )}
          style={styles.msgList}
        />

        <View style={styles.row}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={t.placeholder}
            style={styles.input}
          />

          <TouchableOpacity onPress={sendMessage} style={styles.btn}>
            <Ionicons name="send" color={t.primaryText} size={24} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
