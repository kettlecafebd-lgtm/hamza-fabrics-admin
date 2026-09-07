/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 🔴 ডাইনামিক থিম কালার ভেরিয়েবল
        base: "var(--bg-base)",
        surface: "var(--bg-surface)",
        primary: "var(--color-primary)",
        accent: "var(--color-accent)",
        "text-main": "var(--text-main)",
        "text-muted": "var(--text-muted)",
        border: "var(--border-color)",
      },
    },
  },
  plugins: [],
}