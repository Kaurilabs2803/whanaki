/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pounamu: {
          50:  "#e1f5ee",
          100: "#9fe1cb",
          200: "#5dcaa5",
          400: "#1d9e75",
          500: "#0f6e56",
          600: "#0a5441",
          700: "#06372a",
          900: "#02160f",
        },
      },
    },
  },
  plugins: [],
};
