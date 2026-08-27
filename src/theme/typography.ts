import { Platform } from 'react-native';

const isIOS = Platform.OS === 'ios';

export const typography = {
  // Display — used on timer screens
  displayHero: {
    fontFamily: isIOS ? 'System' : 'sans-serif-light',
    fontSize: 72,
    fontWeight: '300',
    letterSpacing: 0,
    lineHeight: 84,
  },
  displayLarge: {
    fontFamily: isIOS ? 'System' : 'sans-serif-light',
    fontSize: 56,
    fontWeight: '300',
    letterSpacing: 0,
    lineHeight: 64,
  },
  
  // Headings
  h1: {
    fontFamily: isIOS ? 'System' : 'sans-serif-medium',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 34,
  },
  h2: {
    fontFamily: isIOS ? 'System' : 'sans-serif-medium',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 28,
  },
  h3: {
    fontFamily: isIOS ? 'System' : 'sans-serif',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  
  // Body
  body: {
    fontFamily: isIOS ? 'System' : 'sans-serif',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodyLarge: {
    fontFamily: isIOS ? 'System' : 'sans-serif',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: isIOS ? 'System' : 'sans-serif',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  caption: {
    fontFamily: isIOS ? 'System' : 'sans-serif',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  
  // UI
  button: {
    fontFamily: isIOS ? 'System' : 'sans-serif-medium',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
    lineHeight: 22,
  },
  label: {
    fontFamily: isIOS ? 'System' : 'sans-serif-medium',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  
  // Mono — for timer numbers if needed
  mono: {
    fontFamily: isIOS ? 'Menlo' : 'monospace',
    fontSize: 16,
    fontWeight: '400',
  },
} as const;
