/** Page data-source migration.
 *
 * Collectio-backed data sources now live in many-to-many relationship fields on the
 * Pages schema (`updates`, `members`, `glossary`, `classes`, `moves`), selected as
 * specific records. The legacy freeform `dataSources` array keeps only the advanced
 * / computed bindings (derived member shapes, updates by category, and `view:` data
 * views) which cannot be modelled as M2M relationships to a collection.
 *
 * The old model recorded "include all records of collection X", not specific IDs, so
 * real relationship selections cannot be inferred: migrated pages start with those
 * relationship fields empty and an admin re-selects the records. The removed
 * `dataView` object (auto-rendered component) is discarded. Run explicitly, never at
 * startup.
 */
export function migratePageDataSources(data) {
  const collectionSources = new Set([
    "updates",
    "members",
    "glossary",
    "classes",
    "moves",
  ]);
  for (const page of data.pages || []) {
    if (Array.isArray(page.dataSources))
      page.dataSources = page.dataSources.filter(
        (source) => typeof source !== "string" || !collectionSources.has(source),
      );
    delete page.dataView;
  }
  data.migrations ||= {};
  data.migrations.pageDataSources = true;
}