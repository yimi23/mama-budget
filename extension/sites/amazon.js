// Amazon.com cart reader. Same warning as Target: verify on the live cart page before the demo.
window.MamaSites = window.MamaSites || {};
window.MamaSites.amazon = {
  matches: () => location.hostname.endsWith('amazon.com'),
  cart: () => {
    const rows = [...document.querySelectorAll('[data-name="Active Items"] .sc-list-item, .sc-list-item[data-asin]')];
    return rows.map((el) => {
      const title = el.querySelector('.sc-product-title, .a-truncate-full, span.a-truncate-cut')?.textContent?.trim() || '';
      const priceText = el.querySelector('.sc-product-price, .sc-price, .a-price .a-offscreen')?.textContent || '';
      const price = Number((priceText.replace(/,/g, '').match(/\d+(\.\d{2})?/) || [0])[0]);
      return { item: title, price, merchant: 'Amazon', context: '', el };
    }).filter((r) => r.item);
  },
  remove: (row) => row.el.querySelector('input[value="Delete"], [data-action="delete"] input')?.click(),
  checkoutButton: () => document.querySelector('#sc-buy-box-ptc-button input, input[name="proceedToRetailCheckout"]'),
};
