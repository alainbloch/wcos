# Dynamic collections and data views

## Review and integration

All work originates from `develop`. Review the storage, administration, and page-integration PRs in that order. The later branches contain their prerequisites to permit testing without merging unreviewed changes. Keep all PR targets on `develop`; rebase dependent branches after a prerequisite is merged. Nothing in this feature deploys or migrates production automatically.

## Events acceptance walkthrough

1. Open **Settings → Database Schema → Create collection**. Set identifier `events`, label `Events`.
2. Add `title` (required string), `date` (required date), `description` (richtext), and `image` (media). Select the list columns. Preview, then apply the compatible schema.
3. Open **Collections**, select Events and create records. Choose an existing uploaded image or upload one. For reusable media metadata, create a `media` collection with a media URL field, then add an Events relationship targeting that collection. Select one-to-one, one-to-many, or many-to-many cardinality.
4. Open **Data Views → Create data view**. Set identifier `upcoming-events`, source Events, output fields, date ascending, and page size. Add a `date` condition with `gte` and **Today**. Enable public page access. Preview and save.
5. Edit or create a page. Select **Data view: Upcoming Events** in Data sources. Configure grid/list, numbered pagination/Load More, search and sort controls in the data view component section. The separate live preview uses real records and updates on unsaved changes; preview links and filters are intercepted without publishing.
6. Save the page. Public pagination, detail links, search, parameter filters, and sorting use the same server-rendered component. Load More appends records with JavaScript and falls back to normal navigation without JavaScript.

A page currently supports one configured component, plus multiple named views exposed to its existing template bindings. A named view bound as `view:upcoming-events` is exposed under that identifier in the existing template context. Use identifiers without hyphens if you want dot-style template variable expressions.

## Storage and validation

LowDB retains all existing top-level collections. `dynamic` separates `definitions`, `records`, `views`, and bounded schema `history`. Relationship definitions live with fields; record values store referenced IDs. Page `dataView` holds presentation configuration independently of its query.

`LowCollectionAdapter.read/commit` is the persistence boundary. `CollectionStore` validates isolated candidates and serializes its own writes. The existing request reader/writer gate serializes HTTP mutations and import/export. LowDB remains single-process: run maintenance scripts only while the application is stopped.

Custom record writes compile generated JSON Schemas through Ajv, apply defaults, sanitize rich text, enforce uniqueness and validate references. Built-ins expose protected schemas and retain domain-specific editors/services; known fields also receive JSON Schema type validation. Authentication and credential writes stay owned by the existing auth service.

Relationships are directed. One-to-one permits one target per source and one owner per target. One-to-many stores multiple target IDs, each owned by one source. Many-to-many allows shared targets. Deleting referenced records or target collections is blocked. No implicit cascading delete or inverse-field rewrite occurs.

Queries use allowlisted operators and structured AND/OR trees, not executable expressions. Related filtering/projection supports one relationship hop. Optional typed parameters can have defaults and required flags. `Today` uses the server's UTC calendar date. Queries limit page size to 100 and nesting to five levels. Public access is explicitly enabled per view; users/settings are unavailable, and page views exclude drafts. Search and interactive sorting are limited to selected output fields.

Regex constraints intentionally support only a restricted simple-pattern subset to avoid expensive patterns. Array/object record controls accept JSON data. Rich text has a visual editor and sanitized HTML storage. Schema field ordering is controlled with Move up/down; list columns are chosen per field.

## Existing bindings and starter views

Existing URLs, layouts, member profiles and source names continue through the original resolvers. **Add starter member and update views** explicitly installs editable named views without rewriting existing pages or replacing existing view IDs. Specialized legacy derived shapes remain in their existing resolvers where replacing them would break templates. There is no automatic record seeding.

## Schema migration and rollback

Before a schema edit, create a full ZIP backup in Data Transfer. Preview checks every existing record and all view references. A database revision token prevents applying a preview after data changes. Safe additions/defaults are applied to a candidate copy. Removed populated fields, incompatible types, broken references and uniqueness conflicts block the operation.

The schema editor lists previous definitions and can preview a rollback; applying it uses the same compatibility checks. Rollback never silently discards a populated field. If the old definition is incompatible with newer records, export the data and perform an explicit reviewed migration, or use the full backup restore preview. A failed persistence write restores the prior in-memory database.

Full JSON and ZIP exports include schemas, custom records, views, schema history and page configuration. ZIP also includes uploaded media. Partial exports of legacy collections intentionally exclude global dynamic state; use a full export for dynamic collections. Populate/Override merge dynamic definitions, records and views by identifiers; Restore replaces them. Import validates the complete candidate before application, including relationships and bindings. Existing data-transfer recovery backups remain available.

## Validation

Run `npm test -- --runInBand` for the entire Jest suite with coverage. The Events end-to-end test uses jsdom interactions with the actual Fastify routes and LowDB services; it does not substitute a real browser layout/accessibility audit. Additional tests cover JSON Schema types/constraints, relationship cardinalities, structured queries, role/CSRF checks, backup round trips, page bindings and preview/public parity.
