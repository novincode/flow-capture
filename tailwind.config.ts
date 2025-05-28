import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./**/*.{js,ts,jsx,tsx,html}",
    "./*.{js,ts,jsx,tsx,html}",
    "!./node_modules"

  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config