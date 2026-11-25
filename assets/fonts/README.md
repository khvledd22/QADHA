# QADHA local fonts

The files in this directory are self-hosted WOFF2 builds served by Google Fonts and licensed under the SIL Open Font License 1.1.

| Family | Local files | Weight range | Source |
| --- | --- | --- | --- |
| Alexandria | `alexandria-arabic.woff2`, `alexandria-latin.woff2` | 400–700 | Google Fonts, Alexandria v6 |
| Noto Sans Arabic | `noto-sans-arabic-arabic.woff2`, `noto-sans-arabic-latin.woff2` | 400–700 | Google Fonts, Noto Sans Arabic v33 |
| Manrope | `manrope-latin.woff2`, `manrope-latin-ext.woff2` | 400–800 | Google Fonts, Manrope v23 |

License copies are included as `OFL-Alexandria.txt`, `OFL-Noto-Sans-Arabic.txt`, and `OFL-Manrope.txt`.

The application does not request font files from a CDN at runtime. `css/fonts.css` loads these local assets before the design tokens and application styles.
