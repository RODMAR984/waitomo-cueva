import { buildClientInvitePublicLink, getFitEngineUrls } from './fitengineUrls';

/**
 * Arma el texto para compartir invitación de cliente (WhatsApp, mail, etc.).
 * {{link}} = HTTPS fitengine.app/join?code=… (web hoy; universal link en móvil con app instalada).
 * {{stores_block}} = bloque opcional cuando hay URLs de App Store / Play en app.json.
 */
export function buildClientInviteShareMessage({
  gymName,
  code,
  messageTemplate,
  storesBlockTemplate = '',
}) {
  const c = String(code || '').trim();
  const gym = String(gymName || 'tu gym').trim();
  const link = buildClientInvitePublicLink(c);
  const { iosAppStoreUrl, androidPlayStoreUrl } = getFitEngineUrls();

  let storesBlock = '';
  if (storesBlockTemplate && (iosAppStoreUrl || androidPlayStoreUrl)) {
    const blockLines = storesBlockTemplate
      .replace(/\{\{ios_store\}\}/g, iosAppStoreUrl || '')
      .replace(/\{\{android_store\}\}/g, androidPlayStoreUrl || '')
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        if (/^iPhone:\s*$/i.test(t) && !iosAppStoreUrl) return false;
        if (/^Android:\s*$/i.test(t) && !androidPlayStoreUrl) return false;
        return true;
      });
    const block = blockLines.join('\n').trim();
    if (block) storesBlock = `\n\n${block}`;
  }

  return String(messageTemplate || '')
    .replace(/\{\{gym\}\}/g, gym)
    .replace(/\{\{code\}\}/g, c)
    .replace(/\{\{link\}\}/g, link)
    .replace(/\{\{stores_block\}\}/g, storesBlock)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
