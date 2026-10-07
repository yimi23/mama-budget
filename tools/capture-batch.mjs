// The corpus batch: product pages and carts across many stores, pricing grids that must stay silent, into
// apps/extension/test/fixtures/pages/. Public pages only, guest carts only, nothing bought.
//
//   CHROME=... node tools/capture-batch.mjs [filter]
import { withBrowser, SHOPIFY_ADD } from './capture-lib.mjs';

const filter = process.argv[2] || '';

// kind: 'shopify' captures the first product page and the guest cart after one add; 'product' captures one page;
// 'pricing' captures a plan grid that must read as nothing to judge.
const STORES = [
  { name: 'allbirds', kind: 'shopify', url: 'https://www.allbirds.com/' },
  { name: 'bombas', kind: 'shopify', url: 'https://bombas.com/' },
  { name: 'colourpop', kind: 'shopify', url: 'https://colourpop.com/' },
  { name: 'brooklinen', kind: 'shopify', url: 'https://www.brooklinen.com/' },
  { name: 'rothys', kind: 'shopify', url: 'https://rothys.com/' },
  { name: 'chubbies', kind: 'shopify', url: 'https://www.chubbiesshorts.com/' },
  { name: 'ruggable', kind: 'shopify', url: 'https://ruggable.com/' },
  { name: 'mejuri', kind: 'shopify', url: 'https://mejuri.com/' },
  { name: 'gymshark', kind: 'product', url: 'https://www.gymshark.com/', find: 'a[href*="/products/"]' },
  { name: 'uniqlo', kind: 'product', url: 'https://www.uniqlo.com/us/en/men/tops', find: 'a[href*="/products/"]' },
  { name: 'nike', kind: 'product', url: 'https://www.nike.com/w/mens-shoes-nik1zy7ok', find: 'a[href*="/t/"]' },
  { name: 'jumia', kind: 'product', url: 'https://www.jumia.com.ng/mlp-phones-tablets/', find: 'a.core[href*=".html"], a[href*=".html"]' },
  { name: 'konga', kind: 'product', url: 'https://www.konga.com/category/phones-tablets-5294', find: 'a[href*="/product/"]' },
  { name: 'etsy', kind: 'product', url: 'https://www.etsy.com/c/jewelry', find: 'a[href*="/listing/"]' },
  { name: 'ebay', kind: 'product', url: 'https://www.ebay.com/b/Headphones/112529/bn_879608', find: 'a[href*="/itm/"]' },
  { name: 'bookshop', kind: 'product', url: 'https://bookshop.org/lists/best-sellers-of-the-week', find: 'a[href*="/p/books/"]' },
  { name: 'hm', kind: 'product', url: 'https://www2.hm.com/en_us/men/products/t-shirts-tank-tops.html', find: 'a[href*="productpage"]' },
  { name: 'zara', kind: 'product', url: 'https://www.zara.com/us/en/man-tshirts-l855.html', find: 'a[href*="-p0"], a.product-link' },
  { name: 'adidas', kind: 'product', url: 'https://www.adidas.com/us/men-shoes', find: 'a[href*="/us/"][href$=".html"]' },
  { name: 'openai-pricing', kind: 'pricing', url: 'https://openai.com/chatgpt/pricing/' },
  { name: 'elevenlabs-pricing', kind: 'pricing', url: 'https://elevenlabs.io/pricing' },
  { name: 'notion-pricing', kind: 'pricing', url: 'https://www.notion.com/pricing' },
  { name: 'spotify-premium', kind: 'pricing', url: 'https://www.spotify.com/us/premium/' },
];

await withBrowser(async (b) => {
  for (const s of STORES.filter((x) => !filter || x.name.includes(filter))) {
    try {
      await b.open(s.url, 6000);
      if (s.kind === 'pricing') { console.log(s.name, 'pricing ->', JSON.stringify(await b.save(`${s.name}`, { kind: 'pricing', store: s.name }))); continue; }
      if (s.kind === 'shopify') {
        const added = String(await b.evalIn(SHOPIFY_ADD));
        console.log(s.name, 'add ->', added.slice(0, 100));
        const handle = /\/products\/(\S+)/.exec(added)?.[1];
        if (handle) { await b.open(new URL(`/products/${handle}`, s.url).href, 6000); console.log(s.name, 'product ->', JSON.stringify(await b.save(`${s.name}-product`, { kind: 'product', store: s.name }))); }
        if (/^200/.test(added)) { await b.open(new URL('/cart', s.url).href, 6000); console.log(s.name, 'cart ->', JSON.stringify(await b.save(`${s.name}-cart`, { kind: 'cart', store: s.name }))); }
        continue;
      }
      // product: find a product link on the listing, open it, save.
      const href = await b.evalIn(`(() => { const a = [...document.querySelectorAll(${JSON.stringify(s.find)})].find(a => a.href && a.href.startsWith('http')); return a ? a.href : null; })()`);
      if (!href || typeof href !== 'string') { console.log(s.name, 'no product link found'); continue; }
      await b.open(href, 7000);
      console.log(s.name, 'product ->', JSON.stringify(await b.save(`${s.name}-product`, { kind: 'product', store: s.name })));
    } catch (e) { console.log(s.name, 'failed:', e.message); }
  }
});
