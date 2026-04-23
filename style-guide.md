# Loan Ledger: visual style guide

Editorial, typography-led, restrained in color. The app treats the user's financial life the way a serious magazine treats a long-form piece: with space, clear hierarchy, and just enough personality to be warm without being loud.

## Design principles

**Typography does the heavy lifting.** Hierarchy comes from size, weight, and rhythm rather than from colored backgrounds or borders. If a section needs to stand out, the type gets bigger. If something needs emphasis, the type gets heavier or shifts to italic. Color is used sparingly enough that when it appears, it means something.

**One accent, not a palette.** There is a primary accent (Ink Blue) and a secondary accent (Marigold) used only for the specific purposes described below. The rest of the interface is ink, paper, and a muted neutral scale. This is the single biggest rule; if a designer reaches for a fifth color, they're probably doing something wrong.

**Serif for display, sans for data.** Headlines, loan names, and editorial moments use a warm serif. Numbers, tables, labels, and dense data use a clean sans. The contrast between them is the app's personality, in the same way a well-designed magazine uses two typefaces to create voice.

**Generous whitespace.** Nothing crowds the edges. The dashboard breathes. A payment history table with a lot of rows doesn't need to fill every pixel; it needs to be easy to read one row at a time.

**Playful in the details, serious in the structure.** The chart captions can have personality. The scenario counterfactual readout can be a little warm ("if you'd never made those extra payments, you'd still owe $42,300 more today"). The underlying structure — the grid, the type scale, the alignment — stays disciplined.

## Color palette

```
/* Paper — the base surface */
--ll-paper:         #FAF7F2;   /* warm off-white, main background */
--ll-paper-sunk:    #F3EFE8;   /* cards, subtle inset surfaces */
--ll-paper-raised:  #FFFFFF;   /* modal, floating panel */

/* Ink — the text and structure scale */
--ll-ink:           #1A1915;   /* body text, primary */
--ll-ink-soft:      #3D3B35;   /* body text on paper-sunk */
--ll-ink-muted:     #7A766D;   /* secondary labels, captions */
--ll-ink-faint:     #B8B4AA;   /* disabled, borders, dividers */

/* Primary accent — Ink Blue */
--ll-accent:        #1F3A5F;   /* deep editorial blue, primary actions */
--ll-accent-hover:  #284A78;
--ll-accent-soft:   #E3E8F0;   /* tinted surfaces derived from accent */

/* Secondary accent — Marigold */
--ll-mark:          #D97E2B;   /* warm terracotta-gold, for marks and highlights */
--ll-mark-hover:    #B86820;
--ll-mark-soft:     #F9E8D4;

/* Semantic — derived, used only for status */
--ll-positive:      #3F6D4E;   /* muted forest green */
--ll-negative:      #8C3A2E;   /* rust red, never pure red */
--ll-positive-soft: #E4EDE6;
--ll-negative-soft: #F2E1DD;
```

### Color roles

**Paper.** The app sits on a warm off-white, not pure white. `--ll-paper` is the default background. `--ll-paper-sunk` is for cards or inset surfaces (the scenarios panel, the amortization table). `--ll-paper-raised` is for things that float above everything (a modal, a dropdown). The hierarchy goes sunk → paper → raised, with ink getting slightly more or less intense to match.

**Ink.** Four levels of warm near-black. Body text is `--ll-ink` on paper, `--ll-ink-soft` on paper-sunk. Secondary labels use `--ll-ink-muted`. Dividers and borders use `--ll-ink-faint`, but we prefer whitespace and type hierarchy over borders, so they're rare.

**Ink Blue (primary accent).** Used for:
- Primary buttons
- Active navigation
- The "scheduled balance" line on the balance chart
- Hyperlinks
- The equity value in the summary header

Not used for: decorative emphasis, background fills, "important" text that isn't actionable.

**Marigold (secondary accent).** Used for:
- The "actual balance" line on the balance chart (the hero line — it shows where you actually are)
- The counterfactual readout highlight
- Scenario callouts
- The rate schedule editor's active row
- Small celebratory moments (equity gauge fill when above 50%)

Not used for: warnings, errors, default UI chrome.

**Positive and negative.** Reserved for semantic status. A delta that reduces interest shows in `--ll-positive`. A flagged missed payment shows in `--ll-negative`. These colors never appear except to communicate status. A scenario's payoff-date delta that's better than baseline gets positive; worse gets negative.

### Dark mode

```
--ll-paper:         #16140F;   /* deep ink with a warm cast */
--ll-paper-sunk:    #1F1D17;
--ll-paper-raised:  #28251E;

--ll-ink:           #F2EEE5;
--ll-ink-soft:      #D4CFC3;
--ll-ink-muted:     #8E8A7F;
--ll-ink-faint:     #4A4740;

--ll-accent:        #7BA3D0;   /* lifted Ink Blue for contrast */
--ll-accent-hover:  #9BB8DD;
--ll-accent-soft:   #1F2A3A;

--ll-mark:          #E8A058;   /* lifted Marigold */
--ll-mark-hover:    #F0B574;
--ll-mark-soft:     #3A2A18;

--ll-positive:      #7AB091;
--ll-negative:      #C28070;
--ll-positive-soft: #1F2E25;
--ll-negative-soft: #2E201C;
```

Dark mode respects the same hierarchy. Paper gets darker, ink gets lighter, accents get lifted to maintain contrast. The warmth persists; nothing is pure black or pure cyan.

## Typography

Two typefaces. A warm serif for display, a clean sans for UI chrome and numbers.

```css
--ll-font-serif:  'Source Serif 4', 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
--ll-font-sans:   'Inter', system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', sans-serif;
--ll-font-mono:   'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
```

**Source Serif 4** for display. It has the authority of a serif without feeling old-fashioned, and it has real italic variants (not just slanted Roman) that do beautiful work in editorial callouts. Google Fonts. Variable font, one file.

**Inter** for UI. It's the most readable modern sans at small sizes, handles tabular figures well for number columns, and has a huge weight range. Google Fonts. Variable font.

**JetBrains Mono** for anything that should read as code or configuration: the YAML preview in the validation diff view, the raw schema reference in docs.

### Tabular figures

Numbers in tables and chart axes must use tabular figures so columns align:

```css
.ll-num, .ll-amortization td, .ll-chart-axis {
  font-feature-settings: "tnum" 1, "lnum" 1;
  font-variant-numeric: tabular-nums lining-nums;
}
```

This is non-negotiable for a financial app. A column of payment amounts that jitters because some digits are narrower than others looks unprofessional.

### Type scale

A modular scale, 1.25 ratio, anchored at 16 px body.

```
--ll-text-xs:   0.75rem;   /* 12px — micro labels, chart tick marks */
--ll-text-sm:   0.875rem;  /* 14px — secondary labels, captions */
--ll-text-base: 1rem;      /* 16px — body, table rows */
--ll-text-lg:   1.25rem;   /* 20px — emphasized body */
--ll-text-xl:   1.5625rem; /* 25px — section headings */
--ll-text-2xl:  1.953rem;  /* 31px — page headings */
--ll-text-3xl:  2.441rem;  /* 39px — hero numbers */
--ll-text-4xl:  3.052rem;  /* 49px — the equity number */
```

### Type roles

| Role | Font | Size | Weight | Notes |
| --- | --- | --- | --- | --- |
| Page title | Serif | `--ll-text-2xl` | 500 | e.g., "123 Main St", the loan name on detail view |
| Section heading | Serif | `--ll-text-xl` | 500 | e.g., "Scenarios", "Balance over time" |
| Body | Sans | `--ll-text-base` | 400 | default |
| Body emphasis | Sans | `--ll-text-base` | 600 | sparingly |
| Hero number | Serif | `--ll-text-4xl` | 400 | the equity value, the remaining balance |
| Supporting number | Sans (tabular) | `--ll-text-lg` | 500 | e.g., next payment date, monthly amount |
| Table content | Sans (tabular) | `--ll-text-sm` | 400 | amortization rows |
| Micro label | Sans | `--ll-text-xs` | 500 | axis labels, chart ticks, uppercase tracking |
| Editorial callout | Serif italic | `--ll-text-lg` | 400 | counterfactual readout, scenario descriptions |
| Code / YAML | Mono | `--ll-text-sm` | 400 | diff view, schema examples |

### Micro labels

Small uppercase labels with generous letter-spacing give sections a magazine feel:

```css
.ll-label-micro {
  font-family: var(--ll-font-sans);
  font-size: var(--ll-text-xs);
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
}
```

Used for: chart axis titles, section eyebrow labels above a heading, table column headers. Used maybe six times on any given screen. They should feel like quiet datelines in a newspaper layout.

### Editorial callouts

Italic serif in a slightly larger size, used for moments where the app is speaking with voice:

> *If you had never made your extra payments, you'd still owe $42,300 more today and wouldn't pay off until August 2052.*

These appear in the counterfactual readout, at the top of the scenarios panel when no scenario is active, and in the onboarding copy. They're where the app gets to be warm. Limit one per screen.

## Layout

### Grid

Content lives in a max-width column with breathing room. Charts and tables can break out wider, but prose and headings stay narrow.

```
--ll-max-readable: 68ch;       /* ~68 characters, ideal for prose */
--ll-max-content:  1120px;     /* page max width */
--ll-gutter:       clamp(1rem, 2vw, 2rem);
```

The loan detail page uses a two-column grid on desktop: 2/3 for the primary content (summary, charts, amortization) and 1/3 for the scenarios panel. On tablet and smaller, scenarios collapse below.

### Spacing

```
--ll-space-1:  0.25rem;  /* 4px */
--ll-space-2:  0.5rem;   /* 8px */
--ll-space-3:  0.75rem;  /* 12px */
--ll-space-4:  1rem;     /* 16px */
--ll-space-5:  1.5rem;   /* 24px */
--ll-space-6:  2rem;     /* 32px */
--ll-space-7:  3rem;     /* 48px */
--ll-space-8:  4rem;     /* 64px */
```

Between sections: `--ll-space-7` minimum. Between related components within a section: `--ll-space-5`. Between rows in a dense table: `--ll-space-3`.

### Cards and surfaces

Cards exist but are quiet. No drop shadows. No hard borders. The separation comes from a slight paper-color shift and generous padding.

```css
.ll-card {
  background: var(--ll-paper-sunk);
  border-radius: 4px;
  padding: var(--ll-space-5) var(--ll-space-6);
}
```

Borders appear only where they do functional work, like separating amortization rows or marking the current-year divider. They're always `1px solid var(--ll-ink-faint)`.

## Charts

The balance-over-time chart is the app's hero. It carries the single most important story: what you owe and how that's changing. The visual treatment should feel like a well-set newspaper chart, not a generic business dashboard.

**Lines.**
- Scheduled balance: thin (1.5 px), `--ll-accent` (Ink Blue), 0.7 opacity.
- Actual balance: thick (2.5 px), `--ll-mark` (Marigold), full opacity.
- Projected (future): same as its source line but dashed (4,2 dash pattern).
- Active scenarios: dashed, muted ink colors in a sequence (`#5C6B7E`, `#8A7D5C`, `#6D8A5C`, ...), never Marigold (reserved for actual).

**Axes.** `--ll-ink-muted` ticks, tabular figures, micro labels for titles. No grid lines — the whitespace carries the structure. One horizontal rule at `y = 0` only if the chart includes zero.

**Tooltips.** White paper-raised card, subtle shadow, serif for the date, sans tabular for the numbers. Keep them small and single-glance.

**Annotations.** The current date, the payoff date, any scenario pivot points get a thin vertical `--ll-ink-faint` line with a small serif italic label rotated 0° (no rotated text — keep it legible). These are the moments to let the chart breathe with a little editorial voice.

The payment composition chart (stacked bars for principal/interest/escrow/extra) uses a restricted palette:
- Principal: `--ll-accent` at full opacity
- Interest: `--ll-accent` at 0.5 opacity (same hue, softer)
- Escrow: `--ll-ink-faint`
- Extra: `--ll-mark`

The same hue at different opacities reads as "same thing, different emphasis," which is what principal and interest are. Escrow is a neutral third. Extra is the celebratory Marigold.

## Components

### Buttons

Primary: solid `--ll-accent` on paper, white text, no shadow, 8 px radius, 12/20 padding. Hover lifts to `--ll-accent-hover`. Used sparingly — usually one per screen.

Secondary: transparent with a 1 px `--ll-ink-faint` border, `--ll-ink` text. On hover, border shifts to `--ll-ink`.

Tertiary: no border, no background, underlined on hover. For actions that are navigational rather than transformative.

Destructive: `--ll-negative` text on transparent background, becomes `--ll-negative-soft` fill on hover. Avoid full red buttons; they shout.

### Inputs

Quiet by default. No visible border, just a 1 px underline in `--ll-ink-faint`. On focus, the underline thickens to 2 px and shifts to `--ll-accent`. Placeholder in `--ll-ink-muted`. Label above the field in `.ll-label-micro`.

This treatment feels more like writing on paper than filling in a form, which matches the file-as-source-of-truth philosophy.

### Tables

The amortization table is the second most important view. It should read like a well-set bond table in a financial paper.

- Column headers: micro labels, `--ll-ink-muted`.
- Rows: alternating `transparent` and `--ll-paper-sunk` backgrounds. Very subtle.
- Numbers: tabular, right-aligned.
- Actual-payment rows: a thin 2 px `--ll-mark` left border, which visually links them to the Marigold actual-balance line on the chart above.
- Scheduled-projection rows: no accent.
- Current-year divider: a 1 px `--ll-ink-faint` rule with a micro label set in the margin.

### Equity gauge

The one moment of visual flourish. A 3/4 arc (from 7 o'clock around to 5 o'clock), stroke width 6 px, rendered in two parts:
- Background track: `--ll-ink-faint`.
- Filled portion: `--ll-mark`, proportional to equity fraction.

The center of the gauge holds the equity number in serif at `--ll-text-3xl`, with a micro label above it ("EQUITY").

This is the single most "product" moment in the app. Everywhere else is typographic.

### Scenario cards

Each saved scenario is a card with:
- Scenario name in serif, `--ll-text-lg`.
- Mutations listed as plain sans bullets underneath.
- A small delta readout in tabular figures: `−$12,400 interest`, `+17 months earlier`.
- Positive deltas in `--ll-positive`, negative in `--ll-negative`.
- Active scenarios get a thin 2 px left border in their assigned chart color.

## Empty states

Empty states are the place to be warmest. They use an editorial callout, a single button, and nothing else.

Example, new-user empty state on the loan list:

> *No loans yet. Every loan in Loan Ledger lives in its own YAML file — human-readable, yours to edit, yours to share.*
>
> [ Open a file ]     [ Create from template ]

Two buttons, no illustration, no splash graphic. The voice does the work.

## Icons

Sparingly. When used, line icons at 1.5 px stroke, rounded caps, matching the Inter weight. The library is Phosphor (`phosphor-vue`) at the "regular" weight. Icons never appear without an accompanying text label except in the smallest UI moments (a close X on a dialog, an expand triangle on a collapsible section).

## Motion

Interactions should feel like turning a page, not opening a drawer. Default timing:

```
--ll-easing: cubic-bezier(0.32, 0.72, 0, 1);   /* gentle overshoot, print-feel */
--ll-duration-fast:   120ms;
--ll-duration-base:   220ms;
--ll-duration-slow:   360ms;
```

Scenarios overlay onto the chart with a 220 ms line-draw from left to right. Dialogs fade + shift up 8 px, 220 ms. Hover states are instant (60 ms) — delayed hovers feel sluggish.

No bouncing. No springs. No particle effects. The motion is quiet.

## Inspiration references

Directions that informed this guide:

**The Economist Espresso, The Atlantic, The New York Times Morning newsletter.** For the serif-for-display, sans-for-data pairing and the micro-label rhythm.

**Mailbrew and Readwise.** For the warm off-white paper, the generous whitespace, and the restrained use of a single accent.

**Are.na.** For the confidence to let typography and whitespace do nearly all the work, with a single accent color (theirs is blue) doing the minimum necessary.

**Lukasz Tyrala's personal site, Bradley Taunt's personal site, any well-set Hugo/Zola blog in the "Minima" style.** For the feeling that the interface is a document rather than an application.

**Stripe Radar's Falcon dashboard (internal tool).** For showing that a financial product can feel authoritative without being cold.

**Linear.** Not for the aesthetic directly — Linear is darker and more futurist — but for the discipline of one accent color used consistently and the refusal to clutter.

## Hard rules

- Never more than two accent colors on any screen.
- No drop shadows except on floating panels (modals, dropdowns).
- No colored backgrounds behind text except the semantic soft tints (`--ll-positive-soft`, etc.) in genuinely semantic contexts.
- No icon-only buttons for anything destructive or ambiguous.
- All numeric columns use tabular figures.
- Borders are a last resort. Whitespace first, paper-color shift second, border third.
- If a screen starts to feel busy, the fix is always to remove, not to add.
