'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { locales } from '../i18n';

export default function LanguageSwitcher({ currentLocale }) {
  const pathname = usePathname();
  
  return (
    <div className="language-switcher">
      {locales.map((locale) => {
        const isActive = locale === currentLocale;
        return (
          <Link
            key={locale}
            href={`/${locale}${pathname.replace(`/${currentLocale}`, '')}`}
            className={`language-link ${isActive ? 'active' : ''}`}
          >
            {locale === 'zh' ? '中文' : 'English'}
          </Link>
        );
      })}
    </div>
  );
} 