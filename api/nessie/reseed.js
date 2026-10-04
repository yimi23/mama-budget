// npm run reseed: fresh student, fresh Nessie cache, and clears the watcher's seen-purchases list,
// the message log and her conversation memory -- everything POST /reset does, for when the server
// isn't running. Reuses seed.js's own main(), not a second copy of the seeding logic.

const { main } = require('./seed');
const watch = require('../notify/watch');
const notify = require('../notify');
const memory = require('../notify/memory');

(async () => {
  await main();
  watch.resetState();
  notify.clearMessages();
  memory.reset();
  console.log('Reseeded: fresh student, fresh cache, watcher/messages/memory cleared.');
})();
