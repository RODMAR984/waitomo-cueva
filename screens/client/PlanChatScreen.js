// screens/PlanChatScreen.js
// Chat por Plan – aislado del chat del día.
// Fondo rotativo vía ScreenShell.

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabaseClient';
import ScreenShell from '../../components/ScreenShell';
import BackNavButton from '../../components/BackNavButton';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

export default function PlanChatScreen({ route }) {
  const navigation = useNavigation();
  const { plan } = route.params;
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
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
        container: {
          flex: 1,
          padding: MOBILE_SPACING.xl,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        title: { color: t.text, fontSize: MOBILE_TYPE.title, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
        msgList: { flex: 1 },
        msg: { marginBottom: 10, backgroundColor: t.boxBg, padding: 10, borderRadius: MOBILE_RADII.lg },
        msgUser: { color: t.brand, fontWeight: 'bold' },
        msgText: { color: t.text },
        row: { flexDirection: 'row', alignItems: 'center' },
        input: {
          flex: 1,
          backgroundColor: t.inputBg,
          padding: 12,
          borderRadius: MOBILE_RADII.md,
          color: t.text,
        },
        btn: { padding: 10, borderRadius: MOBILE_RADII.md, ...t.buttonPrimary },
      }),
    [t],
  );

  return (
    <ScreenShell
      screen="planchat"
      plan={plan}
      list
      keyboardAvoid="default"
      keyboardAvoidProps={{ style: styles.container }}
      listProps={{
        data: messages,
        keyExtractor: (item) => item.id,
        renderItem: ({ item }) => (
          <View style={styles.msg}>
            <Text style={styles.msgUser}>
              {item.user_id === user.id ? tStr('plan_chat_you') : tStr('plan_chat_other')}:
            </Text>
            <Text style={styles.msgText}>{item.message}</Text>
          </View>
        ),
        style: styles.msgList,
        ListHeaderComponent: (
          <>
            <BackNavButton onPress={() => navigation.goBack()} />
            <Text style={styles.title}>
              {plan.title}
              {tStr('plan_chat_title_suffix')}
            </Text>
          </>
        ),
      }}
      companion={
        <View style={styles.row}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={tStr('plan_chat_placeholder')}
            placeholderTextColor={t.placeholder}
            style={styles.input}
          />

          <TouchableOpacity onPress={sendMessage} style={styles.btn}>
            <Ionicons name="send" color={t.primaryText} size={24} />
          </TouchableOpacity>
        </View>
      }
    />
  );
}
