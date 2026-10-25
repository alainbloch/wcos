# Council membership

Council members are ordinary member records. Edit shared names, biography, image,
rank, and contact details once in **Admin → Members**. The **Council Service**
section adds `councilPosition`, `councilTitle`, `councilTermStart`, `councilTermEnd`,
`councilHistoricalDate`, and `councilCurrent`.

Dates are text so years and approximate dates are supported. **Current council
member** is an explicit checkbox; dates do not automatically enable or expire it.
It is independent of the member's Active checkbox. To end service, record the term
end and uncheck Current council member.

## Filters

The member list has All members, All council members, and Current council members
options. Its URLs are `/admin/members`, `/admin/members?council=all`, and
`/admin/members?council=current`.

Enable the `members` data source on a CMS page, then use:

```njk
{% for member in members | councilMembers %}
  <h2>{{ member.position }}</h2>
  <p>{{ member.councilPosition }} {{ member.councilTitle }}</p>
  <p>{{ member.councilTermStart }} – {{ member.councilTermEnd }}</p>
{% endfor %}

{% for member in members | currentCouncilMembers %}
  <h2>{{ member.position }}</h2>
{% endfor %}
```

All council members includes records with a term start, term end, historical date,
imported council history, or current status. A `Council` merit or council title
alone does not establish a term. Current council members requires the boolean
`councilCurrent` to be true.

The page editor also offers `councilMembers` and `currentCouncilMembers` as
pre-filtered data sources. Both query the members repository; neither is a
separate collection. These return the **member schema**: the name is `position`,
the council role is `councilPosition`, and the biography is `biography`. Update
legacy council templates using `name`, `bio`, `termStart`, `termEnd`, `current`, or
`title` to use the corresponding member fields.

## Existing databases

Startup no longer runs this historical migration. The legacy migration helper (retained for explicit maintenance only):

1. Writes a restricted-permission backup next to `DB_PATH`, named
   `<database filename>.backup-council-<timestamp>`.
2. Matches council names to member circle names, ignoring case and extra spaces.
   The three old bundled seed aliases have explicit mappings.
3. Fills missing shared biography/image fields without overwriting member values.
   Keeps all imported terms in each member's read-only `councilHistory`, shown
   under Imported council history. Current imported service takes priority over
   former service for the editable fields.
4. Creates an inactive member when no unique match is available. Review these
   records, assign their level, and enable Active only when appropriate. No fuzzy
   identity matching or rank guessing is performed.
5. Removes the old council collection. Seed-only Council Formation headings and
   unnamed legacy records remain in the backup, not as fictional members. The
   existing public council page's historical content is unchanged.

The migration runs once because the old collection is removed. It does not reseed
council data. A backup or migration failure stops initialization rather than
silently proceeding. Keep the backup until you have reviewed the migrated records.

The separate council repository, service, admin screens, routes, and seed entries
are removed. Member repository methods are `findCouncilMembers()` and
`findCurrentCouncilMembers()`; corresponding service methods are
`getCouncilMembers()` and `getCurrentCouncilMembers()`.
