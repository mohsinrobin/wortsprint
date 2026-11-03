/** @type {import('tailwindcss').Config} */
// Schulheft palette: exercise-book paper, royal-blue fountain ink, the
// teacher's red and green pens, and a highlighter. Every colour is a CSS
// variable (RGB channels) so light and dark themes share one set of names.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: v('paper'),
        sheet: v('sheet'),
        grid: v('grid'),
        line: v('line'),
        ink: v('ink'),
        pencil: v('pencil'),
        blue: { DEFAULT: v('blue'), soft: v('blue-soft') },
        onblue: v('onblue'),
        pen: { DEFAULT: v('pen'), soft: v('pen-soft') },
        ok: { DEFAULT: v('ok'), soft: v('ok-soft') },
        gold: { DEFAULT: v('gold'), soft: v('gold-soft') },
        marker: v('marker'),
        der: v('der'),
        die: v('die'),
        das: v('das'),
        board: v('board'),
        boardink: v('boardink'),
        signal: v('signal'),
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        hand: ['var(--font-hand)'],
      },
      borderRadius: {
        sheet: 'var(--radius)',
      },
      boxShadow: {
        sheet: 'var(--shadow-sheet)',
        lift: 'var(--shadow-lift)',
        press: 'var(--shadow-press)',
      },
      keyframes: {
        pop: { '0%': { transform: 'translateY(6px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-5px)' },
          '40%,80%': { transform: 'translateX(5px)' },
        },
      },
      animation: {
        pop: 'pop 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        shake: 'shake 320ms ease-in-out',
      },
    },
  },
  plugins: [],
};
