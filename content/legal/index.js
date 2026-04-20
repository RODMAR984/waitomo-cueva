import privacyEs from './privacy.es';
import privacyEn from './privacy.en';
import termsEs from './terms.es';
import termsEn from './terms.en';

export function getPrivacyBody(locale) {
  return locale === 'en' ? privacyEn : privacyEs;
}

export function getTermsBody(locale) {
  return locale === 'en' ? termsEn : termsEs;
}
