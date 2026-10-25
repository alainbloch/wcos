# Glossary

Admin → Glossary provides create, list, edit and delete for glossary names and definitions. Definitions support HTML paragraphs, lists, emphasis and links; scripts, event handlers and unsafe URLs are removed. Names are unique ignoring case and repeated whitespace. Validation failures retain submitted values. Repository writes roll back in-memory changes if persistence fails.

Startup does not import glossary entries or restore deleted terms. Populate the glossary explicitly through Data Transfer.

Paste `docs/cms/glossary.html` into the Glossary page editor and enable the **glossary** data source. Definitions are sanitized on retrieval before the template renders their HTML. Letter navigation and groups derive from current names and update automatically. Entries sort alphabetically within their groups. Names starting with “The” group under T, numeric names under 0-9, and other symbols under Other. Accented Latin initials use their base letter. Native expandable details work without the old accordion plugin or duplicated IDs.

The source wording, lists and links are retained, including the apparent stray paragraph in the Dalmater definition. Review and correct source copy through Admin → Glossary as needed.
