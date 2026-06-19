import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0D1117',
    background: '#F6F8FA',
    backgroundElement: '#EAEEF2',
    backgroundSelected: '#D0D7DE',
    textSecondary: '#57606A',
    accent: '#1A7F37',
    accentGlow: '#2EA043',
    danger: '#CF222E',
    warning: '#9A6700',
  },
  dark: {
    text: '#E6EDF3',
    background: '#0D1117',
    backgroundElement: '#161B22',
    backgroundSelected: '#21262D',
    textSecondary: '#7D8590',
    accent: '#48f05f',
    accentGlow: '#56D364',
    danger: '#F85149',
    warning: '#D29922',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'ui-rounded',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
    display: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
    display: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
    display: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;