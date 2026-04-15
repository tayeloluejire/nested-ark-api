/** @type {import('postcss-load-config').Config} */
module.exports = {
  plugins: {
    // autoprefixer adds vendor prefixes automatically (needed by Next.js CSS pipeline)
    // tailwindcss processes @tailwind directives
    tailwindcss: {},
    autoprefixer: {},
  },
};
