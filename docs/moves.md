# Moves

`/admin/moves` replaces Core Moves administration. Choose a member as creator, check Core move to include it on the public core-moves page, and attach images or videos using uploads or direct HTTP(S) URLs. Images are decoded and converted to WebP. Videos accept MP4/WebM containers; uploads use the configured `MAX_FILE_SIZE` (10 MB by default). Uploads are stored immediately; removing an association does not delete the file, since other moves may reference it.

The Move types dropdown supports any combination of Straight Offense, Offensive Defense, and Initiated Response. Selections are stored in `move.types`; existing moves start with no assigned types until edited. No migration or seed command is needed for this field.

Drag list rows (or use Up/Down) to automatically save move order. Failed requests restore the last saved order and display an error. Media rows support drag and Up/Down; save the move to persist their order. Creator is optional for historical moves with unknown attribution. Deleting a member does not delete their moves.

Startup does not rename legacy `coreMoves` collections or seed moves. Import prepared move records explicitly through Data Transfer. `moves` is the full ordered CMS data source; `coreMoves` remains a filtered source containing only core moves.

## Deploy and seed

1. Stop the application before seeding to avoid concurrent writes to the JSON database.
2. Run `node scripts/seed-core-moves.js`, then restart the application. Run the command using the same environment/DB_PATH as the application. It adds missing moves from the supplied page without modifying existing entries. It can be rerun safely. Existing moves retain their positions; new moves append in source order. Use the admin list to adjust the combined order if needed.
3. Paste `docs/cms/core-moves.html` into the Core Moves page editor, enable the **coreMoves** and **members** data sources, and save. The page keeps its three move-type explanations and Elementor accordion styling, with dynamic move names, text, creator and ordered media.

For a fresh installation, `npm run db:seed` includes these same 45 moves. Do not reset an existing database. The source's unconfirmed teacher move label is preserved; no creators or descriptions were invented. Existing historical sample descriptions are preserved by the additive seed and can be reviewed in admin.
