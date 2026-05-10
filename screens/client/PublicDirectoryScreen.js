// Directorio público de gims/coaches (opt-in por org). Reseña: cache Google Places; badge FitEngine.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import LogoCompleto from '../../components/LogoCompleto';
import NeoPanel from '../../components/NeoPanel';
import { useLocale } from '../../contexts/LocaleContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { usePlanContext } from '../../contexts/PlanContext';
import { hexToRgba } from '../../theme/colors';
import { fetchPublicOrganizationDirectory } from '../../utils/publicDirectory';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import { resolveOrgLogoUri } from '../../utils/resolveOrgLogoUri';

const DIRECTORY_PAGE_SIZE = 40;

function formatRating(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const r = summary.rating;
  const n = summary.user_ratings_total;
  if (typeof r !== 'number') return null;
  const stars = `★ ${r.toFixed(1)}`;
  if (typeof n === 'number' && n > 0) return `${stars} (${n})`;
  return stars;
}

function buildDirectoryMapsUrl(item) {
  const pid = String(item?.google_place_id || '').trim();
  const addr =
    item?.google_place_summary && typeof item.google_place_summary === 'object'
      ? item.google_place_summary.formatted_address
      : '';
  const name = String(item?.name || '').trim();
  if (pid.length >= 10) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(pid)}`;
  }
  if (typeof addr === 'string' && addr.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.trim())}`;
  }
  if (name) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  }
  return '';
}

export default function PublicDirectoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const planCtx = usePlanContext();
  const plan = planCtx?.plan ?? null;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errMsg, setErrMsg] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [hasMore, setHasMore] = useState(true);

  const loadFirstPage = useCallback(async () => {
    setErrMsg(null);
    setLoading(true);
    const { rows: list, error } = await fetchPublicOrganizationDirectory({
      limit: DIRECTORY_PAGE_SIZE,
      offset: 0,
      type: typeFilter === 'all' ? null : typeFilter,
    });
    if (error) {
      setErrMsg(error.message || tStr('directory_load_error'));
      setRows([]);
      setHasMore(false);
    } else {
      setRows(list);
      setHasMore(list.length >= DIRECTORY_PAGE_SIZE);
    }
    setLoading(false);
    setRefreshing(false);
  }, [typeFilter, tStr]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || refreshing) return;
    setLoadingMore(true);
    const { rows: list, error } = await fetchPublicOrganizationDirectory({
      limit: DIRECTORY_PAGE_SIZE,
      offset: rows.length,
      type: typeFilter === 'all' ? null : typeFilter,
    });
    if (error) {
      setErrMsg(error.message || tStr('directory_load_error'));
    } else if (list.length > 0) {
      setRows((prev) => [...prev, ...list]);
      setHasMore(list.length >= DIRECTORY_PAGE_SIZE);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [hasMore, loadingMore, loading, refreshing, rows.length, typeFilter, tStr]);

  const displayRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = String(r?.name || '').toLowerCase();
      const addr = String(
        r?.google_place_summary && typeof r.google_place_summary === 'object'
          ? r.google_place_summary.formatted_address || ''
          : '',
      ).toLowerCase();
      return name.includes(q) || addr.includes(q);
    });
  }, [rows, filterText]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        kav: {
          flex: 1,
          backgroundColor: 'transparent',
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingTop: Math.max(insets.top, MOBILE_SPACING.md) + MOBILE_SPACING.sm,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        head: { alignItems: 'center', marginBottom: MOBILE_SPACING.xl - 2 },
        title: { color: t.subText, fontSize: MOBILE_TYPE.title, fontWeight: '800', textAlign: 'center' },
        subtitle: {
          color: t.subText,
          fontSize: MOBILE_TYPE.body,
          lineHeight: 20,
          textAlign: 'center',
          marginTop: MOBILE_SPACING.sm,
          opacity: 0.95,
        },
        cardNeo: {
          marginBottom: MOBILE_SPACING.md,
          borderRadius: MOBILE_RADII.lg,
          backgroundColor: t.boxBg,
        },
        cardInner: {
          padding: MOBILE_SPACING.lg,
        },
        row: { flexDirection: 'row', alignItems: 'center' },
        orgLogo: {
          width: 44,
          height: 44,
          borderRadius: MOBILE_RADII.sm,
          marginRight: MOBILE_SPACING.md,
          backgroundColor: hexToRgba(t.brand, 0.12),
        },
        name: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800', flex: 1 },
        type: { color: t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '700', marginTop: MOBILE_SPACING.xs },
        badge: {
          alignSelf: 'flex-start',
          marginTop: MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.sm,
          paddingVertical: MOBILE_SPACING.xs,
          borderRadius: MOBILE_RADII.sm,
          backgroundColor: hexToRgba(t.brand, 0.1),
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        badgeText: { color: t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '800' },
        rating: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: MOBILE_SPACING.sm },
        addr: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: MOBILE_SPACING.xs, lineHeight: 17 },
        cta: { marginTop: MOBILE_SPACING.md, alignItems: 'flex-start' },
        ctaText: { color: t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '700', textDecorationLine: 'underline' },
        mapsLink: { marginTop: MOBILE_SPACING.sm, alignSelf: 'flex-start' },
        mapsLinkText: { color: t.brand, fontSize: MOBILE_TYPE.caption, fontWeight: '700', textDecorationLine: 'underline' },
        searchInput: {
          marginTop: MOBILE_SPACING.md + 2,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: hexToRgba(t.brand, 0.08),
          paddingHorizontal: MOBILE_SPACING.md + 2,
          paddingVertical: MOBILE_SPACING.sm + 2,
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        filterRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: MOBILE_SPACING.sm,
          marginTop: MOBILE_SPACING.md,
          justifyContent: 'center',
        },
        filterChip: {
          paddingVertical: MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.md + 2,
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: hexToRgba(t.brand, 0.08),
        },
        filterChipOn: {
          borderColor: t.brand,
          backgroundColor: hexToRgba(t.brand, 0.2),
        },
        filterChipText: { color: t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        filterChipTextOn: { color: t.text },
        listFooter: { paddingVertical: MOBILE_SPACING.xl },
        empty: { color: t.subText, textAlign: 'center', marginTop: MOBILE_SPACING.xxl, fontSize: MOBILE_TYPE.bodyStrong },
        err: { color: '#f87171', textAlign: 'center', marginTop: MOBILE_SPACING.lg, fontSize: MOBILE_TYPE.body },
        orgInitial: { color: t.subText, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800' },
        brandPowered: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: MOBILE_SPACING.xs },
      }),
    [insets.top, t],
  );

  const handleBack = useCallback(() => {
    if (route.name === 'Directory') {
      try {
        navigation.navigate('Panel');
        return;
      } catch {
        void 0;
      }
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const parent = navigation.getParent?.();
    if (parent?.canGoBack?.()) {
      parent.goBack();
      return;
    }
    try {
      navigation.navigate('Panel');
    } catch {
      try {
        parent?.navigate?.('Panel');
      } catch {
        void 0;
      }
    }
  }, [navigation, route.name]);

  const renderItem = useCallback(
    ({ item }) => {
      const logoUri = resolveOrgLogoUri(item?.logo_url);
      const ratingLine = formatRating(item?.google_place_summary);
      const addr = item?.google_place_summary?.formatted_address;
      const mapsUrl = buildDirectoryMapsUrl(item);
      return (
        <NeoPanel spark style={styles.cardNeo}>
          <View style={styles.cardInner}>
            <View style={styles.row}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.orgLogo} resizeMode="contain" />
              ) : (
                <View style={[styles.orgLogo, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={styles.orgInitial}>
                    {(item?.name || '?').trim().slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.name} numberOfLines={2}>
                {item?.name || '—'}
              </Text>
            </View>
            <Text style={styles.type}>{item?.type === 'coach' ? tStr('directory_type_coach') : tStr('directory_type_gym')}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{tStr('directory_badge_fitengine')}</Text>
            </View>
            {ratingLine ? <Text style={styles.rating}>{ratingLine}</Text> : null}
            {addr ? (
              <Text style={styles.addr} numberOfLines={3}>
                {addr}
              </Text>
            ) : null}
            {mapsUrl ? (
              <TouchableOpacity
                style={styles.mapsLink}
                onPress={() => void Linking.openURL(mapsUrl)}
                activeOpacity={0.85}
              >
                <Text style={styles.mapsLinkText}>{tStr('directory_open_maps')}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.cta}
              onPress={() => navigation.navigate('JoinWithInvite')}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>{tStr('directory_cta_join_code')}</Text>
            </TouchableOpacity>
          </View>
        </NeoPanel>
      );
    },
    [navigation, styles, tStr],
  );

  return (
    <BackgroundWrapper screen="PublicDirectory" plan={plan}>
      <View style={styles.kav}>
        <View style={styles.head}>
          <LogoCompleto height={MOBILE_SIZES.localeControlHeight + MOBILE_SPACING.sm} />
          <Text style={styles.brandPowered}>powered by WAITOMO</Text>
        </View>
        <BackNavButton onPress={handleBack} label={tStr('common_back')} />
        <Text style={styles.title}>{tStr('directory_title')}</Text>
        <Text style={styles.subtitle}>{tStr('directory_subtitle')}</Text>
        <TextInput
          style={styles.searchInput}
          value={filterText}
          onChangeText={setFilterText}
          placeholder={tStr('directory_search_placeholder')}
          placeholderTextColor={t.placeholder ?? t.subText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.filterRow}>
          {[
            ['all', 'directory_filter_all'],
            ['gym', 'directory_filter_gym'],
            ['coach', 'directory_filter_coach'],
          ].map(([key, labelKey]) => {
            const on = typeFilter === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, on && styles.filterChipOn]}
                onPress={() => setTypeFilter(key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{tStr(labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: MOBILE_SPACING.xxl + MOBILE_SPACING.lg }} color={t.brand} size="large" />
        ) : errMsg ? (
          <Text style={styles.err}>{errMsg}</Text>
        ) : (
          <FlatList
            data={displayRows}
            keyExtractor={(it, index) => String(it?.id || `row-${index}`)}
            renderItem={renderItem}
            numColumns={1}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={fe.subText} />}
            ListEmptyComponent={<Text style={styles.empty}>{tStr('directory_empty')}</Text>}
            contentContainerStyle={{ paddingBottom: MOBILE_SPACING.xxl + MOBILE_SPACING.lg, paddingTop: MOBILE_SPACING.sm }}
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={0.35}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.listFooter}>
                  <ActivityIndicator color={t.brand} />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </BackgroundWrapper>
  );
}
