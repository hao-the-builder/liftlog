# Liftlog design

The record of what was decided and why. Change this file when the decision changes, not when the code does.

## The scene

Operate mode. One hand, a dim room, ninety seconds between sets, sweaty fingers, a phone that locks mid-rest. The tool disappears into the task. Familiarity is a feature; strangeness without purpose is the failure mode. Delight is rationed to exactly one moment: a record.

Every visual choice traces to the room, read as an instrument rather than as sports kit: the readout on a plate-loaded stack, stamped numerals on a plate, a measuring tool lit from one side in a dark space.

The design is called **Vector**. An instrument that draws with light on an empty field. There is no accent hue anywhere in it; the palette is black, silver and white, and light itself is the accent. That is the whole idea, and the rest of this file is its consequences.

## Palette

Near-black, never `#000000`: it crushes OLED detail and kills the bloom it is supposed to carry. Cool cast, because steel.

**Surfaces are white washes over the void, not opaque greys.** A pane is a plane catching light, so depth comes from stacking translucency rather than from picking a darker swatch. Nesting panes compounds the wash, which is the intent.

| Token | Value | Use |
|---|---|---|
| `bg` | `#060708` | the void |
| `surface` | `white / 2.8%` | panes, resolves to `#0D0E0F` |
| `surface-2` | `white / 5.5%` | raised controls, resolves to `#141516` |
| `surface-3` | `white / 9%` | pressed and disabled, resolves to `#1C1D1E` |
| `line` | `white / 8%` | hairlines, the only divider |
| `line-strong` | `white / 16%` | the edge of a control |
| `text` | `#FBFCFD` | chalk white |
| `muted` | `#A8AEB4` | labels, last-session lines |
| `faint` | `#858B91` | placeholders, helper text |
| `accent` | `#FBFCFD` | the primary action, as light |
| `record` | `#FFFFFF` | records only, nowhere else, ever |
| `danger` | `#B8241A` | destructive only, never a state |

Measured against every surface the app actually renders them on, worst case first: `text` 16.38:1, `muted` 7.51:1, `faint` 4.89:1, all on `surface-3`. `danger` carries a white label at 6.35:1, and its fill reads at 3.04:1 against a pane, so the button has an edge without a border.

`faint` is the floor of the system and is **not** the value the concept drew. Vector had it at `#7A8086`, which measures 4.21:1 on `surface-3`, a fail. The concept never put dim text on the third surface; the app does, on every disabled control label. Measuring the pairings the app renders, rather than the ones the concept drew, is the only reason that was caught.

### Chart colours are different on purpose

| Token | Value | Mark |
|---|---|---|
| `chart` | `#878E95` | the solid fill, 5.83:1 on a pane |
| `chart-dim` | `#5C636C` | a **stroke**, 3.18:1 on a pane |
| `chart-emit` | `#FBFCFD` | the value being read right now |

**The recessive series is an outline, not a darker fill.** This is the one place a monochrome palette genuinely runs out of room. A grey dark enough to sit a clear ordinal step below `chart` lands at 1.66:1 against the pane and simply disappears, so recession cannot be carried by lightness here. It is carried by mark form instead: this week is a filled bar, last week is a stroked one.

`chart-dim` against `chart` is only 1.83:1, below the usual adjacent-step rule, and that is deliberate. Stroke against fill is a categorical-strength difference, so the pair stays separable without the lightness gap. Do not "fix" it by brightening the stroke, because that removes the recession the chart depends on.

A legend swatch has to match the mark, so an outlined series gets an outlined swatch. A filled swatch beside a stroked bar describes a chart the reader is not looking at.

Never substitute `accent` for `chart`.

### The glow budget

Glow is allowed on exactly three things, in ascending brightness:

1. The primary action. A white pill blooms a little just by being white on the void.
2. The running rest timer.
3. A personal record.

Everything else gets a hairline or a wash. A glow is a real bloom, never `box-shadow: 0 0 20px` sprayed on cards.

**A logged set does not glow.** It happens twenty-plus times a session, and twenty emitting checks on one screen spends the entire budget on the least remarkable thing in the app. This was briefly wrong during the Vector conversion, because the old accent glow carried straight over on the rename, and it is the single easiest way to wreck this design.

## Typography

Two families, each with a job, because the numbers are a different kind of object than the labels.

- **Space Grotesk** for all text. Geometric and faintly technical, with enough character in the letterforms to survive at weight 300. Deliberately not Inter.
- **IBM Plex Mono** for every numeral the user reads or edits, and for the wide uppercase micro labels. Monospaced by construction, so digits physically cannot jump during a countdown or a rep edit.

**300 is the body weight and 500 is the ceiling.** Nothing in this design is bold, and no heavier weight is downloaded. The light end is the voice, and a bold numeral shouts over it.

Both families are self-hosted at build time by `next/font`, so no request ever leaves for Google and the app renders correctly on a network that cannot reach them.

Fixed rem scale, ratio ~1.2, no fluid clamp sizing. Tracking is size-specific: `-0.015em` on readouts, `0` on body, `+0.2em` on the mono micro labels.

**Mono is for readouts and columns, not for prose.** A monospaced decimal inside a sentence renders as "81 . 7". Numbers in running text use the sans.

**Tabular figures go on live-updating readouts** (steppers, the timer, table columns) where the value changes in place and the layout must not twitch. Large standalone figures, like the bodyweight hero, use proportional figures, because equal-width digits read loose at display size.

## Layout

Bottom tab bar: **Today · Progress · Body · Plan**. Concrete names, no "Home". 56px plus `env(safe-area-inset-bottom)`, every target at least 44px.

The app shell is a fixed-height column with exactly one scrolling region, which keeps the tab bar and the rest timer planted and stops the mobile URL bar collapsing under the user mid-set.

**Primary actions live in the bottom half.** On an idle Today screen the start card is pushed down with a flex spacer so its buttons land in the thumb zone.

An exercise is a surface, not a stack of cards, and its sets are separated by hairlines rather than nested cards.

### The set row

The row is the product, and it has a hard width budget. On a 390px screen the card is 358px wide and the row carries an index, two steppers and a 48px check. Measured, not guessed:

- step buttons 28px wide, 44px tall
- weight input `4.5rem`, sized for `122.5`
- reps input `2.75rem`
- readout at `1.375rem`

Every number input needs `min-w-0`. An `<input>` carries an intrinsic width of about twenty characters, so flex `min-width: auto` refuses to let it shrink and the row runs off the side of the phone.

Radii, one rule: `4px` controls and chips, `16px` surfaces and sheets, and **full round on every action**. An action in Vector is a capsule. An input is the opposite: a channel cut into the pane, its wash darker than its surroundings and its shadow on the top edge, which is the inverse of how a raised pane is lit.

## Motion

Gate first, then ingredients.

Logging a set happens twenty-plus times a session, so it gets press feedback and a state change, nothing more: `scale(0.97)` at 120-150ms. No entrance animation on set rows, no staggered page loads. The rest timer is `linear` and timestamp-driven.

The record is the one authored moment, and it is rare enough to earn it. In Vector it does not pop and does not recolour: **the row ignites.** Two bright hairlines bracket it, the values pick up a diffraction bloom, the check fills white, and a bloom spreads past the edge and fades. 420ms.

Because there is no record colour to switch to, the badge cannot be the thing that identifies a record — it would be white type on a white-ish wash like everything else. The badge carries the *word*, and the brightness carries the feeling. Identity by name, never by colour alone, which is also what makes a record survive a colourblind reader and a greyscale screenshot.

Curves, and only these: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`. Never `ease-in` on UI. Reduced motion ships with every animation, not after.

## The mobile platform layer

Shipped before the first component, each line for a documented reason: `viewport-fit=cover` with `env(safe-area-inset-*)`, `100dvh` for the shell, `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`, `overscroll-behavior: none` on the root and `contain` on inner scrollers, 16px minimum on inputs so iOS never zooms, `user-select: none` on controls only, hover gated behind `@media (hover: hover) and (pointer: fine)`, `theme-color` matching the surface at the top of the page.

Browser surfaces are themed too: selection, caret, focus ring, scrollbar. They belong to the design even though we did not draw them.

## Copy

Gym-floor voice. Terse, imperative, no marketing verbs. "Log it." "Next up: Push A." "Last time 57.5 kg x 10, 9, 8." "No plan yet. Build your first day."

Empty states say what to do next. Errors name the problem and the recovery. Zero em-dashes in shipped text.

## Banned for this project

Icon-heading-text cards as page structure. Eyebrow or kicker labels above a heading. Gradient text. Section numbers. Hand-rolled SVG icons (Phosphor, one weight, everywhere; the logo is the single authored mark). Decorative status dots. Spinners where a skeleton belongs. Dashed gridlines. Dual-axis charts. A number on every data point. **Any hue at all** beyond the hazard red, and that only ever means "this destroys something".

Also banned: `backdrop-filter` on a pane in normal document flow. Blur is for the layers that genuinely have content moving behind them, which is the tab bar, a sheet, the rest timer and a tooltip. Those use the void at 82% rather than a white wash, because glass over moving content has to obscure it or the type on top stops being readable.

## Open

- Nothing has been checked on real hardware. Every mobile fix above is correct by construction; the mobile skill's own rule is that this is not the same as confirmed on a device.
- Lighthouse has not been run against a deployed build.
