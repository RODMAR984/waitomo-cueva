// NovedadesScreen — Lista de gym_news con cards y accordion (tap para expandir)

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || '').replace('#', '');
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const formatDate = (iso, dateLocale = 'es-ES') => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(dateLocale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

export default function NovedadesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const focusNewsId = route.params?.focusId;
  const { t: tStr, locale } = useLocale();
  const { t } = useThemeContext();
  const { organization, profile } = useAuth() || {};
  const orgId = organization?.id ?? profile?.organization_id ?? null;
  const dateLocale = locale === 'en' ? 'en-US' : 'es-ES';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!orgId) {
          if (alive) setItems([]);
          return;
        }
        const { data, error } = await supabase
          .from('gym_news')
          .select('id, title, body, image_url, tag, pinned, created_at')
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false });
        if (!alive) return;
        if (error) throw error;
        setItems(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [orgId]);

  useEffect(() => {
    if (!focusNewsId || !items.length) return;
    const hit = items.some((row) => row.id === focusNewsId);
    if (hit) setExpandedId(focusNewsId);
  }, [focusNewsId, items]);

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
        backBtn: {
          padding: 8,
          marginLeft: -8,
        },
        title: {
          color: t.brandText ?? t.brand,
          fontSize: 22,
          fontWeight: '800',
          letterSpacing: 0.8,
          textShadowColor: t.brandTextShadow ?? 'rgba(0,255,252,0.75)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 6,
        },
        list: { paddingHorizontal: 20, paddingBottom: 40 },
        card: {
          borderRadius: 18,
          paddingVertical: 16,
          paddingHorizontal: 16,
          marginBottom: 12,
          borderWidth: 1.5,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        cardTitle: {
          color: t.brandText ?? t.brand,
          fontSize: 16,
          fontWeight: '700',
          flex: 1,
          letterSpacing: 0.3,
          textShadowColor: t.brandTextShadow ?? 'rgba(0,255,252,0.5)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 4,
        },
        cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
        tag: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: hexToRgba(t.brand, 0.2),
        },
        tagText: { color: t.brandText ?? t.brand, fontSize: 11, fontWeight: '600' },
        dateText: { color: t.placeholder, fontSize: 12 },
        pinnedBadge: { color: t.brandText ?? t.brand, marginLeft: 4 },
        bodyWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.overlayBorder },
        bodyText: { color: t.subText, fontSize: 14, lineHeight: 22 },
        cardImage: {
          width: '100%',
          height: 180,
          borderRadius: 12,
          marginTop: 10,
          backgroundColor: hexToRgba(t.text, 0.1),
        },
        empty: { paddingVertical: 40, alignItems: 'center' },
        emptyText: { color: t.placeholder, fontSize: 16 },
      }),
    [t]
  );

  const imageUrl = (row) => {
    const url = row?.image_url;
    if (!url) return null;
    if (String(url).startsWith('http')) return url;
    try {
      const { data } = supabase.storage.from('news').getPublicUrl(url);
      return data?.publicUrl || null;
    } catch {
      return null;
    }
  };

  return (
    <BackgroundWrapper screen="ClientScreen">
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={26} color={t.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{tStr('novedades_title')}</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={t.brand} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{tStr('novedades_empty')}</Text>
          </View>
        ) : (
          items.map((row) => {
            const expanded = expandedId === row.id;
            const imgUrl = imageUrl(row);
            return (
              <TouchableOpacity
                key={row.id}
                style={styles.card}
                onPress={() => setExpandedId(expanded ? null : row.id)}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={expanded ? 10 : 2}>
                    {row.title || tStr('novedades_no_title')}
                  </Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={t.subText}
                    style={{ marginLeft: 8 }}
                  />
                </View>
                <View style={styles.cardMeta}>
                  {row.tag ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{row.tag}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.dateText}>{formatDate(row.created_at, dateLocale)}</Text>
                  {row.pinned ? (
                    <Ionicons name="pin" size={14} color={t.brand} style={styles.pinnedBadge} />
                  ) : null}
                </View>
                {expanded && (
                  <>
                    {row.body ? (
                      <View style={styles.bodyWrap}>
                        <Text style={styles.bodyText}>{row.body}</Text>
                      </View>
                    ) : null}
                    {imgUrl ? (
                      <Image source={{ uri: imgUrl }} style={styles.cardImage} resizeMode="cover" />
                    ) : null}
                  </>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </BackgroundWrapper>
  );
}
