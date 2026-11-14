import type { Profile } from '../types';

/** Profile ⇄ URL-safe string. Holds only rounded numbers and a nickname. */
export function encodeProfile(p: Profile): string {
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeProfile(s: string): Profile | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes)) as Profile;
    if (!p || typeof p.e !== 'string' || !Array.isArray(p.k) || p.k.length !== 42) return null;
    return p;
  } catch {
    return null;
  }
}

export const siteUrl = () => `${location.origin}${import.meta.env.BASE_URL}`;
export const inviteUrl = (p: Profile) => `${siteUrl()}#/invite?p=${encodeProfile(p)}`;
export const coupleHash = (a: Profile, b: Profile) => `#/couple?a=${encodeProfile(a)}&b=${encodeProfile(b)}`;
export const coupleUrl = (a: Profile, b: Profile) => `${siteUrl()}${coupleHash(a, b)}`;
