/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 24px 80px rgba(34, 211, 238, 0.16)",
      },
      backgroundImage: {
        "gallery-shell":
          "radial-gradient(circle at top left, rgba(19, 37, 59, 0.95), rgba(9, 16, 25, 0.98) 42%, rgba(3, 6, 12, 1) 100%)",
      },
    },
  },
  plugins: [],
};
