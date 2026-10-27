# Dynamic collections and data views

## Review and integration

The unified CRUD correction branches from `develop`, where the original storage, administration and page-integration PRs are already integrated. Review the correction PR against `develop`; do not deploy or merge to `main` as part of this migration. Nothing in this feature migrates production automatically.

## Editing existing collections

Members, Pages, Classes, Glossary, Updates and Moves use the same schema editor and generated CRUD as custom collections. In **Settings → Database Schema**, choose **Edit schema**, edit labels, constraints, types, field order or list columns, and add fields. Preview against existing records, then apply. Only account/site settings administration and system record IDs/timestamps remain locked. Existing collections cannot be deleted because public routes depend on them, and populated fields cannot be removed without an explicit data migration.

The effective schema starts from compatibility field definitions plus fields discovered in existing records. On the first schema edit, its complete definition is saved in `dynamic.definitions`. Existing records stay in their original top-level LowDB arrays. No startup migration or reseed occurs. Later writes, including calls from old services, use that saved schema through `CollectionRepository` and `CollectionStore`.

Old content administration URLs are aliases to `CollectionsController`. An Edit action opens the generated record form, not a collection index. `GlossaryController`, `UpdatesController`, collection-specific member/class/move CRUD methods, their templates, and the six content repository classes have been removed. Compatibility repository exports are instances of the one generic class. Shared domain rules in `collections/rules.js` preserve glossary uniqueness, member honors/colors, eligible instructors, move media, update dates, and page addresses.

The page layout authoring interface remains available from a page record's **Open page layout editor** link at `/admin/page-design/:id`; it saves through the same generic controller/repository. Authentication and site settings keep their dedicated administration.

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

All content record writes compile generated JSON Schemas through Ajv, apply defaults, sanitize rich text, enforce uniqueness and validate references. Existing content schemas are editable; shared pure domain rules run before the same validated atomic write. Authentication and credential writes stay owned by the existing auth service.

Relationships are directed. One-to-one permits one target per source and one owner per target. Many-to-one permits a shared single target, such as a move creator. One-to-many stores multiple target IDs, each owned by one source. Many-to-many allows shared targets. Deleting referenced records or target collections is blocked. No implicit cascading delete or inverse-field rewrite occurs.

Queries use allowlisted operators and structured AND/OR trees, not executable expressions. Related filtering/projection supports one relationship hop. Optional typed parameters can have defaults and required flags. `Today` uses the server's UTC calendar date. Queries limit page size to 100 and nesting to five levels. Public access is explicitly enabled per view; users/settings are unavailable, and page views exclude drafts. Search and interactive sorting are limited to selected output fields.

Regex constraints intentionally support only a restricted simple-pattern subset to avoid expensive patterns. Array/object record controls accept JSON data. Rich text has a visual editor and sanitized HTML storage. Schema field ordering is controlled with Move up/down; list columns are chosen per field.

## Existing bindings and starter views

Existing URLs, layouts, member profiles and source names continue through the original resolvers. **Add starter member and update views** explicitly installs editable named views without rewriting existing pages or replacing existing view IDs. Specialized legacy derived shapes remain in their existing resolvers where replacing them would break templates. There is no automatic record seeding.

## Schema migration and rollback

Before a schema edit, create a full ZIP backup in Data Transfer. Preview checks every existing record and all view references. A database revision token prevents applying a preview after data changes. Safe additions/defaults are applied to a candidate copy. Removed populated fields, incompatible types, broken references and uniqueness conflicts block the operation.

The schema editor lists previous definitions and can preview a rollback; applying it uses the same compatibility checks. Rollback never silently discards a populated field. If the old definition is incompatible with newer records, export the data and perform an explicit reviewed migration, or use the full backup restore preview. A failed persistence write restores the prior in-memory database.

Full JSON and ZIP exports include schemas, custom records, views, schema history and page configuration. ZIP also includes uploaded media. Partial exports of legacy collections intentionally exclude global dynamic state; use a full export for dynamic collections. Populate/Override merge dynamic definitions, records and views by identifiers; Restore replaces them. Import validates the complete candidate before application, including relationships and bindings. Existing data-transfer recovery backups remain available.

## Validation

Run `npm test -- --runInBand` for the entire Jest suite with coverage. The Events and existing-Glossary-schema end-to-end tests use jsdom interactions with the actual Fastify routes and LowDB services; it does not substitute a real browser layout/accessibility audit. Additional tests cover JSON Schema types/constraints, relationship cardinalities, structured queries, role/CSRF checks, backup round trips, page bindings and preview/public parity.

## Schema-owned field configuration

`src/schemas/collections.json` contains the initial built-in JSON Schemas. Choices use `enum` (or `items.enum`), labels use `title`, and item defaults use `default` on item properties. UI-only annotations such as controls, grouping, list columns and manual ordering live under `x-wcos` in the same schema. There is no presentation preset registry. The generic `fieldsFromSchema` projection supplies the visual editor's controls; schemas saved through that editor retain these annotations and validation rules in their JSON Schema. Saved collection definitions take precedence over initial schemas and are included in backups. Reading the schemas never reseeds or rewrites records.
