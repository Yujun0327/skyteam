# Sky Team

A two-seat cooperative cockpit in the browser: Pilot and Co-Pilot land the airliner in
silence. Faithful rules for the whole base game (21 scenarios, all modules, all special
abilities) plus the official promo tracks. Play online with a room code or solo at the
practice table. No accounts, no servers: rooms are paired over public MQTT brokers and
every client derives the full game from a shared seed.

Fan project. Sky Team is by Luc Rémond, published by Le Scorpion Masqué. All art here is
original.

## Run

```
npm install
npm run dev          # http://localhost:5173
npm run dev:phone    # HTTPS on the LAN for DeviceMotion
npm test
npm run check
npm run build
npm run deploy:gh    # publish dist/ to the gh-pages branch
```

Routes: `#room=CODE` online table, `#lab` practice sandbox, `#gallery` component gallery (dev).

## Docs

`docs/RULES.md` (implementation rules), `rulings.md` (edge decisions), `docs/DATA.md`
(track provenance), `docs/art-bible.md` (visual direction).

## Known limitations

Dice behind the screen are hidden by the interface only; every client derives all faces
from the shared seed. Sky Team is cooperative, so this is an honor system, not a flaw.
