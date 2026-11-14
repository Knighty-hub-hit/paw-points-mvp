import { NextResponse, type NextRequest } from 'next/server';

/** Keep printed QR destinations stable; carry attribution outside the visible URL. */
export function proxy(request: NextRequest) {
  if (request.nextUrl.searchParams.get('cafe') !== 'pawbrew') return NextResponse.next();
  const response = NextResponse.redirect(new URL('/', request.url), 307);
  response.headers.set('Cache-Control', 'private, no-store');
  response.cookies.set('paw-qr-entry', 'pawbrew', {
    path: '/', sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', maxAge: 300,
  });
  return response;
}
export const config = { matcher: ['/enter', '/enter/'] };
