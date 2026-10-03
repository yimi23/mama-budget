// Target.com cart reader. Selectors change, so this reader is written to degrade:
// it looks for the cart item containers by data test ids first, then by text patterns.
// VERIFY these selectors on the live cart page the night before. That is the whole risk of this file.
window.MamaSites = window.MamaSites || {};
window.MamaSites.target = {
  matches: () => location.hostname.endsWith('target.com'),
  cart: () => {
    const rows = [...document.querySelectorAll('[data-test="cartItem"], [data-test^="cartItem-"], li[class*="CartItem"]')];
    return rows.map((el) => {
      const title = el.querySelector('[data-test="cartItem-title"], a[href*="/p/"]')?.textContent?.trim() || '';
      const priceText = el.querySelector('[data-test="cartItem-price"], [class*="Price"]')?.textContent || '';
      const price = Number((priceText.match(/\d+(\.\d{2})?/) || [0])[0]);
      return { item: title, price, merchant: 'Target', context: '', el };
    }).filter((r) => r.item);
  },
  remove: (row) => row.el.querySelector('[data-test="cartItem-deleteBtn"], button[aria-label*="emove"]')?.click(),
  checkoutButton: () => document.querySelector('[data-test="checkout-button"], button[data-test*="checkout"]'),
};
