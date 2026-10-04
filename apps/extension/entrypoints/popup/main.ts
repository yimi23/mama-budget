import type { Message } from '@mama/shared/messages';

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
