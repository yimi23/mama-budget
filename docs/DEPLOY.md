# Deploying the API off the laptop

One Ubuntu box (an EC2 t3.small is plenty), Docker, Caddy for HTTPS. Everything in `deploy/`.

1. DNS: an A record for `api.mamabudget.com` pointing at the box (Namecheap, the same place mamabudget.com lives).
2. On the box: `git clone https://github.com/yimi23/mama-budget.git && cd mama-budget`.
3. `cp deploy/.env.example deploy/.env` and fill it. Keys are typed on the box; nothing is pushed.
4. `bash deploy/deploy.sh`. It installs Docker if missing, builds the image, starts the API and Caddy, and prints the health URL once the certificate is issued (a minute).
5. In the extension popup, "Where she runs": `https://api.mamabudget.com`. Each install sends its own device token; the first device the API ever sees is the owner.

What moves with the box: the SQLite database (users, settings, encrypted bank links, bank caches, budget state, memory), the voice cache, the owner's files. All in Docker volumes; `docker compose -f deploy/docker-compose.yml down` keeps them, `down -v` destroys them.

Texts on a Linux box go through Photon Spectrum only; the Mac iMessage fallback does not exist there, so Spectrum's production terms and allowlist must be settled before anyone but the owner relies on texts (docs/BUDGET.md, the build plan).

Redeploy: `git pull && bash deploy/deploy.sh`.
