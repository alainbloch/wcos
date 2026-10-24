# Dynamic Page Rendering Spec (v1)

## Goal
Page records in the CMS can specify a data source and template partial so the controller renders dynamically instead of hardcoding per-page logic.

## Page Record Fields (new / updated)
- `slug`: string — route key (existing)
- `title`: string (existing)
- `published`: boolean (existing)
- `content`: string — raw HTML (existing); can be empty when `templatePartial` or `dataSources` is set
- `dataSources`: string[] | null — array of repository/service names to pull data from. Examples: [`members`], [`members`, `champions`], [`classes`]
- `templatePartial`: string | null — njk partial path relative to `views/`. Example: `partials/member-rows.njk`
- `layout`: string | null — layout template path. Default: `pages/reference.njk`
- `parentSlug`: string | null — nested page parent (empty for root pages)
- `styleOverrides`: string | null — optional CSS snippet or stylesheet reference for dynamic styles

## Rendering Rules
1. If `dataSources` is set, the controller resolves each repository/service, fetches all data, and passes a combined dataset (keyed by source name or aggregated) to the view.
2. If `templatePartial` is set, the partial is rendered with the fetched data and injected into/replaces the page content.
3. If `layout` is set, the page uses that layout instead of the default.
4. If `parentSlug` is set, the page is nested; navigation/layout can reflect the hierarchy.

## Injection Mode (to be decided in implementation)
- `replace`: partial replaces `content`
- `inject`: partial is rendered into a placeholder inside `content`

## Data Seeds Update
All seed pages should have `dataSource: null`, `templatePartial: null`, `layout: null`, `parentSlug: null`, `styleOverrides: null` by default so existing behavior is preserved.
