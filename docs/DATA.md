# Data provenance

All approach tracks, altitude tracks, scenario module lists and special-ability texts are
transcribed from the public Board Game Arena implementation
(https://github.com/jordijansen/bga-skyteam, `material.inc.php`), which encodes the
printed strips of the physical game. The raw parse is kept in `data-src/bga-data.json`
(produced by `data-src/parse-bga.mjs` against a checkout of that repo) and
`src/data/approaches.ts` is generated from it by `scripts/gen-data.mjs`.

Conventions: space 1 = clouds (start), space `size` = airport. `turns` lists the
permitted axis values (−2..2) when the space prints a Turns tab.

Included: every scenario whose modules are all supported (base game, the official promo
tracks, and the Ready-to-Play remixes). Scenarios needing Turbulence-only modules
(alarms, penguins, turbulence, low visibility, stuck landing gear) are skipped.

Known quirks kept verbatim: PRG yellow places 12 plane tokens (the entire supply), so its
traffic-die icons never add a plane.
