import type { Message } from '@mama/shared/messages';

type Grandma = 'mama' | 'nana';
const NAME: Record<Grandma, string> = { mama: 'Mama', nana: 'Nana' };

const cards = [...document.querySelectorAll<HTMLButtonElement>('.grandma')];
const picked = document.querySelector<HTMLParagraphElement>('#picked')!;

function paint(current: Grandma | undefined) {
  for (const c of cards) c.setAttribute('aria-checked', String(c.dataset.grandma === current));
  picked.textContent = current ? `${NAME[current]} is in your cart.` : 'Pick one. She will not start until you do.';
}

// The choice is never defaulted: until it is made the cards sit unchecked and the store pages stay quiet.
browser.storage.local.get('settings').then(({ settings = {} }) => paint((settings as { grandma?: Grandma }).grandma));

for (const c of cards) {
  c.addEventListener('click', async () => {
    const grandma = c.dataset.grandma as Grandma;
    const { settings = {} } = await browser.storage.local.get('settings');
    await browser.storage.local.set({ settings: { ...(settings as object), grandma } });
    paint(grandma);
  });
}

const button = document.querySelector<HTMLButtonElement>('#over')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    await browser.runtime.sendMessage({ type: 'START_OVER' } satisfies Message);
    // Only say it after the worker confirmed.
    status.textContent = 'Done. Reload the cart and she will ask again.';
  } catch {
    status.textContent = 'That did not work. Reload the extension and try again.';
  } finally {
    button.disabled = false;
  }
});
