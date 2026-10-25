# Classes and instructors

Classes now store `instructorIds`, selected from member profiles with Kaiden, Honorary Kaiden, or Head Kaiden merits (including retired variants). Instructor labels follow member name changes. Multiple teachers or no teachers are supported. Existing free-text instructor fields are migrated; ambiguous or unrecognized names remain visible as `unresolvedInstructors` until reviewed in admin. After selecting the correct members, check the option to clear those imported names.

The seven classes in the supplied page are in `src/content/classes.json`. Migration matches locations, fills missing data, maps `day` to `schedule`, preserves existing names/descriptions/schedules/active flags and class IDs, and adds missing classes. Explicitly named teachers absent from the members collection receive inactive member profiles with their source merit; no rank is invented. Review these profiles after migration. Known source aliases Vea → Vea Ravenstar and Severer → The Severer are supported; duplicate matches are left unresolved. Original legacy fields are archived on the class record.

The ranks, dues, kaidens and kaidenRules repositories, services, admin endpoints/views, data-source selections and seeds are removed. Their database collections and page data-source references are removed by migration after a full `*.backup-classes-*` backup. Public informational pages remain CMS-rendered pages.

## Apply

Startup does not migrate or seed classes. Import prepared records through Data Transfer. For an empty database use the normal `npm run db:seed`, or stop the app and run `node scripts/seed-classes.js` with the application's DB_PATH to add just the seven classes, then restart. The class seed is idempotent and preserves edits.

Paste `docs/cms/classes.html` into the Classes page editor, enable the **classes** data source and save. It displays active classes and linked instructor names, keeping the supplied table styling, introductory text, COVID notice and contact footer. The COVID notice is preserved source content, not newly verified schedule guidance. Existing custom templates must use `cls.schedule`, `cls.instructors` (member objects), and `cls.unresolvedInstructors` instead of the removed text instructor fields.
