Newspaper Sans is a static 650-weight derivative of Noto Sans SC, renamed for this project. It is used only to render deterministic share images at build time, not served as a web font. A static instance avoids the renderer selecting the variable font’s thin default and reduces font parsing work.

Upstream: https://github.com/google/fonts/tree/main/ofl/notosanssc
Downloaded: 2026-10-20
Upstream NotoSansSC[wght].ttf SHA-256: a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da
Bundled NewspaperSans.ttf SHA-256: 0a401831a985f41c48e95cb87991b7ee911766e9037de51ef0b6985a847dd5f9

Prepared once with fontTools 4.67.0: instantiateVariableFont(font, {"wght": 650}); rename name IDs 1/4/6/16/17 to Newspaper Sans / NewspaperSans / Regular; save the static TTF. End users do not need Python or fontTools to build.

Copyright 2014–2021 Adobe. Licensed under SIL Open Font License 1.1; see OFL.txt. This derivative retains that license, separate from the project’s code license.
