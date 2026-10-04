// Registrable domain (eTLD+1) with a small suffix list, no dependency.
// www.amazon.com -> amazon.com, shop.jumia.com.ng -> jumia.com.ng

const TWO_PART = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'com.ng', 'org.ng', 'edu.ng', 'gov.ng', 'com.au', 'co.za',
  'com.br', 'co.jp', 'co.in', 'com.mx', 'co.nz', 'com.gh', 'co.ke',
]);

export function storeKey(url: string): string {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return ''; }
  if (/^[\d.]+$/.test(host) || !host.includes('.')) return host;
  const parts = host.split('.');
  const lastTwo = parts.slice(-2).join('.');
  return TWO_PART.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}
