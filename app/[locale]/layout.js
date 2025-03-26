import { locales } from '../i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({ children, params: { locale } }) {
  return (
    <html lang={locale}>
      <body>
        <div className="app-container">
          <LanguageSwitcher currentLocale={locale} />
          {children}
        </div>
      </body>
    </html>
  );
} 