/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fffdf0",
          100: "#fff9d6",
          200: "#fff0a8",
          300: "#ffe470",
          400: "#fdd53f",
          500: "#f5c518", // primary gold-yellow
          600: "#d9a406",
          700: "#a97b07",
          800: "#875f0e",
          900: "#724f12",
          950: "#432c02",
        },
        // warm near-black used for dark surfaces / cards
        ink: {
          800: "#1a160b",
          900: "#141109",
          950: "#0b0905",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        display: ['"Baloo 2"', '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        card: "0 10px 40px -12px rgba(180, 140, 10, 0.18)",
        glow: "0 8px 30px -6px rgba(245, 197, 24, 0.55)",
        soft: "0 8px 30px -8px rgba(30, 25, 10, 0.10)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease both",
        pulseRing: "pulseRing 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};
