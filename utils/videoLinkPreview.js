/**
 * Miniaturas para enlaces de video (YouTube / Vimeo) guardados como URL en texto.
 */

export function extractYoutubeVideoId(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  let m = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?|#|$|\/)/);
  if (m) return m[1];
  m = s.match(/[?&]v=([a-zA-Z0-9_-]{11})(?:&|#|$)/);
  if (m) return m[1];
  m = s.match(/youtube\.com\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  return null;
}

export function extractVimeoVideoId(input) {
  const s = String(input || '').trim();
  let m = s.match(/vimeo\.com\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/|showcase\/\d+\/video\/|)(\d{6,})(?:\?|\/|$)/);
  if (m && m[1]) return m[1];
  m = s.match(/player\.vimeo\.com\/video\/(\d{6,})/);
  return m ? m[1] : null;
}

/**
 * @param {string} raw — URL tal cual la cargó el coach
 * @returns {{ url: string, thumbnail: string | null, label: string, provider: 'youtube'|'vimeo'|'link'|null }}
 */
export function normalizeVideoLinkEntry(raw) {
  const url = String(raw || '').trim();
  if (!url) return { url: '', thumbnail: null, label: '', provider: null };
  const yt = extractYoutubeVideoId(url);
  if (yt) {
    return {
      url,
      thumbnail: `https://img.youtube.com/vi/${yt}/mqdefault.jpg`,
      label: 'YouTube',
      provider: 'youtube',
    };
  }
  const vm = extractVimeoVideoId(url);
  if (vm) {
    return {
      url,
      thumbnail: `https://vumbnail.com/${vm}.jpg`,
      label: 'Vimeo',
      provider: 'vimeo',
    };
  }
  return {
    url,
    thumbnail: null,
    label: url.replace(/^https?:\/\//i, '').replace(/\/$/, '').slice(0, 52),
    provider: 'link',
  };
}

export function videoLinksToUrlList(links) {
  if (!Array.isArray(links)) return [];
  return links
    .map((x) => {
      if (typeof x === 'string') return x.trim();
      if (x && typeof x.url === 'string') return x.url.trim();
      return '';
    })
    .filter(Boolean);
}
