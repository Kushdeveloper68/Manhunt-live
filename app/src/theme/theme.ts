/**
 * MANHUNT LIVE - Design System & Tokens
 * Extracted directly from Google Stitch Design System (Project 5504065792171940726)
 * Aesthetic: Aggressive street-punk minimalism + elite tactical product engineering.
 */

export const colors = {
  // Surface Hierarchy
  canvas: '#0A0A0A', // Base view and full-bleed map backdrop
  surface: '#141414', // Flat containers, panels, sheets, system drawers
  surfaceElevated: '#1C1C1C', // Modals, interactive rows, transient HUD overlays
  borderSubtle: '#262626', // Universal 1px structural boundaries

  // Core & Role Semantics
  accentPrimary: '#C6FF00', // Acid Lime - Primary user actions, positive triggers, tracking lock
  roleChaser: '#FF3B5C', // Hot Crimson - Chaser pings, chaser UI borders, team data
  roleRunner: '#22D3EE', // Electric Cyan - Runner trails, runner perimeters, team stats

  // Feedback Signals
  signalDanger: '#FF3B30', // SOS, capture alerts, immediate spatial breach
  signalWarning: '#FFB020', // Low boundary countdowns, ping zone shrinkage
  signalSuccess: '#3DDC84', // Checkpoint extraction, geofence verification

  // Text Contrast
  textPrimary: '#FFFFFF', // Headings, dynamic GPS telemetry, imperative commands
  textSecondary: '#A0A0A0', // Metadata, inactive controls, auxiliary context labels
  textInverse: '#0A0A0A', // High-contrast legibility against #C6FF00 and semantic badges
} as const;

export const spacing = {
  xs: 4, // 0.25rem - tight inline telemetry
  sm: 8, // 0.5rem - spatial rhythm baseline
  md: 16, // 1.0rem - gutter / card inner padding
  lg: 24, // 1.5rem - canvas margin
  xl: 32, // 2.0rem - sections
  xxl: 48,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  button: 12, // Locked at 12px for primary buttons & inputs
  input: 12,
  card: 16, // Locked at 16px for cards & HUD panels
  pill: 9999, // Badges, chips, status pills
} as const;

export const typography = {
  // Display - Anton
  displayHero: {
    fontFamily: 'Anton_400Regular',
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  headlineLg: {
    fontFamily: 'Anton_400Regular',
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: 0.96,
    textTransform: 'uppercase' as const,
  },
  headlineMd: {
    fontFamily: 'Anton_400Regular',
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: 0.72,
    textTransform: 'uppercase' as const,
  },
  headlineSm: {
    fontFamily: 'Anton_400Regular',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },

  // Body - Inter
  bodyLg: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMd: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  bodySm: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },

  // Telemetry - JetBrains Mono
  labelMonoLg: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.36,
  },
  labelMonoMd: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.14,
  },
  labelMonoSm: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.44,
    textTransform: 'uppercase' as const,
  },
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  typography,
} as const;

export type Theme = typeof theme;
