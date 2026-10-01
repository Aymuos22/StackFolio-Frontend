/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, 0.08)",
        comic: "6px 6px 0 #0a0a0a",
        "comic-pink": "5px 5px 0 #ff2a6d",
        "comic-cyan": "5px 5px 0 #05d9e8",
        "comic-pop": "4px 4px 0 #0a0a0a, 8px 8px 0 #ff2a6d",
      },
      colors: {
        ink: "#172033",
        line: "#e6ebf2",
        comic: {
          ink: "#0a0a0a",
          paper: "#f4e7c4",
          cream: "#fff6df",
          pink: "#ff2a6d",
          cyan: "#05d9e8",
          yellow: "#ffe66d",
          purple: "#7b2cbf",
          blue: "#1b3b6f",
        },
        hacker: {
          bg: "#050805",
          fg: "#d7ffe8",
          green: "#33ff99",
          muted: "#7f9f8c",
          border: "#1d3a28",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Syne", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Instrument Serif", "ui-serif", "Georgia", "serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        hacker: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        comic: ["Bangers", "Impact", "ui-sans-serif", "system-ui", "sans-serif"],
        "comic-body": ["Comic Neue", "Comic Sans MS", "cursive"],
        "comic-black": ["Archivo Black", "Impact", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "comic-halftone":
          "radial-gradient(circle, #0a0a0a 1.1px, transparent 1.2px)",
      },
    },
  },
  plugins: [],
};
