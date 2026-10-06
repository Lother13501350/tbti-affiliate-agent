---
name: "TBTI Affiliate Agent"
description: "A neutral operations interface with a scoped, operable sample workspace."
colors:
  demo-action: "#17644b"
  demo-action-hover: "#114e3b"
  demo-action-active: "#0d4231"
  demo-ink: "#19352e"
  demo-muted: "#4b615a"
  demo-canvas: "#f7f9f7"
  surface: "white"
  demo-line: "#d8e1db"
  demo-control-line: "#b4c6bb"
  demo-control-hover: "#e7efe9"
  demo-control-active: "#d8e6dc"
  demo-table-head: "#eaf0eb"
  demo-focus: "#256b52"
  demo-status-neutral: "#42584b"
  demo-status-positive: "#15573a"
  demo-status-negative: "#96342b"
  demo-status-pending: "#76531a"
  operations-ink: "oklch(20.5% 0 none)"
  operations-muted: "oklch(43.9% 0 none)"
  operations-line: "oklch(92.2% 0 none)"
  operations-hover: "oklch(97% 0 none)"
  operations-dark-canvas: "oklch(14.5% 0 none)"
  operations-dark-line: "oklch(26.9% 0 none)"
  operations-dark-muted: "oklch(87% 0 none)"
typography:
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Noto Sans TC\", \"PingFang TC\", \"Microsoft JhengHei\", sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  demo-heading:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Noto Sans TC\", \"PingFang TC\", \"Microsoft JhengHei\", sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  section-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Noto Sans TC\", \"PingFang TC\", \"Microsoft JhengHei\", sans-serif"
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.55
    letterSpacing: "-0.015em"
  item-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Noto Sans TC\", \"PingFang TC\", \"Microsoft JhengHei\", sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 650
    lineHeight: 1.55
  detail:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Noto Sans TC\", \"PingFang TC\", \"Microsoft JhengHei\", sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  control:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Noto Sans TC\", \"PingFang TC\", \"Microsoft JhengHei\", sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Noto Sans TC\", \"PingFang TC\", \"Microsoft JhengHei\", sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.55
  status:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Noto Sans TC\", \"PingFang TC\", \"Microsoft JhengHei\", sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.55
  csv:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  control: "7px"
  field: "8px"
  operations-card: "12px"
spacing:
  px-8: "8px"
  px-10: "10px"
  px-12: "12px"
  px-16: "16px"
  px-20: "20px"
  px-24: "24px"
  px-32: "32px"
components:
  button-primary:
    backgroundColor: "{colors.demo-action}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  button-primary-hover:
    backgroundColor: "{colors.demo-action-hover}"
  button-primary-active:
    backgroundColor: "{colors.demo-action-active}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.demo-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.demo-control-hover}"
  select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.demo-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  csv-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.demo-ink}"
    typography: "{typography.csv}"
    rounded: "{rounded.field}"
    padding: "12px"
  status-label:
    textColor: "{colors.demo-status-neutral}"
    typography: "{typography.status}"
  proposal-row:
    textColor: "{colors.demo-ink}"
    padding: "18px 0"
  operations-card:
    rounded: "{rounded.operations-card}"
---

# Design System: TBTI Affiliate Agent

## Overview

**Creative North Star: "The Operations Workbench"**

The Operations Workbench is a quiet, compact interface for inspecting records and making explicit decisions. The existing Chinese administration UI supplies the authority: system typography, neutral surfaces, restrained borders, readable tables, and small practical controls. The English sample workspace extends that grammar with a muted green action color and a slightly greener neutral canvas.

This document records the built `/demo` surface and the shared administration patterns sampled in `src/app/globals.css` and `src/app/admin/`. Tokens prefixed `demo-` and the demo typography hierarchy apply to the sample workspace. They do not replace the administration's Tailwind neutral palette, Chinese labels, or existing light/dark behavior. No new brand identity, display face, or imagery system has been introduced. The demo-specific composition remains in `.impeccable/surfaces/src-app-demo-page-tsx.md`.

**Key Characteristics:**

- Compact, readable operations density.
- Thin dividers and tonal table headers rather than elevation.
- Green-filled controls for the principal operation and positive decision.
- Explicit status words, evidence, outcomes, and action receipts.
- English sample workspace alongside the established Chinese administration UI.

## Colors

The administration remains neutral; the sample workspace uses low-saturation green neutrals with a darker green action signal. Frontmatter preserves the literal demo CSS colors and the incumbent Tailwind OKLCH neutral values.

### Primary

- **Operations Green** (`demo-action`): primary import and affirmative decision controls, and underlined links inside the demo.
- **Deep Operations Green** (`demo-action-hover`): pointer hover on primary controls.
- **Pressed Operations Green** (`demo-action-active`): primary-control activation, including keyboard activation.

### Neutral

- **Green Ink** (`demo-ink`): sample-workspace body text, headings, and control text.
- **Muted Green Ink** (`demo-muted`): supporting copy, evidence, footnotes, and action history.
- **Quiet Green Canvas** (`demo-canvas`): the full sample-workspace background.
- **White Surface** (`surface`): buttons, native selects, and the CSV editor.
- **Divider Green** (`demo-line`): section and row separation.
- **Control Stroke** (`demo-control-line`): form-control boundaries.
- **Soft Interaction Fill** (`demo-control-hover`, `demo-control-active`): supporting-button hover and active response.
- **Table Wash** (`demo-table-head`): both recurring table headers.
- **Focus Green** (`demo-focus`): the demo's keyboard focus outline.
- **Administration Neutrals** (`operations-*`): the established neutral text, border, navigation hover, and dark-surface values. These are not recolored by the demo.

The status tokens are semantic signals, not extra brand accents: neutral, positive, negative, and pending. Positive outcomes, rejected/refunded/cancelled records, and pending records retain visible words; color supplements their meaning. The error feedback uses a separate red in the implementation and is not promoted into a general palette role.

**The Action Signal Rule.** Use the demo green fill for the principal operation and affirmative review decision. Supporting report loaders, resets, and rejection controls retain white surfaces.

## Typography

**Heading and Body Font:** the incumbent system sans-serif stack in the frontmatter, including the existing Traditional Chinese fallbacks.

**CSV Font:** the compact system monospace stack in `typography.csv`.

**Character:** practical, compact, and readable. The same sans-serif family carries headings, controls, records, and explanation; weight and size establish hierarchy. No separate display type system is established.

### Hierarchy

- **Demo heading:** bold task title; reduces from the desktop token to (1.625rem) at the demo's (850px) breakpoint.
- **Section title:** semibold operational sections such as imports, review, curation, and history.
- **Item title:** semibold proposal names within the review queue.
- **Body:** the sample-workspace default; introductory copy is constrained to (70ch).
- **Detail:** explanation, feedback, proposal rationale, totals, and history.
- **Control / label:** compact button and select text; labels gain weight rather than uppercase styling.
- **Status:** compact literal state words; table numbers use `font-variant-numeric: tabular-nums`.
- **CSV:** monospaced report content with a more generous line height.

Administration retains its existing smaller Tailwind hierarchy rather than inheriting the demo heading sizes. Small table metadata in the demo uses (0.6875rem); it is contextual supporting text, not the default label scale.

**The Readable Record Rule.** Keep numbers tabular in tables and preserve literal status words alongside semantic color. CSV is the sole recurring monospace field in the demo.

## Layout

The administration uses a centered `max-w-6xl` container and compact padding. The sample workspace uses its own centered shell, capped at (1240px), with desktop padding of (38px 32px 40px). Recurring small gaps and padding are recorded in the frontmatter; the stylesheet remains the source for individual measurements.

For `/demo`, the header and role/reset toolbar precede feedback and the working area. The import/report region and review queue form a (1.6fr / 1fr) grid with a (36px) gap. A left divider and (28px) inset separate the review queue. Product curation and recent actions follow at full width. This is a surface composition, not a mandatory layout for every operations screen.

At (850px) and below, the working regions stack, shell padding becomes (26px 20px), the toolbar stacks, and the review queue uses a top divider. At (440px) and below, horizontal shell padding becomes (16px), the header stacks, and toolbar controls wrap. The Platform label and native select stay in one flex group; the group loses its automatic left margin at this narrow breakpoint.

Tables retain their columns inside horizontal scroll containers with contained inline overscroll. Content columns have a zero minimum width to prevent page overflow. The CSV editor expands from a desktop minimum height of (185px) to (220px) on the narrowest screens and remains vertically resizable.

## Elevation & Depth

The demo is flat: depth comes from white control surfaces, tonal table headers, thin dividers, and whitespace. No box shadows are used. The administration's existing cards use a subtle current-color border (`color-mix(in oklab, currentColor 14%, transparent)`) rather than shadows. Keyboard focus is a visible outline, not elevation.

**The Divider Rule.** Separate operational sections with thin borders and spacing. The sample workspace has no box shadows, gradients, or floating panels.

## Shapes

The incumbent administration card is gently rounded; its radius is recorded separately from the demo's compact controls and slightly rounder CSV field. Do not unify these distinct existing values merely to create a new global radius scale. Demo proposal rows are open, square-ended sections separated by a bottom border. Status words do not acquire pill backgrounds or decorative badges on this surface.

## Components

### Buttons

Compact, explicit operational controls. Demo buttons share a thin control stroke, compact padding, and a minimum height of (40px). Primary controls have white text, green fill, and semibold weight. Supporting controls remain white, gain a soft green hover fill, and use the inherited ink color. Disabled controls use opacity (0.55) and the unavailable cursor.

Demo focus-visible uses an outline of (3px) with a (3px) offset. Buttons transition background color for (0.15s); reduced-motion preference removes that transition. Primary activation uses its dedicated dark green fill so white text remains readable for both pointer and keyboard activation.

### Inputs / Fields

Native selects use the shared compact-control grammar. Every visible select has a real associated label. Keep a label and its select within one wrapping unit. The CSV field is white, full width, bordered, vertically resizable, and monospaced; it shares the demo focus outline. The demo does not introduce a custom select menu or a modal editor.

### Status Labels

Plain, compact text with semantic color and capitalized status words. They remain readable in rows and proposal headings without a surrounding badge shape. Positive decision outcomes use the same positive status color.

### Cards / Containers

Existing administration cards retain their current-color border and established card radius. In the sample workspace, major sections and proposal entries use dividers instead. Do not promote a demo proposal into the administration card pattern unless the surrounding incumbent screen already uses it.

### Navigation

The administration's compact Chinese tab bar is retained: neutral text at rest, a light neutral hover surface, and an ink-filled active tab with white text. Its existing dark variants invert the selected tab and use darker neutral hover/border surfaces. `/demo` has no new tab navigation; its source and verification links are ordinary underlined links.

### Review Rows and Feedback

A review row places a proposal title beside its status, followed by rationale, evidence, and two explicit decision controls. Resolved rows replace those controls with an outcome sentence. The advisory row uses **Acknowledge alternative** and **Reject alternative**, preserving the distinction between a recorded decision and product mutation.

A reserved feedback area above the work regions uses an atomic polite live region. Errors use an alert; loading failure adds a retry control. Imported records, updated product values, and recent-action receipts make the result inspectable in the same surface. These are demonstrated with fictional fixtures and fixed suggestions.

**The Explicit Outcome Rule.** Decision labels describe the permitted effect. An advisory alternative is acknowledged or rejected; it must not imply that a replacement has occurred.

## Do's and Don'ts

### Do:

- **Do** preserve the system font stack and neutral administration styles when extending existing operations screens.
- **Do** use the scoped demo tokens for new content inside the sample workspace.
- **Do** keep labels physically grouped with their controls when a toolbar wraps.
- **Do** preserve table semantics and horizontal scrolling on narrow screens.
- **Do** show textual status, supporting evidence, and a visible outcome after a reviewed action.
- **Do** retain the visible fictional-data and session/reset boundaries in the sample workspace.

### Don't:

- **Don't** apply the demo green canvas and palette globally to administration screens.
- **Don't** introduce a separate decorative display font, imagery, or depth treatment into this precise workflow extension.
- **Don't** turn every section into a shadowed card; the demo's section dividers already establish hierarchy.
- **Don't** communicate status or permission solely through color.
- **Don't** describe an advisory acknowledgment as a product replacement.


The visual evidence for this documentation is the final public demo capture at desktop (1280px) and mobile (390px) on October 6, 2026, in `.impeccable/review/desktop.png` and `.impeccable/review/mobile.png`. These depict fictional fixture data. The shipping screenshot and its actual-capture provenance are recorded in `docs/screenshots/PROVENANCE.md`. No stock or generated rasters are part of the recorded system. Administration evidence is source-based; this pass does not establish new administration mobile behavior or live provider correctness.
