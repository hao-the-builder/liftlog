# Liftlog design

The record of what was decided and why. Change this file when the decision changes, not when the code does.

## The scene

Operate mode. One hand, a dim room, ninety seconds between sets, sweaty fingers, a phone that locks mid-rest. The tool disappears into the task. Familiarity is a feature; strangeness without purpose is the failure mode. Delight is rationed to exactly one moment: a record.

Every visual choice traces to the room: the volt-yellow of training gear, the LED readout on a plate-loaded stack, stamped numerals on a plate, steel under one bad ceiling light.

## Palette

Near-black, never `#000000`: it crushes OLED detail and kills the glow it is supposed to carry. Cool cast, because steel.

| Token | Value | Use |
|---|---|---|
| `bg` | `#0B0D0C` | app base |
| `surface` | `#141715` | exercise blocks, cards, sheets |
| `surface-2` | `#1D211E` | inputs, pressed states |
| `surface-3` | `#262B28` | tracks behind progress |
| `line` | `#2A2F2C` | hairlines, the only divider |
| `text` | `#F2F5F1` | chalk white |
| `muted` | `#8A918C` | labels, last-session lines |
| `faint` | `#767D78` | placeholders, helper text |
| `volt` | `#D4FF3F` | the one working accent |
| `pr` | `#FF2E88` | records only, nowhere else, ever |

`text`, `muted` and `faint` all clear 4.5:1 on `bg`. `faint` was raised from `#5C635E`, which measured 1.96:1 and was unusable for the helper text it was meant for.

### Chart colours are different on purpose

| Token | Value |
|---|---|
| `chart` | `#829F22` |
| `chart-dim` | `#4A5A18` |

The UI accent sits at OKLCH L 0.94. As a 2px stroke it is fine; as a bar fill it blooms. These two steps were run through the data-viz validator against the chart surface `#141715`: both inside the dark lightness band, above the chroma floor, over 3:1 contrast, and a clean monotone ordinal pair. `chart-dim` was stepped down a second time after looking at the rendered chart, because the pair separated on paper and not on a phone.

Never substitute `volt` for `chart`.

### The glow budget

Glow is allowed on exactly four things:

1. The set check at the instant it logs.
2. The running rest timer.
3. Progress fill.
4. A personal record.

Everything else gets a hairline or a tinted surface. A glow is a tinted shadow with a real offset plus a tight bloom, never `box-shadow: 0 0 20px accent` sprayed on cards. Inactive states never carry saturated colour.

## Typography

Two families, each with a job, because the numbers are a different kind of object than the labels.

- **Archivo** for all text. Industrial grotesque, signage lineage, holds at 11px and at 48px. Deliberately not Inter.
- **Geist Mono** for every numeral the user reads or edits. Monospaced by construction, so digits physically cannot jump during a countdown or a rep edit.

Fixed rem scale, ratio ~1.2, no fluid clamp sizing. Tracking is size-specific: `-0.03em` on readouts, `0` on body, `+0.08em` on small-caps labels.

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

Radii, one rule: `6px` controls and chips, `14px` surfaces and sheets, full round only for circular tap targets.

## Motion

Gate first, then ingredients.

Logging a set happens twenty-plus times a session, so it gets press feedback and a state change, nothing more: `scale(0.97)` at 120-150ms. No entrance animation on set rows, no staggered page loads. The rest timer is `linear` and timestamp-driven.

The record is the one authored moment, and it is rare enough to earn it: the badge arrives at `scale(0.92) → 1` with a slight overshoot and a magenta bloom, 320ms.

Curves, and only these: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`. Never `ease-in` on UI. Reduced motion ships with every animation, not after.

## The mobile platform layer

Shipped before the first component, each line for a documented reason: `viewport-fit=cover` with `env(safe-area-inset-*)`, `100dvh` for the shell, `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`, `overscroll-behavior: none` on the root and `contain` on inner scrollers, 16px minimum on inputs so iOS never zooms, `user-select: none` on controls only, hover gated behind `@media (hover: hover) and (pointer: fine)`, `theme-color` matching the surface at the top of the page.

Browser surfaces are themed too: selection, caret, focus ring, scrollbar. They belong to the design even though we did not draw them.

## Copy

Gym-floor voice. Terse, imperative, no marketing verbs. "Log it." "Next up: Push A." "Last time 57.5 kg x 10, 9, 8." "No plan yet. Build your first day."

Empty states say what to do next. Errors name the problem and the recovery. Zero em-dashes in shipped text.

## Banned for this project

Icon-heading-text cards as page structure. Eyebrow or kicker labels above a heading. Gradient text. Section numbers. Hand-rolled SVG icons (Phosphor, one weight, everywhere; the logo is the single authored mark). Decorative status dots. Spinners where a skeleton belongs. Dashed gridlines. Dual-axis charts. A number on every data point. Any accent colour that is not `volt` or `pr`.

## Open

- Nothing has been checked on real hardware. Every mobile fix above is correct by construction; the mobile skill's own rule is that this is not the same as confirmed on a device.
- Lighthouse has not been run against a deployed build.
