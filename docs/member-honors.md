# Hall of Heroes

Members now have `fallenHero` (boolean) and `championships` (an array of `{ year, note }`). Use the Hall of Heroes section of the member form to add or remove years. Years are four-digit integers and must be unique within and across members. The optional note preserves distinctions such as Champions Edition. Active status is independent of honors; inactive members still appear in both Hall sections.

Existing databases migrate automatically on restart, with a `*.backup-honors-*` backup. Existing Champions records take precedence over source awards for the same year. Name matching ignores Kaiden/Head Kaiden/Honorary Kaiden/Master prefixes and case. Matching profiles keep their images and biography; missing images are filled from the supplied page. Missing people receive inactive profiles without invented ranks. Such historical profiles can be edited with an unknown rank. Ambiguous names, invalid records and conflicting years are retained in `honorsMigrationReview` and shown on the admin Members list for review. The complete original data remains in the backup.

The source includes 20 awarded years and eight Fallen Heroes (including Joel, confirmed on the older Hall of Heroes page). The inconsistent secondary layout's 2010 winner is resolved to Gad, agreeing with the primary cards and old page. 2006 has no champion and is kept as a static page note. Champions of the Coliseum is not converted into Best of the Best awards. The old Champions repository, service, admin routes/views and seeds are removed; the `champions` CMS source now derives member awards and returns `{year, note, member}` records.

## Apply

After merging, restart to migrate. No separate migration script is required. Fresh installations using `npm run db:seed` also get the honors data. Do not reset an existing database. Review any migration notices on Admin → Members.

Paste `docs/cms/hall-of-heroes.html` into the Hall of Heroes page editor and enable **champions**, **fallenHeroes**, and **members** data sources. Both source layouts keep their Elementor structure and derive champions in chronological order. Fallen Heroes are member-backed, and cards open the generic member-profile modal. Supporters and The Way of the Contract remain static HTML. Custom templates using the old champions source must use `honor.member.position` and `honor.member.image` for member values.
