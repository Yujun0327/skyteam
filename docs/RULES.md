# Sky Team — implementation rules

Implementation-grade transcription of *Sky Team* (2023, Luc Rémond, Le Scorpion Masqué).
Sources: the official "Landing Procedure" and "Flight Log" rulebooks, the official
Print & Play / Ready-to-Play sheets, the Dized FAQ, BGG rulings threads, and the public
Board Game Arena implementation (`jordijansen/bga-skyteam`), which is treated as the
authority whenever the printed rules are ambiguous. Edge decisions are numbered in
`rulings.md`.

## 1. Seats and components

| Item | Detail |
|---|---|
| Players | exactly 2, cooperative. Seat 0 = **Pilot** (blue, left). Seat 1 = **Co-Pilot** (orange, right) |
| Dice | 4 blue d6 (Pilot), 4 orange d6 (Co-Pilot), rolled behind a screen |
| Traffic die | black d6 with faces **2, 3, 3, 4, 4, 5** |
| Intern tokens | six tokens valued 1..6, shuffled face-up in a row |
| Coffee tokens | 3 in the reserve; at most 3 held at once |
| Reroll tokens | printed on the Altitude Track; gained when the window reaches that row |
| Control panel | the slots in section 4 |
| Speed gauge | arc 2..12 with a **blue** and an **orange** aerodynamics marker |
| Brake track | red brake marker; values 0 / 2 / 4 / 6 (ice brakes: 0 / 2 / 3 / 4 / 5) |
| Approach track | strip of `size` spaces; space 1 = clouds (start), space `size` = the airport |
| Altitude track | 7 rows, 6000 ft down to 0; each row names the round's first player and may carry a reroll icon |

### Starting values

axis 0, aeroBlue 4, aeroOrange 8, brake 0, position 1, altitude row 1 (6000 ft unless the
scenario says 5000), kerosene 20 (kerosene modules), wind ring 10 (wind modules), coffee 0,
reroll tokens 0 (the 6000 row gives the first one at the start of round 1).

## 2. Round structure

A game is 7 rounds (one per altitude row). Each round:

1. **Briefing.** Players may talk strategy ("we need that plane gone", "let's move 2").
   Talking about dice values or telling the partner where to put a die is forbidden.
2. **Roll.** Each player rolls all 4 dice behind their screen. From now until the end
   of the round both players are **silent** (sterile cockpit). If the Traffic module is
   active and the current space shows traffic-die icons, roll the traffic die once per
   icon at the start of the round and add a plane at `position + (value − 1)`, clamped
   to the airport space (section 6).
3. **Placement.** Starting with the round's first player (printed on the altitude row,
   Pilot in round 1, then alternating), players alternate placing exactly one die per
   turn on a **free** slot that accepts the die's colour and value. Every slot effect
   resolves immediately. 8 placements per round (plus intern tokens or a
   Synchronisation traffic die when applicable).
4. **End of round.** In order: (a) mandatory check: both Axis and both Engine slots
   must hold a die, otherwise the game is lost; (b) module bookkeeping (kerosene −6 if
   no kerosene die was placed; ice-brake pair check); (c) if this was the final round,
   evaluate landing (section 7); otherwise advance the altitude window one row, hand
   back all dice, gain a reroll token if the new row shows one, and start the next round.

The **final round** is the one played while the altitude window shows the last row
(0 ft, the airplane image). If the plane is not on the airport space when that round
begins, the game is lost (crash-landed short of the airport). If the plane reaches the
airport before the last row, it is in a holding pattern: every subsequent Engines result
must advance 0 spaces, or the plane overshoots.

## 3. Coffee, reroll, discard

- **Coffee.** When placing a die the player may spend any number of held coffee tokens,
  each changing the die's value by ±1. The result must stay within 1..6 (no wrap). The
  modified value is what the slot sees, so coffee can satisfy a value constraint. Either
  player may spend any token. Tokens carry over between rounds. Intern tokens cannot be
  modified.
- **Reroll token.** At any moment during placement the player whose turn it is may spend
  one reroll token: they reroll any subset of their own unplaced dice, then the partner
  rerolls any subset (possibly none) of theirs. One token = one reroll opportunity for
  both. Tokens carry over.
- **Discard.** If a die has no legal placement at all (with every coffee option
  considered), the player discards it as their turn. This is the only way to not place.

## 4. Slots

| Slot | Count / colour | Values | Mandatory | Immediate effect |
|---|---|---|---|---|
| Axis | 1 blue + 1 orange | any | yes | when the second die lands: tilt by the difference toward the higher die |
| Engines | 1 blue + 1 orange | any | yes | when the second die lands: speed = sum (+ wind); advance per the speed gauge |
| Radio | 1 blue, 2 orange | any | no | remove one plane from the N-th space counting the current space as 1 |
| Landing gear | 3 blue | 1-2 / 3-4 / 5-6, any order | no | switch turns green; blue marker +1 (first time only) |
| Flaps | 4 orange | 1-2 / 2-3 / 4-5 / 5-6, strictly top to bottom | no | switch turns green; orange marker +1 (first time only) |
| Brakes | 3 blue | exactly 2 / 4 / 6, strictly in order | no | brake marker 0 → 2 → 4 → 6 |
| Concentration | 3, either colour | any | no | gain 1 coffee (max 3) |
| Kerosene (module) | 1, either colour | any | no | kerosene −value |
| Intern (module) | 1 blue + 1 orange | any value **except** the next token's value | no | take the next intern token; it must be placed later this round as an extra die |
| Ice brakes (module) | 4 columns valued 2/3/4/5, top row blue, bottom row either | exactly the column value | no | when both rows of the current column hold dice in the same round: brake marker → 2 / 3 / 4 / 5 |

Rules on top of the table:

- **Axis.** Positions −2..+2 are legal (negative = tilted toward the Pilot). If the tilt
  reaches ±3 the plane spins: immediate loss. The axis is never reset between rounds.
  Equal dice do not move it.
- **Engines.** With speed *s*: advance 0 if `s ≤ aeroBlue`, 1 if `aeroBlue < s ≤ aeroOrange`,
  2 otherwise. Each deployed landing gear raises aeroBlue by 1 (4 → 7), each flap raises
  aeroOrange by 1 (8 → 12). Wind (module) is added to *s* every round including the last.
  In the **final round** the plane does not move; instead `s ≤ brake` (and brake ≥ 2) is
  recorded as victory condition D.
- **Advance procedure**, one step at a time: on the space being left, first check Turns
  (if the module is active and the space prints a tab, the axis must be in the permitted
  set), then check collision (any plane token on that space = loss), then move one space.
  Moving past the airport space = overshoot = loss. A 2-space advance therefore checks
  both the departure space and the pass-through space; the destination is never checked.
- **Radio.** Placing on an empty target is legal and does nothing. A value of 1 targets
  the current space.
- **Landing gear / flaps.** Re-placing a die on a slot whose switch is already green is a
  legal no-op (a dump for a useless die).
- **Brakes.** At least one brake is needed to land (speed ≥ 2 always). Landing requires
  `speed ≤ brake`.

## 5. Modules

- **Traffic die.** See round step 2. Rolled only for icons on the space where the round
  starts, never for spaces passed through. If no plane tokens remain in the supply the
  roll adds nothing.
- **Turns.** Some spaces print permitted axis positions. Checked during the advance
  procedure only; a 0-space advance is never checked.
- **Kerosene.** Marker starts at 20. A die on the Kerosene slot burns its value
  immediately. If no die was placed there this round, burn 6 at the end of the round.
  Kerosene below 0 at any time = loss.
- **Kerosene leak.** No Kerosene slot. When the second Engine die lands, burn
  `|e1 − e2| + 1`. Below 0 = loss.
- **Intern.** Six face-up tokens (1..6, shuffled). On your turn place a die of any value
  other than the next token's value on your colour's Intern slot and take that token.
  Later this round (any turn of yours) place the token as if it were a die on any slot
  except Concentration; coffee cannot modify it. All six tokens must be used by the end
  of the game or the landing fails.
- **Wind.** A 20-position ring. Each round, immediately after the Axis resolves, rotate
  the ring by the current axis value (even if the axis did not move). The ring position
  gives a modifier added to every Engine sum: positions 9–11 → +3, 7–8 and 12–13 → +2,
  6 and 14 → +1, 5 and 15 → 0, 4 and 16 → −1, 2–3 and 17–18 → −2, 0–1 and 19 → −3.
  Head-on wind (NZIR) uses the negated table. The ring starts at 10.
- **Ice brakes.** Replaces the Brakes. Columns valued 2, 3, 4, 5, each with a top slot
  (Pilot) and a bottom slot (either). Only the current column is open. When both slots
  hold dice in the same round the marker advances one column. A die left alone in a
  column at the end of the round is wasted. The marker must reach 5 by the end of the
  game or the landing fails, and speed must be ≤ marker.
- **Real time.** A 60 s clock starts once both players have rolled. When it expires the
  round ends: unplaced dice are discarded; if Axis or Engines are incomplete the game is
  lost.
- **Engine loss (TER Lajes).** The Engine slots are blocked, each player rolls 4 dice
  but places only 3, and the plane advances 1 space automatically at the end of every
  round. Mastery is not available.

## 6. Approach track data model

`spaces[1..size]`, each `{ planes, trafficDice, turns? }` where `turns` is the list of
permitted axis values. Position 1 is the clouds where the plane starts; position `size`
is the airport. Plane tokens may sit on the airport space. Tracks are transcribed in
`src/data/approaches.ts`; see `docs/DATA.md`.

## 7. Landing (end of the final round)

All must hold: **A** no plane tokens anywhere on the track, **B** all landing gear and
flap switches green, **C** axis exactly 0, **D** final-round speed ≤ brake (recorded when
the engines resolved), **E** (Intern) no tokens left, **F** (Ice brakes) marker at 5.
Otherwise the plane crashes and the debrief lists the failed checks.

## 8. Special abilities

A scenario grants 0, 1 or 2 cards, chosen by the players from the six:

| Card | Effect |
|---|---|
| Anticipation | each round, before placing their first die, the first player may reroll one of their dice |
| Adaptation | once per game, each player may turn one of their unplayed dice to its opposite face |
| Mastery | two equal dice on the Engines: gain a reroll token if one is available in the supply |
| Control | two equal dice on the Axis: gain a coffee token |
| Synchronisation | once at least one die sits on Landing Gear and one on Flaps this round, roll the traffic die; the Co-Pilot places it on any empty slot regardless of colour as an extra action (coffee allowed) |
| Working Together | once per round, at any time, a player may swap the values of one of their unplaced dice with one of the partner's |

## 9. Loss conditions (complete)

spin (axis ±3) · missing mandatory die at end of round · collision · overshoot · off the
turn corridor · altitude exhausted before the airport · kerosene below 0 · real-time
expiry with Axis/Engines incomplete · failed landing checks A–F.
