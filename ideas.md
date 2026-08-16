# I’m Snappy Design Exploration

## Three Visual Directions

### 1. Quiet Intelligence

**Very Brief Intro:** A warm, editorial studio for thought that makes an AI agent feel calm, considered, and capable. The interface carries the serenity of an independent magazine rather than the visual language of a developer console.

**Probability:** 0.07

### 2. Signal Ledger

**Very Brief Intro:** A precise, monochrome command surface organized like a contemporary research notebook. Dense utility cues and hairline rules give expert users a sense of controlled momentum.

**Probability:** 0.04

### 3. Luminous Workshop

**Very Brief Intro:** A tactile digital atelier where flowing color fields meet practical agent controls. The workspace foregrounds making, with materials and movement that suggest a living creative practice.

**Probability:** 0.09

## Selected Direction: Quiet Intelligence

### Design Movement

Contemporary editorial minimalism with soft atmospheric gradients. The interface borrows the visual restraint of a print journal and adapts it to a focused agent workspace.

### Core Principles

1. **Editorial calm over product noise:** generous breathing room, light display type, and carefully rationed dark ink create composure around complex work.
2. **Atmosphere carries the color:** pastel mint, peach, lavender, sky, and rose appear only as diffused background blooms—not as UI status colors or CTA fills.
3. **Utility remains legible:** the chat workspace uses explicit hierarchy, tactile states, and human-readable tool progress so it feels capable without becoming visually heavy.
4. **One clear primary action:** the ink send/new-task control is reserved for the most important moment in each context.

### Color Philosophy

An off-white paper floor (#f5f5f5) and warm black ink (#0c0a09) establish seriousness without clinical starkness. Color is experiential rather than instructional: diffuse pastel orbs create a sense of thought moving through the system, while neutral hairlines and white cards preserve clarity.

### Layout Paradigm

An asymmetric editorial worktable: a slim left archive rail, a generous conversation column, and a contextual right-side activity strip on larger screens. The central conversation is allowed to breathe rather than being locked inside a centered marketing-card composition.

### Signature Elements

1. **Atmospheric blooms:** blurred, low-contrast radial gradients that sit behind the welcome state and between columns.
2. **The agent pulse:** a small three-bar rhythm motif that becomes a live-status marker and part of the logo mark.
3. **Margin notes:** compact all-caps labels, timestamps, and source counters that behave like editorial annotations.

### Interaction Philosophy

The workspace responds with quiet certainty. Hover effects lift only one elevation step, tool cards expand in place, and the composer becomes more defined when it receives focus. Features that are presented but not yet wired are candidly identified through a brief "Coming soon" toast.

### Animation

Movement stays under 300ms and is limited to opacity and transform. The welcome artifacts enter with a 40ms cascade; panels slide a few pixels from their anchoring edge; buttons compress to 0.97 scale when pressed. The pastel blooms drift only under `prefers-reduced-motion: no-preference`; reduced-motion users see a static composition.

### Typography System

**Cormorant Garamond** at 300–400 is the open-source editorial stand-in for Waldenburg and is reserved for large greetings, project titles, and summary headings. **Inter** at 400–600 supports message text, controls, navigation, and captions. Display text is tight and light; body copy tracks slightly open for a quietly typographic feel.

### Brand Essence

**I’m Snappy is the calm, editorial workspace for people who want an AI agent to turn questions into considered work.**

Personality: **considered, capable, articulate**.

### Brand Voice

Headlines are observant and quietly specific; CTAs are direct but not urgent; microcopy explains system state in plain language.

Examples:

> "Give the brief a little room to think."

> "Research is underway. I’ll gather the threads, then show the pattern."

### Wordmark & Logo

The wordmark uses the distinctive apostrophe of “I’m Snappy” alongside a quiet geometric word shape. The standalone mark is a circular field holding three uneven, vertical ink bars—a measured pulse that represents an agent collecting, reasoning, and delivering.

### Signature Brand Color

**Archive Mint — #A7E5D3.** It is always diffused, never used as a hard UI fill.

## Style Decisions

- The user-provided ElevenLabs design analysis is the source of truth for palette, spacing, CTA geometry, card depth, and editorial typography rules.
- This is a functional front-end prototype: conversation content, suggested prompts, command controls, expandable work steps, and sidebar navigation will respond locally, while no remote model service will be implied.
- Prominent visual interest will come from generated abstract atmosphere and the in-browser gradient system, rather than stock imagery or simulated customer social proof.
- Archive Mint and related pastels may appear as diffused atmosphere, soft field tint, or the agent pulse only; task status and navigation hierarchy remain ink, paper, and neutral hairlines.
- Cards and panels behave as editorial folios or research notes, using hairline structure and margin annotations before generic rounded dashboard surfaces.
- Every suggested action states a distinct kind of work in calm, specific language; repeated generic helper copy is avoided.
- The compact sidebar is a purpose-built icon rail and the expanded sidebar is a studio index; neither state clips, truncates, or merely compresses the other.
- I’m Snappy is the sole visible product identity. The three-bar pulse recurs in the brand mark, agent control, contextual readiness state, and work-progress indicators.
