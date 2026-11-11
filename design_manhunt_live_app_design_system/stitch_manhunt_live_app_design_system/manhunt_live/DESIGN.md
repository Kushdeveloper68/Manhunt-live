---
name: MANHUNT LIVE
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c3caac'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8d9479'
  outline-variant: '#434933'
  surface-tint: '#a6d700'
  primary: '#ffffff'
  on-primary: '#273500'
  primary-container: '#bef500'
  on-primary-container: '#536d00'
  inverse-primary: '#4e6700'
  secondary: '#ffb3b6'
  on-secondary: '#68001a'
  secondary-container: '#c7003a'
  on-secondary-container: '#ffd7d7'
  tertiary: '#ffffff'
  on-tertiary: '#00363e'
  tertiary-container: '#a2eeff'
  on-tertiary-container: '#006f7e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#bef500'
  primary-fixed-dim: '#a6d700'
  on-primary-fixed: '#151f00'
  on-primary-fixed-variant: '#3a4d00'
  secondary-fixed: '#ffdada'
  secondary-fixed-dim: '#ffb3b6'
  on-secondary-fixed: '#40000c'
  on-secondary-fixed-variant: '#920028'
  tertiary-fixed: '#a2eeff'
  tertiary-fixed-dim: '#2fd9f4'
  on-tertiary-fixed: '#001f25'
  on-tertiary-fixed-variant: '#004e5a'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-hero:
    fontFamily: Anton
    fontSize: 44px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: 0.02em
  display-hero-mobile:
    fontFamily: Anton
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Anton
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 36px
    letterSpacing: 0.03em
  headline-md:
    fontFamily: Anton
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0.03em
  headline-sm:
    fontFamily: Anton
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.04em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 22px
    letterSpacing: -0.02em
  label-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers a real-world GPS pursuit platform where survival relies on microsecond legibility. The aesthetic merges aggressive street-punk minimalism with the functional rigor of elite mobile product engineering. The posture is deadpan, utilitarian, and uncompromising. Attitude is derived purely through stark typographical tension, extreme tonal contrast, and calculated spatial vacuums—never through superficial styling.

### Design Principles
- **Ruthless Restraint:** Zero skeuomorphism, zero faux-distress, zero raster textures, zero gradients, zero sticker graphics. Every pixel serves situational awareness.
- **Glanceable Under Adrenaline:** Engineered for players sprinting through dark urban spaces with elevated heart rates. Targets are large, states are unambiguous, and semantic signifiers pierce the darkness instantly.
- **Structural Tension:** Pitch black voids framed by exact 1px structural strokes, punctuated by tactical bursts of hyper-saturated acid lime and role-specific signals.
- **Thumb-Zone Absolute:** High-urgency triggers and map overlays anchor into the ergonomic primary lower-third reach zone of standard handheld form factors.

## Colors

The system relies on an OLED-optimized pitch black canvas that eliminates glare during night play while maximizing battery efficiency. Semantic roles use absolute color isolation: role hues are strictly functional, never decorative.

### Surface Hierarchy
- `canvas`: `#0A0A0A` — Base view and full-bleed map backdrop.
- `surface`: `#141414` — Flat containers, panels, sheets, and system drawers.
- `surface-elevated`: `#1C1C1C` — Modals, interactive rows, transient HUD overlays.
- `border-subtle`: `#262626` — Universal 1px structural boundaries.

### Core & Role Semantics
- `accent-primary`: `#C6FF00` (Acid Lime) — Primary user actions, positive triggers, tracking lock, and active mode highlights. Typography sitting on this surface is hard-locked to `#0A0A0A`.
- `role-chaser`: `#FF3B5C` (Hot Crimson) — Dedicated semantic role color. Applied strictly to chaser pings, chaser UI borders, and chaser team data.
- `role-runner`: `#22D3EE` (Electric Cyan) — Dedicated semantic role color. Applied strictly to runner trail indicators, runner perimeter data, and runner team stats.

### Feedback Signals
- `signal-danger`: `#FF3B30` — SOS, capture alerts, immediate spatial proximity breach.
- `signal-warning`: `#FFB020` — Low boundary countdowns, ping zone shrinkage, radar disruptions.
- `signal-success`: `#3DDC84` — Checkpoint extraction, safe house entry, geofence verification.

### Text Contrast
- `text-primary`: `#FFFFFF` — Primary headings, dynamic GPS telemetry, imperative commands.
- `text-secondary`: `#A0A0A0` — Metadata, inactive controls, auxiliary context labels.
- `text-inverse`: `#0A0A0A` — For high-contrast legibility against `#C6FF00` and semantic badges.

## Typography

The typographic hierarchy balances display aggression with mechanical precision:
- **Anton (Display):** Forces absolute uppercase rendering across titles, mission briefings, alerts, and navigation modes. Anton commands instant psychological dominance on the screen without using extraneous weight or shadow tricks.
- **Inter (Interface & Narrative):** Provides neutral, utilitarian UI body copy, instructions, settings, and player rosters. Inter stays unobtrusive, prioritizing legibility under rapid motion.
- **JetBrains Mono (Telemetry & Logic):** Reserved strictly for dynamic real-world telemetry—countdown clocks, delta distances (`42m`), room codes, latitude/longitude coords, and live ping intervals. Tabular numbers prevent UI jitter as metrics fluctuate in real-time.

## Layout & Spacing

The viewport architecture standardizes on a mobile canvas of 390x844 with rigid margins and strict spatial anchors:
- **Spatial Rhythm:** Fixed 8pt baseline scale (`0.5rem` / `1rem` / `1.5rem` / `2rem`). Micro-spacers collapse to 4pt (`0.25rem`) only for tight inline telemetry tags.
- **Canvas Margins:** Fixed 24px (`1.5rem`) horizontal margins insulate tactical content from hardware bezels and accidental thumb engagement during motion.
- **Ergonomic Safe Zones:** Primary interactive targets (Action bars, scan pings, ability triggers) sit within the 180px–360px lower thumb quadrant. Telemetry summaries (compass, radar limits, match clock) dock along the top edge directly below the system status bar.
- **Map Scaffolding:** Base map overlays utilize full-bleed framing, layering flat cards onto the viewport through dedicated bottom sheets with structured 16px vertical gaps.

## Elevation & Depth

This system rejects blur filters, drop shadows, and visual skeuomorphism. Depth is strictly physical, structural, and flat:
- **Level 0 (Canvas Base):** `#0A0A0A`. The ground layer, housing active cartographic surfaces and root dashboards.
- **Level 1 (Card & Section Surfaces):** `#141414` bounded by a razor-sharp `1px solid #262626`. Defines panels, rosters, and operational HUD zones.
- **Level 2 (Active/Floating Overlays):** `#1C1C1C` enclosed with `1px solid #262626`. Bottom drawers, pinned tactical cards, and floating status toasts.
- **Active Focus Rings & High-Tier States:** When an element requires critical elevation (e.g., active target card), depth is expressed by replacing the subtle `#262626` outline with a full-contrast `1px solid #C6FF00` or the respective role color (`#FF3B5C` / `#22D3EE`). No glowing halos, drop shadows, or background blurs are permitted.

## Shapes

The geometric framework balances functional street ergonomics with structural discipline:
- **Cards & HUD Panels:** Locked at `16px` border-radius to preserve structural density while keeping corners gentle against continuous handheld contact.
- **Primary Buttons & Field Inputs:** Locked at `12px` border-radius, pairing a precise, machine-milled look with tactile tap feedback.
- **Telemetry Chips, Badges & Toggles:** Fully rounded at `999px` (Pill format) to provide immediate contrast against rectangular cards.
- **Map Marker Pinheads & Radar Blips:** Pure geometric circles and squares with zero edge feathering.

## Components

### Buttons
- **Primary Action (CTA):** Height 52px, radius 12px. Fill `#C6FF00`, text `#0A0A0A` (Inter SemiBold 16px, uppercase). Zero borders, zero shadows. Full-width within 24px canvas margins in thumb zones. Pressed state scales down to `98%` with zero hue change.
- **Secondary Action:** Height 52px, radius 12px. Fill `#141414`, border `1px solid #262626`, text `#FFFFFF`.
- **Role Urgent Action (Chaser Ping / Runner Drop):** Height 52px, radius 12px. Fill `#FF3B5C` (Chaser) or `#22D3EE` (Runner), label `#0A0A0A`.
- **Destructive / SOS:** Height 52px, radius 12px. Fill `#FF3B30`, label `#FFFFFF`.

### Chips & Tactical Badges
- Height 28px, border-radius 999px, padding `0 12px`.
- Monospace labels (JetBrains Mono 11px uppercase).
- Neutral variant: Fill `#1C1C1C`, border `1px solid #262626`, text `#A0A0A0`.
- Active variant: Fill `#0A0A0A`, border `1px solid #C6FF00`, text `#C6FF00`.

### Cards & HUD Panels
- Background `#141414`, border `1px solid #262626`, radius 16px, inner padding 16px.
- No card gradients. Cards remain flat surfaces hosting Anton headings, Inter metadata, and JetBrains Mono metric readouts.
- Proximity Threat Card: Overrides standard border to `1px solid #FF3B30` with immediate distance metric rendered in Anton 32px.

### Inputs & Access Code Fields
- Height 52px, radius 12px, background `#141414`, border `1px solid #262626`, text `#FFFFFF` (JetBrains Mono 16px).
- Focused state: Border changes to `1px solid #C6FF00`. No glow or outer ring.
- Placeholder text: `#A0A0A0`.

### Lists & Roster Items
- Minimum tap height 56px.
- Separated by `1px solid #262626` dividers or 8px vertical item gaps.
- Player rows contain role avatar ring (2px solid role color), Inter 14px Medium display name, and JetBrains Mono latency/distance tracker right-aligned.

### Radar HUD Elements (Specialized)
- Compass bar: Fixed 32px height at viewport top. JetBrains Mono 12px cardinal points (`N`, `124°`, `E`) in `#A0A0A0`, dynamic heading indicator locked to `#C6FF00`.
- Ping cooldown timer: 48px round HUD tracker with a `2px solid #262626` base and high-contrast `#C6FF00` radial sweep.