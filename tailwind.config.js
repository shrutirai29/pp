/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Fintech & Security SaaS Palette
        brand: {
          ink: '#15152B',        // Deep Ink Navy
          plum: '#24203D',       // Dark Plum
          lavender: '#E9E8F8',   // Lavender
          softPurple: '#8F86D8', // Soft Purple
          purple: '#6955C9',     // Primary Purple
          warmPeach: '#F5B69E',  // Warm Peach
          softPeach: '#F8D0BE',  // Soft Peach
          muted: '#68657A',      // Muted Text
          success: '#4FAF91',    // Success Green
          coral: '#D97D68',      // Warning Coral
        },
        navy: {
          950: '#15152B',
          900: '#1B1A32',
          850: '#201D3B',
          800: '#24203D',
          700: '#322C54',
          600: '#463D74',
        },
        slate: {
          850: '#1A1833',
        },
        electric: {
          400: '#8F86D8',
          500: '#6955C9',
          600: '#5442A8',
        },
        violet: {
          400: '#A79DE8',
          500: '#6955C9',
          600: '#5442A8',
        },
        accent: {
          cyan: '#6955C9',
          emerald: '#4FAF91',
          amber: '#F5B69E',
          rose: '#D97D68',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'monospace',
        ],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
        'premium': '0 4px 20px -2px rgba(21, 21, 43, 0.5), 0 2px 6px -1px rgba(0, 0, 0, 0.3)',
        'purple-glow': '0 0 20px -3px rgba(105, 85, 201, 0.35)',
        'peach-glow': '0 0 20px -3px rgba(245, 182, 158, 0.35)',
      },
    },
  },
  plugins: [],
};
