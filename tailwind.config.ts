import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14161A",
        slate: "#5B6270",
        mist: "#F6F7FB",
        brand: {
          DEFAULT: "#2F6FED",
          dark: "#1F52C4",
          light: "#5B8DFF",
        },
        mint: "#2FD9A8",
        lavender: "#B9A6FF",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.75rem",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(20, 22, 26, 0.06)",
        card: "0 4px 20px rgba(20, 22, 26, 0.05)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
