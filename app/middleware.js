import { NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n';

export function middleware(request) {
  const pathname = request.nextUrl.pathname;
  
  // 检查路径是否已经包含语言代码
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return;

  // 获取用户首选语言
  const acceptLanguage = request.headers.get('accept-language') || '';
  const preferredLocale = acceptLanguage
    .split(',')[0]
    .split('-')[0]
    .toLowerCase();

  // 选择语言
  const locale = locales.includes(preferredLocale) ? preferredLocale : defaultLocale;

  // 重定向到带有语言代码的路径
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: [
    // 跳过所有内部路径 (_next)
    // 跳过所有API路由
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 