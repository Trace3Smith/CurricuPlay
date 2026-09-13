# Source snapshot provenance

Retrieved September 13, 2026 through the connected Google Drive read tools.

Primary workbook: DCSS Pacing Guide FY27, file ID `1NHE1-x6b21bcd2f5hEEcm4EZEAv66rty6_paTaPi1yo`, last modified September 10, 2026. All 15 tabs were inspected. `pacing-guide-export.txt` contains the full readable workbook export, in metadata tab order. `pacing-guide-cells.json` retains cell coordinates, text, notes/formulas where present, hyperlinks and tab metadata for the populated ranges observed in that export.

Six primary K–5 tabs supply app curriculum timing. COVER and Unit Review were checked; grades 6–12 and hidden GrammarPlanning, Principals Newsletter and K - PA were inspected but not used for K–5 FY27 timing. Hidden older-year content and conflicting date labels are not silently remapped.

`linked-*.json` and `support-*.json` contain district instructional documents directly linked from K–5 subject headers. Their own titles, IDs, URLs and modified times are retained. Only the specifically cited lesson sections are used as question evidence; availability of an entire linked document does not mean all its content was validated or approved for generation. Writing-resource snapshots were retrieved during discovery but are not used as question evidence in this batch. Support 6 and 7 are the same combined science/social studies source linked from two headers.

The importer reads these local snapshots, not live Google files. No writes were made to the source workbook or its linked documents. Source snapshots can contain district assessment references; keep them in the development project. Only curriculum data and the selected instructional evidence accompany the app; source snapshots are not imported into `src/` or `dist/`.
