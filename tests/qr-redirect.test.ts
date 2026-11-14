import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';
test('printed café QR redirects to exact homepage with short-lived context',()=>{
  const response=proxy(new NextRequest('https://paw-points-mvp.vercel.app/enter/?cafe=pawbrew'));
  assert.equal(response.status,307);
  assert.equal(response.headers.get('location'),'https://paw-points-mvp.vercel.app/');
  assert.equal(response.cookies.get('paw-qr-entry')?.value,'pawbrew');
  assert.match(response.headers.get('set-cookie')!,/Secure/);
});
test('unknown café keeps existing entry fallback',()=>{
  const response=proxy(new NextRequest('https://paw-points-mvp.vercel.app/enter/?cafe=unknown'));
  assert.equal(response.headers.get('location'),null);
});
