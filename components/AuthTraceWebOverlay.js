/**
 * Panel opcional de AUTH_TRACE (desactivado por defecto).
 */
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import {
  authTraceOverlayEnabled,
  hideAuthTraceOverlay,
  subscribeAuthTrace,
  subscribeAuthTraceOverlay,
} from '../utils/authTrace';

export default function AuthTraceWebOverlay() {
  const [show, setShow] = useState(authTraceOverlayEnabled());
  const [lines, setLines] = useState([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const unsubOverlay = subscribeAuthTraceOverlay(setShow);
    const unsubLines = show ? subscribeAuthTrace(setLines) : undefined;
    return () => {
      unsubOverlay();
      if (unsubLines) unsubLines();
    };
  }, [show]);

  if (Platform.OS !== 'web' || !show) return null;

  const visible = lines.slice(0, 8);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        width: 'min(360px, calc(100vw - 16px))',
        zIndex: 2147483646,
        maxHeight: 140,
      }}
    >
      <View
        style={{
          backgroundColor: 'rgba(0,0,0,0.88)',
          borderWidth: 2,
          borderColor: '#facc15',
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ color: '#facc15', fontSize: 11, fontWeight: '700', flex: 1 }}>
            AUTH_TRACE (debug)
          </Text>
          <Pressable
            onPress={hideAuthTraceOverlay}
            hitSlop={12}
            accessibilityLabel="Ocultar AUTH_TRACE"
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: 'rgba(250,204,21,0.25)',
            }}
          >
            <Text style={{ color: '#fef08a', fontSize: 12, fontWeight: '800' }}>✕</Text>
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 100 }} nestedScrollEnabled>
          {visible.length === 0 ? (
            <Text style={{ color: '#fef08a', fontSize: 10, fontFamily: 'monospace' }}>
              Sin eventos aún…
            </Text>
          ) : (
            visible.map((line, i) => (
              <Text
                key={`${i}-${line.slice(0, 24)}`}
                style={{ color: '#fef08a', fontSize: 10, fontFamily: 'monospace', marginBottom: 2 }}
                numberOfLines={2}
              >
                {line}
              </Text>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}
