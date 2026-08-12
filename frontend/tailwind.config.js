/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
  ],
  theme: {
    fontFamily: {
      'agency': ['Agency', 'Arial Black', 'Arial', 'sans-serif'],
      'primary': ['Agency', 'Arial Black', 'Arial', 'sans-serif'],
      'secondary': ['Agency', 'Arial Black', 'Arial', 'sans-serif'],
      'sans': ['Agency', 'Arial Black', 'Arial', 'sans-serif'],
      'mono': ['Agency', 'Arial Black', 'Arial', 'sans-serif'],
      'serif': ['Agency', 'Arial Black', 'Arial', 'sans-serif'],
    },
    extend: {
      colors: {
        // Fintranzact Brand Colors
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
        // Gradient colors from logo
        gradient: {
          dark: '#2140D7',
          medium: '#3665E6',
          light: '#4A85EE',
          tagline: '#3D78E0',
        },
        // Neutral colors
        neutral: {
          white: '#FFFFFF',
          black: '#000000',
        },
      },
      backgroundImage: {
        'fintranzact-gradient': 'linear-gradient(135deg, #2140D7 0%, #3665E6 50%, #4A85EE 100%)',
        'fintranzact-gradient-horizontal': 'linear-gradient(90deg, #2140D7 0%, #3665E6 50%, #4A85EE 100%)',
      },
    },
  },
  plugins: [],
};

