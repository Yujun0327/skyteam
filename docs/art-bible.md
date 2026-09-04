# Sky Team — art bible: "Night Approach"

The game is a cockpit at night on final approach. Every screen should feel like the
flight deck of an airliner: dark, quiet, instrument-lit, serious. No cartoon, no
playfulness, no emoji. The tension comes from restraint.

## Palette

| Token | Value | Use |
|---|---|---|
| `--panel` | `#0b0f14` | flight-deck surfaces, page background |
| `--panel-2` | `#121820` | raised bezels, cards |
| `--glass` | `rgba(255,255,255,.04)` | gauge glass, dice shelf |
| `--hairline` | `rgba(255,255,255,.12)` | bezel edges |
| `--ink` | `#e6ebf0` | primary text |
| `--ink-dim` | `#8a94a0` | labels, placards |
| `--blue` | `#2f7bff` | Pilot LED, blue markers, blue dice |
| `--orange` | `#ff8a1f` | Co-Pilot LED, orange markers, orange dice |
| `--amber` | `#ffb000` | cautions, coffee, reroll tokens |
| `--green` | `#37d67a` | SET lamps, "landed" |
| `--red` | `#ff3b30` | master warning, brake marker, PAPI |
| `--runway` | `#f4f1e6` | runway lights, centreline |
| `--sky-top` / `--sky-bottom` | per airport | windshield gradient |

Colour is functional: blue = Pilot, orange = Co-Pilot, green = done, amber = resource,
red = danger. Nothing else is coloured.

## Type

- Display and placards: **B612** (the Airbus flight-deck typeface), uppercase, letter-spaced.
- Numbers and readouts: **B612 Mono**, tabular.
- Title and airport codes: **Michroma**.

Placard labels are small caps with 0.12 em tracking. Readouts never animate their glyphs;
they cut, like real seven-segment displays.

## Surfaces

- Panels are matte black with a 1 px hairline top edge and a 2 px inner shadow.
- Slots are recessed wells with an LED ring in the seat colour that lights when legal
  and pulses slowly when it is the only mandatory slot left.
- Gauges have curved glass: a single subtle radial highlight, no other gradients.
- Switches are physical: a rocker with a green lamp beneath it that lights when set.

## The windshield

A three.js scene fills the viewport behind the panel: runway edge lights converging on the
horizon, threshold greens, end reds, PAPI, approach light bars with the running strobe,
a ground plane of scattered city lights, fog. The horizon banks with the axis, the runway
grows as the position advances, the camera sinks as the altitude drops. Weather per
airport: rain streaks (KUL, GIG), snow (KEF, OSL, NZIR), fog (LHR), thin mountain haze
(PBH, TGU). No shadows, no post-processing, DPR capped at 2.

## Motion

- State changes are cut-and-settle: 180 ms ease-out for gauges, 400 ms for the horizon.
- Crash: master warning flashes red at 2 Hz, the horizon rolls past 60 degrees, fade to
  black in 1.2 s. Landed: the runway lights rush under the nose, a soft flare, then the
  debrief card rises.
- Reduced motion collapses all of the above to instant cuts.

## Sound

All synthesized: engine hum that follows speed, altitude callouts, switch clicks, radio
squelch, master warning. Silence is part of the design; nothing plays during the
sterile-cockpit phase except the players' own actions.

## Voice

Copy is terse and procedural: "AXIS", "ENGINES", "STERILE COCKPIT", "MINIMUMS",
"GO AROUND". Debrief copy is factual: "Speed 9 exceeded brakes 6."
