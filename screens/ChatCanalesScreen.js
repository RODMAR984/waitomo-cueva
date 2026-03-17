// ChatCanalesScreen — Lista de canales de chat (por plan). RLS filtra según rol y plan_actual.

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { supabase } from '../supabaseClient';
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

export default function ChatCanalesScreen() {
  const navigation = useNavigation();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.setItem('waitomo_chat_last_open', new Date().toISOString()).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('chat_channels')
          .select('id, plan_id, name')
          .order('name');
        if (!alive) return;
        if (error) throw error;
        setChannels(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setChannels([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const { t } = useThemeContext();

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
        empty: { paddingVertical: 40, alignItems: 'center' },
        emptyText: { color: t.placeholder, fontSize: 16 },
      }),
    [t]
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
        <Text style={styles.title}>Chat</Text>
        <View style={{ width: 42 }} />
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={t.brand} />
        </View>
      ) : channels.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No tenés canales disponibles.</Text>
          <Text style={[styles.emptyText, { fontSize: 13, marginTop: 8 }]}>
            Asignate un plan para ver el chat de tu grupo.
          </Text>
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
