# Original-site conversion

The public presentation was migrated from https://vead.sg-host.com/ on October 23, 2026. All 24 published pages linked from its navigation and news list are included, along with the Gad profile popup. The source's wording, historical records, dates, and existing placeholder copy are retained deliberately. Historical outbound links remain outbound; the external SmugMug gallery remains external.

## Run

Use Node 24 LTS (minimum 22.12), then:

```sh
npm ci
npm start
```

The app listens on port 3000. `PORT=8788 npm start` selects another port. `npm run dev -- --port 4173 --host 0.0.0.0` is also supported. No WordPress, PHP, MySQL, build step, or access to the original host is needed to render the migrated pages.

Startup never imports or migrates page content. Populate new databases explicitly using Data Transfer or the command below. Existing databases retain edits. To replace the earlier sample content with the captured originals:

```sh
npm run migrate:site -- --replace
```

This command writes a timestamped database backup **before** replacing the 24 matching pages. It retains unrelated pages and other collections. Without `--replace`, migration only installs missing content once. Do not run replacement against a database with new edits you want to keep. Restore by stopping the application and copying the backup over `DB_PATH`. Keep the JSON database on persistent storage, and use one application writer (lowdb is not a multi-instance database).

## Editing

Imported page bodies live in `src/content/original-pages.json` and are seeded into the existing Pages CMS. Edit them under `/admin/pages`; imported pages use an HTML textarea so a browser rich-text editor cannot silently remove layout markup. CMS changes are sanitized on rendering, publication can be disabled, and restarting does not overwrite edits. The header and footer are shared templates in `src/views/partials/reference-*.njk`; these retain the original navigation layout rather than the first conversion's extra top bar and hero.

Public category controllers are retained and extend `PublicPageController`, which loads published CMS content, the restored shell, and page-specific CSS through one rendering path. Obsolete sample page templates, the base layout, and main.css/main.js have been removed. Structured sample collections do not rewrite imported pages; edit the corresponding Pages entry. Member profiles are the exception: once member management is used, active member records replace only the roster rows while surrounding CMS content and styling remain intact.

`public/css/original/` contains deduplicated original styles. `public/css/reference.css` is the maintained compatibility/responsive layer. Fonts and all referenced image assets are served locally (including the existing images). There are no original-host scripts, AJAX calls, or runtime WordPress dependencies. Native details, dialogs, scrollable image galleries, keyboard menus, and local full-text search replace the original plugins. Gallery images open in a lightbox; videos retain their external YouTube destinations.

The captured CSS/markup conversion can be rerun with `node scripts/import-site-reference.mjs <capture-directory>`. Each input JSON contains `url`, `title`, the full rendered `html`, and a `styles` array of `{href, css}` from the same page. Review captures first; truncated captures are rejected. Download referenced media to `public/images` before importing. `src/content/asset-report.json` records unresolved source assets; the completed migration has none. The generated output is committed, so captures are not required for normal development or deployment.

## Delivery and configuration

Existing session/JWT/admin settings still apply. Configure the contact form with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optional `SMTP_USER`/`SMTP_PASSWORD`, and `CONTACT_FROM`. `CONTACT_TO` defaults to `westerncouncil@gmail.com`. SMTP credentials remain server-side. Without configuration, the form clearly reports that email was not sent and offers the direct email address. Tests mock SMTP; no live message was sent during development.

The original public PayPal hosted button `CK23BQFMGKR3Y`, choices, and USD currency are preserved. No payment was submitted. Video, SmugMug, PayPal, and historical resource links still require their respective external services.

`/contact-us` redirects to `/contact`; `/previous-updates` redirects to `/updates`; trailing-slash URLs work. `/?s=...` redirects to the local search. Unknown public pages receive a styled 404; API 404 responses remain JSON.

## Verification

Run `npm test` (coverage included). Tests use temporary isolated databases, never the normal CMS database. Coverage includes all imported pages, local asset existence, aliases, trailing slashes, CMS persistence/publication, search escaping, HTML sanitization, PayPal configuration, and mocked contact validation/delivery/failure/throttling.

Manual browser checks cover desktop homepage comparison, 390px mobile layout and dropdown navigation, original member table and profile dialog, rank disclosures, armor lightbox, and search. Original source placeholders and outbound historical resources were not editorially rewritten. SMTP delivery, external video playback, and payment completion were not exercised.

## Admin editing

The admin area has its own responsive styles and a searchable Pages list. Open a page to edit its body visually, or switch to HTML source for layout and media changes. The original content is loaded into a single submitted field; untouched source markup is preserved. The visual editor is sandboxed, uses the page's local styles, and disables public scripts and form submission. If preview loading fails, the HTML editor remains available.

Saving displays a one-time confirmation. Validation failures retain entered content, duplicate/reserved addresses are rejected, and the homepage keeps its empty address. Unsaved edits trigger a navigation warning. Member records are editable under Members; the Pages entry controls surrounding member-page content. Settings links to the homepage and contact editors rather than offering legacy controls that do not affect the migrated pages.

Admin regression coverage includes server-side create/edit/load, publication state, validation, feedback, preview sanitization, and DOM-based visual/HTML editor synchronization. Full browser visual QA for this update could not run in the implementation environment: the cloud browser cannot reach its local server and the Chromium download failed.

## Member profile modals

Every roster row opens a profile modal by click, Enter, or Space. The modal uses the original portrait/statistics/biography arrangement, stacks on mobile, and closes through its close button, Escape, or backdrop. Focus returns to the triggering row. Member admin forms now save public email, battle statistics, weapon type, and statistics date alongside the biography and image. Markdown biographies are sanitized before rendering.

Gad's captured historical biography and statistics are retained as defaults; saved member details override them. Other members display the information available in their records and an explicit empty biography message when none is provided. No missing biographies or battle statistics are invented.
