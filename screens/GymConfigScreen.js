// GymConfigScreen — Configuración de la organización (nombre, logo, color de acento)
// Solo owner/superadmin de la org. Fase 4.

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { supabase } from '../supabaseClient';

const hexToRgba = (hex, alpha) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const BUCKET_ORG_LOGOS = 'org-logos';

export default function GymConfigScreen() {
  const navigation = useNavigation();
  const { t } = useThemeContext();
  const { profile, organization } = useAuth() || {};
  const orgId = organization?.id || profile?.organization_id;

  const [name, setName] = useState(organization?.name || '');
  const [accentColor, setAccentColor] = useState(organization?.accent_color || '#00dddd');
  const [logoUri, setLogoUri] = useState(organization?.logo_url || null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name || '');
      setAccentColor(organization.accent_color || '#00dddd');
      setLogoUri(organization.logo_url || null);
    }
  }, [organization?.id, organization?.name, organization?.accent_color, organization?.logo_url]);

  const isOwner = organization?.owner_id === profile?.id;

  const pickAndUploadLogo = async () => {
    if (!orgId) {
      Alert.alert('Error', 'No hay organización cargada.');
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso', 'Se necesita acceso a la galería para subir el logo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingLogo(true);
      const uri = result.assets[0].uri;
      const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
      const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : 'jpg';
      const path = `${orgId}/logo.${safeExt}`;

      const response = await fetch(uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ORG_LOGOS)
        .upload(path, blob, { contentType: `image/${safeExt === 'png' ? 'png' : 'jpeg'}`, upsert: true });

      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(BUCKET_ORG_LOGOS).getPublicUrl(path);
      const publicUrl = data?.publicUrl || null;
      if (publicUrl) setLogoUri(publicUrl);
    } catch (e) {
      console.log('GymConfig logo upload:', e?.message || e);
      Alert.alert(
        'Logo',
        e?.message?.includes('Bucket') ? 'Creá el bucket "org-logos" en Supabase Storage (público) y volvé a intentar.' : (e?.message || 'No se pudo subir el logo.')
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const save = async () => {
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      Alert.alert('Nombre', 'El nombre de la organización es obligatorio.');
      return;
    }
    if (!orgId) {
      Alert.alert('Error', 'No hay organización cargada.');
      return;
    }
    if (!isOwner) {
      Alert.alert('Sin permiso', 'Solo el dueño de la organización puede editar la configuración.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: trimmedName,
          accent_color: (accentColor || '').trim() || '#00dddd',
          logo_url: logoUri || null,
        })
        .eq('id', orgId);
      if (error) throw error;
      Alert.alert('Guardado', 'La configuración se actualizó correctamente.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, padding: 20, paddingTop: 56 },
        header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
        backBtn: { padding: 8, marginLeft: -8 },
        title: { color: t.text, fontSize: 22, fontWeight: '800', marginLeft: 8 },
        scroll: { paddingBottom: 40 },
        block: { marginBottom: 20 },
        label: { color: t.subText, fontSize: 13, marginBottom: 8, fontWeight: '600' },
        input: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          padding: 12,
          color: t.text,
          backgroundColor: t.inputBg,
          fontSize: 15,
        },
        logoWrap: {
          width: 100,
          height: 100,
          borderRadius: 14,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        logoImg: { width: '100%', height: '100%' },
        logoBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: hexToRgba(t.brand, 0.2), borderRadius: 10, alignSelf: 'flex-start' },
        logoBtnText: { color: t.brand, fontSize: 14, fontWeight: '600' },
        saveBtn: { ...t.buttonPrimary, borderRadius: 10, paddingVertical: 14, marginTop: 16 },
        saveBtnText: { ...t.buttonPrimaryText, fontSize: 16 },
        hint: { color: t.placeholder, fontSize: 12, marginTop: 6 },
      }),
    [t]
  );

  if (!orgId) {
    return (
      <BackgroundWrapper screen="admin">
        <View style={styles.screen}>
          <Text style={styles.title}>Cargando...</Text>
        </View>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper screen="admin">
      <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={26} color={t.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Configuración del gym</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Nombre de la organización</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ej. Waitomo Training"
            placeholderTextColor={t.placeholder}
            editable={isOwner}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Color de acento (hex)</Text>
          <TextInput
            style={styles.input}
            value={accentColor}
            onChangeText={setAccentColor}
            placeholder="#00dddd"
            placeholderTextColor={t.placeholder}
            editable={isOwner}
          />
          <Text style={styles.hint}>Se usa en botones y destacados. Ej: #00dddd</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Logo</Text>
          <View style={styles.logoWrap}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImg} resizeMode="cover" />
            ) : (
              <Ionicons name="business" size={40} color={t.placeholder} />
            )}
          </View>
          {isOwner && (
            <TouchableOpacity style={styles.logoBtn} onPress={pickAndUploadLogo} disabled={uploadingLogo}>
              {uploadingLogo ? (
                <ActivityIndicator size="small" color={t.brand} />
              ) : (
                <Text style={styles.logoBtnText}>Cambiar logo</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {isOwner && (
          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} activeOpacity={0.9}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar</Text>
            )}
          </TouchableOpacity>
        )}

        {!isOwner && (
          <Text style={styles.hint}>Solo el dueño de la organización puede editar esta configuración.</Text>
        )}

        {/* Footer atribución plataforma (Brand & Logo spec) */}
        <View style={{ alignItems: 'center', marginTop: 32, paddingVertical: 20 }}>
          <Text style={[styles.hint, { fontSize: 11, opacity: 0.8 }]}>FitEngine by WAITOMO © 2026</Text>
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}
