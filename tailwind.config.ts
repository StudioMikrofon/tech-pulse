import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          bg: "#05070D",
          surface: "rgba(255,255,255,0.06)",
          border: "rgba(255,255,255,0.10)",
        },
        text: {
          primary: "#EAF0FF",
          secondary: "#A7B3D1",
        },
        accent: {
          starlight: "#F5E6A8",
          cyan: "#8FD3FF",
          amber: "#FFCF6E",
        },
        category: {
          ai: "#A78BFA",
          gaming: "#F87171",
          space: "#60A5FA",
          technology: "#34D399",
          medicine: "#FB923C",
          society: "#F472B6",
          robotics: "#38BDF8",
        },
      },
      fontFamily: {
        heading: ["var(--font-orbitron)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      typography: {
        DEFAULT: {
          css: {
            color: "#EAF0FF",
            a: { color: "#8FD3FF" },
            h1: { color: "#EAF0FF" },
            h2: { color: "#EAF0FF" },
            h3: { color: "#EAF0FF" },
            strong: { color: "#EAF0FF" },
            code: { color: "#F5E6A8" },
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
