/**
 * Fintranzact Brand Colors
 * Based on official brand guidelines
 */

export const fintranzactColors = {
  // Primary Brand Blues
  primary: {
    50: '#f0f4fc',
    100: '#e1e9f9',
    200: '#c3d3f3',
    300: '#a5bded',
    400: '#87a7e7',
    500: '#3e60ab', // Primary brand blue
    600: '#36509a',
    700: '#2d4089',
    800: '#243a75', // Secondary darker blue
    900: '#1b2d61',
  },
  
  // Gradient Blues (from logo)
  gradient: {
    dark: '#2140D7',      // Dark blue (gradient start)
    medium: '#3665E6',   // Medium blue (gradient mid)
    light: '#4A85EE',     // Light blue (gradient end)
    tagline: '#3D78E0',  // Tagline blue
  },
  
  // Neutral Colors
  neutral: {
    white: '#FFFFFF',
    black: '#000000',
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
  },
  
  // Semantic Colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
  },
  
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
};

// CSS Variables for use in styles
export const cssVariables = `
  :root {
    /* Primary Colors */
    --fintranzact-primary: ${fintranzactColors.primary[500]};
    --fintranzact-primary-dark: ${fintranzactColors.primary[800]};
    --fintranzact-secondary: ${fintranzactColors.primary[800]};
    
    /* Gradient Colors */
    --fintranzact-gradient-dark: ${fintranzactColors.gradient.dark};
    --fintranzact-gradient-medium: ${fintranzactColors.gradient.medium};
    --fintranzact-gradient-light: ${fintranzactColors.gradient.light};
    --fintranzact-tagline: ${fintranzactColors.gradient.tagline};
    
    /* Neutral Colors */
    --fintranzact-white: ${fintranzactColors.neutral.white};
    --fintranzact-black: ${fintranzactColors.neutral.black};
    
    /* Semantic Colors */
    --fintranzact-success: ${fintranzactColors.success[500]};
    --fintranzact-error: ${fintranzactColors.error[500]};
    --fintranzact-warning: ${fintranzactColors.warning[500]};
    --fintranzact-info: ${fintranzactColors.info[500]};
  }
`;

export default fintranzactColors;
