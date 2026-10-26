# Plus Jakarta Sans (teacher-mode headline font)

`plus-jakarta-sans-latin-700-normal.woff2` (Bold) and `plus-jakarta-sans-latin-800-normal.woff2` (ExtraBold) are **Plus Jakarta Sans**, Latin subset. DESIGN.md uses them for teacher-mode headlines, titles and buttons. They are declared once in `src/design-tokens.css` (`--ds-font-headline`) and used by the restyled app shell.

- **Licence:** SIL Open Font License 1.1. The full text is in `OFL.txt`, with the copyright line "Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans)".
- **Source:** the npm package `@fontsource/plus-jakarta-sans` 5.2.8 (`files/plus-jakarta-sans-latin-700-normal.woff2` and `files/plus-jakarta-sans-latin-800-normal.woff2`). `OFL.txt` is from https://github.com/google/fonts/blob/main/ofl/plusjakartasans/OFL.txt. Its licence text matches the package's LICENSE except for one trailing space.
- **SHA-256:**
  - 700: `2050755bf475817c96ac7d914c7f07cc3c2d11ff4b3fb4747b8d41de584aad17`
  - 800: `5f301a8ef9c266c8b596e6793d3cc826daeff9849c5af035f5386439137955ad`
- **Bundling:** the files are bundled by Vite. The app never fetches fonts at runtime. The fonts are unmodified and not renamed, which the OFL allows when they ship with software.
