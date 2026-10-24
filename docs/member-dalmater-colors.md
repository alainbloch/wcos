# Member dalmater colors

Edit **Admin → Members → Dalmater Color**. Choose:

- **Choose a Kaiden's color:** the dropdown includes members with Kaiden, Head
  Kaiden, or Honorary Kaiden merits and a complete color name/hex. Retired Kaidens
  remain eligible. The current member is excluded. Saving copies the selected
  name and hex, so subsequent changes or deletion of the Kaiden do not change
  the member's color. Re-save that selection to copy its latest values. If the
  source no longer exists or is no longer eligible, select another Kaiden or
  switch to Custom to keep/edit the stored color.
- **Custom color:** enter a name and `#RRGGBB` or `#RGB`. Hex is normalized to six
  uppercase digits. Invalid colors are rejected without changing the member.
- **No color assigned:** clears the assignment.

Stored fields are `dalmaterMode`, `dalmaterKaidenId` (selection provenance),
`dalmaterColorName`, and `dalmaterColorHex`. Existing callers that omit the entire
color section leave an assigned color unchanged.

## Migration and commands

After merging/updating the application, restart normally:

```sh
npm start
# Or, for local development:
npm run dev
```

No separate migration command, dependency install, or database reset is needed.
Startup creates `<DB_PATH>.backup-dalmater-<timestamp>` with restricted permissions,
then migrates the old `dalmaterColors` collection into members and removes it.
The backup and migration happen only if the legacy collection exists. Do not run
`db:reset` or `db:seed` to perform this migration.

Names are matched after removing Kaiden honorifics and retired suffixes; Severer
maps to The Severer. Ambiguous or unmatched people become inactive members for
review. Existing member colors are preserved; full original color records,
including order, descriptions, status, and requirements, are retained in each
member's `dalmaterLegacyRecords` and in the backup. Their Kaiden merit is added
when missing. The migration does not invent missing fighting levels.

Legacy named colors without a hex retain the name and show a review notice in
the form. They can be saved unchanged while the exact shade is unknown, but are
not offered in the dropdown until a valid hex is provided. New custom colors
must have both values. Legacy hex-only records use the hex as their initial
editable color name.

The Red Dalmater entry is a qualification rather than a person. It remains in
the migration backup and the existing public page content; it does not create a
fictional member profile. Unnamed legacy entries are also retained in the backup.

The old color repository/service, CRUD controller methods, admin routes/screens,
and color seeds are removed. Kaiden information/rules models remain because they
store instructional content, not color assignments.

## CMS templates

Use the `members` data source and these member fields:

```njk
{% for member in members %}
  {% if member.dalmaterColorName %}
    <p>{{ member.position }} — {{ member.dalmaterColorName }} {{ member.dalmaterColorHex }}</p>
  {% endif %}
{% endfor %}
```

The `dalmaterColors` page data source remains as a compatibility selection, but
now returns members with assigned colors. Update legacy templates to use
`position`, `dalmaterColorName`, and `dalmaterColorHex` rather than `kaiden`/`color`.
Static historical page content is not overwritten by the migration.

Run the regression suite with `npm test -- --runInBand`.
