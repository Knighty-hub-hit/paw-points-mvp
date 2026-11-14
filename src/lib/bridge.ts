'use client';
import { create } from 'zustand';
import type { Command } from './engine';
import type { DemoState } from './models';

// Google Apps Script bridge to the PawBook Ops sheet that Grok Bot operates. Contract: docs/website-contract.md in the ops repo.
export const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || 'https://script.google.com/macros/s/AKfycbxyumOY1iNRG9ZL-bpxfoCXR8A86oFrZdEy0d9RZ6a3NwSIgsdMcRCS_p5kRvMtsXg3Og/exec';

export type LiveCat = { votes: number; fans: number };
export const useLive = create<{ cats: Record<string, LiveCat> | null }>(() => ({ cats: null }));

// Anonymous per-device fan ID; the bridge stores no names, phones or emails.
export function memberId() {
  let id = localStorage.getItem('paw-member-id');
  if (!id) {
    id = 'm_' + Array.from(crypto.getRandomValues(new Uint8Array(8)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
    localStorage.setItem('paw-member-id', id);
  }
  return id;
}

// text/plain keeps the request "simple", so the browser skips the CORS preflight Apps Script can't answer.
async function post(body: Record<string, unknown>) {
  const res = await fetch(BRIDGE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!data.ok) throw Error(data.error || 'Bridge error');
  return data;
}

export async function refreshLive() {
  try {
    const data = await (await fetch(BRIDGE_URL + '?leaderboard=s1')).json();
    if (data.ok) useLive.setState({ cats: Object.fromEntries(data.leaderboard.map((c: { cat_id: string; votes: number; fans: number }) => [c.cat_id, { votes: c.votes, fans: c.fans }])) });
  } catch { /* keep last known board; the local demo keeps working offline */ }
}

export function trackView(cat_id: string) {
  post({ kind: 'events', events: [{ event: 'view_cat', member_id: memberId(), cat_id, page: 'cat_id' }] }).catch(() => {});
}

// Mirrors a successful local action to the ops sheet. Resolves to an error message, or '' when saved or not mirrored.
export async function mirror(command: Command, after: DemoState): Promise<string> {
  const member_id = memberId();
  let jobs: Promise<unknown>[];
  switch (command.type) {
    case 'vote': jobs = [post({ kind: 'vote', member_id, cat_id: command.catId })]; break;
    case 'follow': jobs = [post({ kind: 'follow', member_id, cat_id: command.catId })]; break;
    case 'unfollow': jobs = [post({ kind: 'events', events: [{ event: 'unfollow', member_id, cat_id: command.catId, page: 'site' }] })]; break;
    case 'checkout': jobs = (after.orders[0]?.items ?? []).map(i => post({ kind: 'order', type: 'shop', member_id, item: i.productId, qty: i.quantity })); break;
    case 'book': jobs = [post({ kind: 'order', type: 'birthday', member_id, item: command.packageId, shop_id: command.cafeId, date: command.date, guests: command.guests })]; break;
    case 'care': jobs = [post({ kind: 'feed', member_id, cat_id: command.catId, package_id: command.packageId })]; break;
    default: return '';
  }
  try {
    await Promise.all(jobs);
    await refreshLive();
    return '';
  } catch (e) {
    const message = (e as Error).message;
    post({ kind: 'error', source: 'site', page: location.pathname, message, detail: command.type }).catch(() => {});
    return message;
  }
}
