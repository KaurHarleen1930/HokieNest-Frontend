// HokieNest Design System Tokens
export const tokens = {
  // Spacing scale (4px base)
  spacing: {
    xs: '4px',    // 1
    sm: '8px',    // 2  
    md: '12px',   // 3
    lg: '16px',   // 4
    xl: '24px',   // 6
    '2xl': '32px', // 8
    '3xl': '48px', // 12
    '4xl': '64px', // 16
  },

  // Typography scale
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
  },

  // Line heights
  lineHeight: {
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
  },

  // Font weights
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Border radius
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    full: '9999px',
  },

  // Z-index scale
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },

  // Breakpoints
  breakpoints: {
    sm: '375px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1400px',
  },

  // Max content widths
  maxWidth: {
    prose: '70ch',
    container: '1280px',
  },
} as const;

export type SpacingToken = keyof typeof tokens.spacing;
export type FontSizeToken = keyof typeof tokens.fontSize;
export type BorderRadiusToken = keyof typeof tokens.borderRadius;