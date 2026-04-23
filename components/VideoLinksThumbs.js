import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { normalizeVideoLinkEntry, videoLinksToUrlList } from '../utils/videoLinkPreview';

/**
 * @param {string[]} links — URLs (o mezcla string / { url } legada)
 * @param {object} themeStyles — videoThumbRow, videoThumb, videoImage, videoLabel del screen
 * @param {string} placeholderColor — color ícono fallback
 */
export default function VideoLinksThumbs({ links, themeStyles, placeholderColor }) {
  const urls = videoLinksToUrlList(links);
  if (!urls.length) return null;
  const ts = themeStyles || {};
  return (
    <View style={ts.videoThumbRow}>
      {urls.map((url, idx) => (
        <VideoThumbCell
          key={`v_${idx}_${url.slice(0, 24)}`}
          url={url}
          themeStyles={ts}
          placeholderColor={placeholderColor}
        />
      ))}
    </View>
  );
}

function VideoThumbCell({ url, themeStyles, placeholderColor }) {
  const [imgErr, setImgErr] = useState(false);
  const v = normalizeVideoLinkEntry(url);
  if (!v.url) return null;
  const showImg = !!v.thumbnail && !imgErr;
  return (
    <TouchableOpacity
      style={themeStyles.videoThumb}
      onPress={() => Linking.openURL(v.url)}
      activeOpacity={0.88}
    >
      {showImg ? (
        <Image
          source={{ uri: v.thumbnail }}
          style={themeStyles.videoImage}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      ) : (
        <View style={[styles.fallback, { height: themeStyles.videoImage?.height || 60 }]}>
          <Ionicons name="link-outline" size={26} color={placeholderColor} />
        </View>
      )}
      <Text style={themeStyles.videoLabel} numberOfLines={2}>
        {v.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fallback: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.15)',
  },
});
