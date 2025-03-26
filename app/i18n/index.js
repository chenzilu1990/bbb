import zh from './locales/zh';
import en from './locales/en';

export const defaultLocale = 'zh';
export const locales = ['zh', 'en'];

export const translations = {
  zh,
  en,
};

export function getLocaleFromPath(path) {
  const locale = path.split('/')[1];
  return locales.includes(locale) ? locale : defaultLocale;
}

export function getPathWithoutLocale(path) {
  const locale = getLocaleFromPath(path);
  return path.replace(`/${locale}`, '');
} 