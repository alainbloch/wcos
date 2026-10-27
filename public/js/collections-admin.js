/* Schema-driven administration. Labels and records are always inserted as text, never executable markup. */
(() => {
  const root = document.querySelector("[data-collection-app]");
  if (!root) return;
  const workspace = root.querySelector("[data-workspace]"),
    message = root.querySelector("[data-message]");
  let catalog, pending;
  const node = (tag, text, attrs = {}) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    for (const [name, value] of Object.entries(attrs)) {
      if (name === "value") el.value = value ?? "";
      else if (name === "checked") el.checked = Boolean(value);
      else el.setAttribute(name, value);
    }
    return el;
  };
  const button = (text, action) => {
    const el = node("button", text, { type: "button", class: "btn" });
    el.onclick = () => Promise.resolve().then(action).catch(report);
    return el;
  };
  const input = (value = "", type = "text") =>
    node("input", undefined, { type, value });
  const select = (choices, value) => {
    const el = node("select");
    for (const item of choices) {
      const [key, label] = Array.isArray(item) ? item : [item, item];
      el.append(node("option", label, { value: key }));
    }
    if (value !== undefined) el.value = value;
    return el;
  };
  const label = (text, control, parent) => {
    const el = node("label", undefined, { class: "form-group" });
    el.append(node("span", text), control);
    parent.append(el);
    return control;
  };
  const check = (text, value, parent) => {
    const el = input("", "checkbox");
    el.checked = value;
    return label(text, el, parent);
  };
  const card = (title, parent = workspace) => {
    const el = node("section", undefined, { class: "admin-card" });
    if (title) el.append(node("h2", title));
    parent.append(el);
    return el;
  };
  function report(error) {
    message.textContent = error.message || String(error);
    message.className = "alert alert-error";
  }
  function notice(text) {
    message.textContent = text;
    message.className = "alert";
  }
  async function api(action, body, query = {}) {
    const response = await fetch(
      `/admin/schema-api/${action}?${new URLSearchParams(query)}`,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": root.dataset.csrf,
            },
            body: JSON.stringify(body),
          },
    );
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "Request failed");
      error.fields = data.fields;
      throw error;
    }
    return data;
  }
  async function refresh() {
    catalog = await api("catalog");
    root.dataset.csrf = catalog.csrf;
  }
  function table(records, fields, parent, action) {
    const wrap = node("div", undefined, { class: "admin-table-container" }),
      grid = node("table", undefined, { class: "admin-table" });
    const head = node("tr");
    fields.forEach((f) => head.append(node("th", f)));
    if (action) head.append(node("th", "Actions"));
    grid.append(head);
    for (const row of records) {
      const tr = node("tr");
      for (const field of fields)
        tr.append(
          node(
            "td",
            typeof row[field] === "object"
              ? JSON.stringify(row[field])
              : String(row[field] ?? ""),
          ),
        );
      if (action) {
        const td = node("td");
        action(row, td);
        tr.append(td);
      }
      grid.append(tr);
    }
    wrap.append(grid);
    parent.append(wrap);
    if (!records.length) parent.append(node("p", "No records found."));
  }
  function collectionChooser(parent, change, system = true) {
    const choice = label(
      "Collection",
      select([
        ["", "Choose a collection"],
        ...catalog.definitions
          .filter((d) => system || !d.system)
          .map((d) => [d.id, d.label]),
      ]),
      parent,
    );
    choice.onchange = () => Promise.resolve(change(choice.value)).catch(report);
    return choice;
  }
  function schemaHome() {
    workspace.replaceChildren();
    const list = card("Collections");
    list.append(
      button("Create collection", () =>
        schemaForm({ id: "", label: "", fields: [], columns: [] }),
      ),
    );
    table(catalog.definitions, ["label", "id"], list, (definition, cell) =>
      cell.append(
        button(
          definition.system ? "Inspect protected schema" : "Edit schema",
          () => schemaForm(definition),
        ),
      ),
    );
  }
  function schemaForm(definition) {
    pending = null;
    workspace.replaceChildren();
    const form = card(
      definition.system
        ? "Protected system collection"
        : "Collection definition",
    );
    form.append(button("Back", schemaHome));
    if (definition.system) {
      form.append(
        node(
          "p",
          "This collection keeps its existing data and specialized administration. Its schema and system fields are protected.",
        ),
      );
      table(definition.fields, ["name", "type"], form);
      form.append(
        node("a", "Open existing editor", {
          href:
            definition.id === "siteSettings"
              ? "/admin/settings"
              : `/admin/${definition.id}`,
          class: "btn",
        }),
      );
      return;
    }
    const id = label("Identifier", input(definition.id), form),
      title = label("Display label", input(definition.label), form);
    if (definition.id) id.readOnly = true;
    const rows = node("div");
    form.append(rows);
    const editors = [];
    function addField(field = {}) {
      const row = card("Field", rows),
        controls = {};
      editors.push({ row, controls });
      controls.name = label("Field identifier", input(field.name), row);
      controls.label = label("Label", input(field.label), row);
      controls.type = label(
        "Type",
        select(catalog.types, field.type || "string"),
        row,
      );
      controls.required = check("Required", field.required, row);
      controls.unique = check("Unique", field.unique, row);
      controls.column = check(
        "Show in record list",
        definition.columns?.includes(field.name) || !definition.id,
        row,
      );
      const options = node("div");
      row.append(options);
      function typeOptions() {
        options.replaceChildren();
        for (const key of [
          "min",
          "max",
          "pattern",
          "options",
          "target",
          "cardinality",
          "control",
          "default",
        ])
          delete controls[key];
        const type = controls.type.value;
        if (["string", "text", "richtext", "number", "array"].includes(type)) {
          controls.min = label(
            type === "number" ? "Minimum value" : "Minimum length",
            input(field.min, "number"),
            options,
          );
          controls.max = label(
            type === "number" ? "Maximum value" : "Maximum length",
            input(field.max, "number"),
            options,
          );
        }
        if (["string", "text"].includes(type))
          controls.pattern = label(
            "Validation regex (simple anchored pattern)",
            input(field.pattern),
            options,
          );
        if (type === "enum")
          controls.options = label(
            "Choices (one per line)",
            node("textarea", (field.options || []).join("\n")),
            options,
          );
        if (type === "relationship") {
          controls.target = label(
            "Related collection",
            select(
              catalog.definitions
                .filter(
                  (d) => !["users", "siteSettings", "pages"].includes(d.id),
                )
                .map((d) => [d.id, d.label]),
              field.target,
            ),
            options,
          );
          controls.cardinality = label(
            "Cardinality",
            select(
              ["one-to-one", "one-to-many", "many-to-many"],
              field.cardinality,
            ),
            options,
          );
        } else {
          controls.default = label(
            "Default value (optional; JSON for array/object/boolean/number)",
            input(
              field.default === undefined
                ? ""
                : typeof field.default === "string"
                  ? field.default
                  : JSON.stringify(field.default),
            ),
            options,
          );
        }
        if (["string", "text"].includes(type))
          controls.control = label(
            "Form control",
            select(["input", "textarea"], field.control),
            options,
          );
      }
      controls.type.onchange = typeOptions;
      typeOptions();
      row.append(
        button("Move up", () => {
          const previous = row.previousElementSibling;
          if (previous) rows.insertBefore(row, previous);
        }),
        button("Move down", () => {
          const next = row.nextElementSibling;
          if (next) rows.insertBefore(next, row);
        }),
        button("Remove field", () => row.remove()),
      );
    }
    definition.fields.forEach(addField);
    form.append(button("Add field", () => addField()));
    const preview = node("div");
    form.append(preview);
    function read() {
      const fields = [],
        columns = [];
      for (const row of rows.children) {
        const c = editors.find((e) => e.row === row).controls;
        const f = {
          name: c.name.value,
          label: c.label.value,
          type: c.type.value,
          required: c.required.checked,
          unique: c.unique.checked,
        };
        for (const key of ["pattern", "target", "cardinality", "control"])
          if (c[key]?.value) f[key] = c[key].value;
        for (const key of ["min", "max"])
          if (c[key]?.value !== undefined && c[key].value !== "")
            f[key] = Number(c[key].value);
        if (c.options)
          f.options = c.options.value
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean);
        if (c.default?.value)
          f.default = ["array", "object", "number", "boolean"].includes(f.type)
            ? JSON.parse(c.default.value)
            : c.default.value;
        if (c.column.checked) columns.push(f.name);
        fields.push(f);
      }
      return { id: id.value, label: title.value, fields, columns };
    }
    function showPreview(result) {
      pending = result;
      preview.replaceChildren(
        node(
          "p",
          `${result.count} existing records checked. ${result.errors.length ? result.errors.join(" ") : "Compatible. Ready to apply."}`,
        ),
      );
      if (!result.errors.length)
        preview.append(
          button("Apply previewed schema", async () => {
            await api("save-schema", {
              definition: pending.definition,
              revision: pending.revision,
            });
            await refresh();
            schemaHome();
            notice("Schema saved. The generated record interface is ready.");
          }),
        );
    }
    form.addEventListener("input", () => {
      pending = null;
      preview.replaceChildren();
    });
    form.append(
      button("Preview schema changes", async () =>
        showPreview(await api("preview-schema", { definition: read() })),
      ),
    );
    if (definition.id) {
      form.append(
        button("Delete empty collection", async () => {
          if (
            !confirm(
              "Delete this empty collection? References will block deletion.",
            )
          )
            return;
          await api("delete-schema", { id: definition.id });
          await refresh();
          schemaHome();
        }),
      );
      const history = catalog.history.filter(
        (h) => h.collection === definition.id && h.definition,
      );
      if (history.length) {
        const version = label(
          "Previous schema version",
          select(history.map((h) => [h.id, h.savedAt])),
          form,
        );
        form.append(
          button("Preview rollback", async () =>
            showPreview(await api("rollback-preview", { id: version.value })),
          ),
        );
      }
    }
  }
  async function recordsHome(
    selected,
    page = 1,
    q = "",
    sort = "",
    direction = "asc",
  ) {
    workspace.replaceChildren();
    const panel = card("Collection records");
    const chooser = collectionChooser(panel, (id) => recordsHome(id));
    chooser.value = selected || "";
    if (!selected) return;
    const def = catalog.definitions.find((d) => d.id === selected);
    if (["users", "siteSettings"].includes(selected)) {
      panel.append(
        node("a", "Open system administration", {
          href: selected === "users" ? "/admin/users" : "/admin/settings",
        }),
      );
      return;
    }
    const search = label("Search", input(q, "search"), panel);
    const sorting = label(
      "Sort field",
      select([["", "Default"], ...def.fields.map((f) => f.name)], sort),
      panel,
    );
    const order = label("Direction", select(["asc", "desc"], direction), panel);
    panel.append(
      button("Search / sort", () =>
        recordsHome(selected, 1, search.value, sorting.value, order.value),
      ),
    );
    if (!def.system)
      panel.append(button("Create record", () => recordForm(def)));
    const result = await api("records", undefined, {
      collection: selected,
      page,
      q,
      ...(sort ? { sort, direction } : {}),
    });
    table(
      result.records,
      def.columns.length ? def.columns : ["id"],
      panel,
      (row, cell) => {
        if (def.system)
          cell.append(
            node("a", "Edit in existing editor", {
              href: `/admin/${def.id}/${encodeURIComponent(row.id)}/edit`,
            }),
          );
        else
          cell.append(
            button("View", () => recordForm(def, row.id, true)),
            button("Edit", () => recordForm(def, row.id)),
          );
      },
    );
    panel.append(
      node(
        "p",
        `${result.total} records · Page ${result.page} of ${Math.max(1, result.pages)}`,
      ),
    );
    if (page > 1)
      panel.append(
        button("Previous", () =>
          recordsHome(selected, page - 1, q, sort, direction),
        ),
      );
    if (page < result.pages)
      panel.append(
        button("Next", () =>
          recordsHome(selected, page + 1, q, sort, direction),
        ),
      );
  }
  async function recordForm(def, id, readonly = false) {
    const record = id
      ? await api("record", undefined, { collection: def.id, id })
      : {};
    workspace.replaceChildren();
    const panel = card(
      `${readonly ? "View" : id ? "Edit" : "Create"} ${def.label}`,
    );
    panel.append(button("Back to records", () => recordsHome(def.id)));
    const form = node("form", undefined, { class: "admin-form" });
    panel.append(form);
    const controls = new Map(),
      errors = new Map();
    for (const field of def.fields) {
      let value = record[field.name] ?? field.default;
      if (readonly) {
        const section = node("div");
        section.append(
          node("strong", field.label),
          node(
            "p",
            typeof value === "object"
              ? JSON.stringify(value)
              : String(value ?? ""),
          ),
        );
        form.append(section);
        continue;
      }
      let control;
      if (field.type === "boolean") {
        control = input("", "checkbox");
        control.checked = value === true;
      } else if (field.type === "enum")
        control = select([["", "Choose…"], ...field.options], value);
      else if (field.type === "relationship") {
        control = select([]);
        if (field.cardinality !== "one-to-one") control.multiple = true;
        else control.append(node("option", "Choose…", { value: "" }));
        const selected = new Set([value].flat().filter(Boolean));
        selected.forEach((id) => {
          const option = node("option", id, { value: id });
          option.selected = true;
          control.append(option);
        });
        const find = label(`Find ${field.label}`, input("", "search"), form);
        let relationshipPage = 1;
        async function loadOptions(reset = false) {
          if (reset) relationshipPage = 1;
          const result = await api("records", undefined, {
            collection: field.target,
            q: find.value,
            page: relationshipPage,
          });
          for (const row of result.records) {
            let option = [...control.options].find((o) => o.value === row.id);
            if (!option) {
              option = node("option", "", { value: row.id });
              control.append(option);
            }
            option.textContent =
              row.title || row.name || row.position || row.id;
          }
          relationshipPage++;
          more.disabled = relationshipPage > result.pages;
        }
        const more = button("More related records", () => loadOptions());
        form.append(
          button("Search related records", () => loadOptions(true)),
          more,
        );
        await loadOptions();
      } else if (
        ["text", "richtext", "array", "object"].includes(field.type) ||
        field.control === "textarea"
      ) {
        control = node(
          "textarea",
          typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : value || "",
          { rows: 5 },
        );
      } else
        control = input(
          value,
          field.type === "number"
            ? "number"
            : field.type === "date"
              ? "date"
              : "text",
        );
      if (field.type === "number") control.step = "any";
      if (field.required && field.type !== "boolean") control.required = true;
      control.name = field.name;
      label(`${field.label}${field.required ? " *" : ""}`, control, form);
      if (field.type === "richtext") {
        const editor = node("div", undefined, {
          contenteditable: "true",
          role: "textbox",
          "aria-label": `${field.label} rich text`,
          class: "source-editor",
        });
        // Only server-sanitized rich text is inserted here.
        editor.innerHTML = value || "";
        editor.oninput = () => {
          control.value = editor.innerHTML;
        };
        control.oninput = () => {
          editor.textContent = control.value;
        };
        form.append(editor);
        for (const command of ["bold", "italic", "insertUnorderedList"])
          form.append(
            button(command, () => {
              editor.focus();
              document.execCommand(command);
              control.value = editor.innerHTML;
            }),
          );
      }
      if (field.type === "media") {
        const picker = label(
          "Choose uploaded media",
          select([["", "Choose…"], ...(await api("media"))]),
          form,
        );
        picker.onchange = () => {
          control.value = picker.value;
        };
        const upload = label("Upload image or video", input("", "file"), form);
        upload.accept = "image/*,video/mp4,video/webm";
        form.append(
          button("Upload", async () => {
            if (!upload.files[0]) throw new Error("Choose a file.");
            const payload = new FormData();
            payload.append("file", upload.files[0]);
            const response = await fetch("/admin/schema-api/upload", {
              method: "POST",
              headers: { "X-CSRF-Token": root.dataset.csrf },
              body: payload,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            control.value = data.url;
            notice("Media uploaded. Save the record to attach it.");
          }),
        );
      }
      if (["array", "object"].includes(field.type))
        form.append(node("small", "Enter valid JSON data."));
      const error = node("p", "", { role: "alert", class: "field-error" });
      form.append(error);
      errors.set(field.name, error);
      controls.set(field.name, control);
    }
    if (readonly) return;
    form.append(
      node("button", "Save record", {
        type: "submit",
        class: "btn btn-primary",
      }),
    );
    form.onsubmit = async (event) => {
      event.preventDefault();
      errors.forEach((el) => {
        el.textContent = "";
      });
      try {
        const values = {};
        for (const field of def.fields) {
          const control = controls.get(field.name),
            raw = control.value;
          if (field.type === "boolean") values[field.name] = control.checked;
          else if (field.type === "relationship" && control.multiple)
            values[field.name] = [...control.selectedOptions].map(
              (o) => o.value,
            );
          else if (raw !== "")
            values[field.name] = ["object", "array"].includes(field.type)
              ? JSON.parse(raw)
              : field.type === "number"
                ? Number(raw)
                : raw;
        }
        await api("save-record", {
          collection: def.id,
          id,
          record: values,
          replace: true,
        });
        await recordsHome(def.id);
        notice("Record saved.");
      } catch (error) {
        report(error);
        for (const [key, text] of Object.entries(error.fields || {}))
          if (errors.has(key)) errors.get(key).textContent = text;
      }
    };
    if (id)
      panel.append(
        button("Delete record", async () => {
          if (!confirm("Delete this record?")) return;
          await api("delete-record", { collection: def.id, id });
          await recordsHome(def.id);
          notice("Record deleted.");
        }),
      );
  }
  function viewsHome() {
    workspace.replaceChildren();
    const panel = card("Named data views");
    panel.append(
      button("Create data view", () =>
        viewForm({
          name: "",
          id: "",
          collection: "",
          fields: [],
          sort: [],
          parameters: [],
        }),
      ),
    );
    panel.append(
      button("Add starter member and update views", async () => {
        await api("starter-views", {});
        await refresh();
        viewsHome();
        notice(
          "Starter views added. Existing views and page bindings were preserved.",
        );
      }),
    );
    table(
      catalog.views,
      ["name", "id", "collection", "public"],
      panel,
      (view, cell) => cell.append(button("Edit", () => viewForm(view))),
    );
  }
  function viewForm(view) {
    workspace.replaceChildren();
    const panel = card("Data view");
    panel.append(button("Back", viewsHome));
    const name = label("Name", input(view.name), panel),
      id = label("Identifier", input(view.id), panel);
    if (view.id) id.readOnly = true;
    const collection = label(
      "Source collection",
      select(
        [
          ["", "Choose…"],
          ...catalog.definitions
            .filter((d) => !["users", "siteSettings"].includes(d.id))
            .map((d) => [d.id, d.label]),
        ],
        view.collection,
      ),
      panel,
    );
    const isPublic = check(
      "Allow this view on public pages",
      view.public,
      panel,
    );
    panel.append(
      node(
        "p",
        "Only selected output fields are exposed. Public page views exclude unpublished pages.",
      ),
    );
    const pageSize = label(
      "Records per page (1–100)",
      input(view.pageSize || 12, "number"),
      panel,
    );
    const fieldPanel = card("Output fields", panel),
      filterPanel = card("Filters", panel),
      sortPanel = card("Sorting", panel),
      paramPanel = card("Optional query parameters", panel);
    let output = [],
      readFilters,
      sorts = [];
    const params = [];
    function addParameter(p = {}) {
      const row = node("div");
      paramPanel.append(row);
      const paramName = label("Parameter name", input(p.name), row),
        type = label(
          "Type",
          select(["string", "number", "boolean", "date"], p.type),
          row,
        ),
        value = label("Default", input(p.default), row),
        required = check("Required", p.required, row);
      params.push({
        row,
        read: () => ({
          name: paramName.value,
          type: type.value,
          ...(value.value !== "" ? { default: value.value } : {}),
          required: required.checked,
        }),
      });
      row.append(button("Remove parameter", () => row.remove()));
    }
    view.parameters.forEach(addParameter);
    paramPanel.append(button("Add parameter", () => addParameter()));
    function rebuild() {
      fieldPanel.replaceChildren(node("h2", "Output fields"));
      filterPanel.replaceChildren(node("h2", "Filters"));
      sortPanel.replaceChildren(node("h2", "Sorting"));
      const definition = catalog.definitions.find(
        (d) => d.id === collection.value,
      );
      if (!definition) return;
      const fields = definition.fields.map((f) => f.name);
      for (const f of definition.fields.filter(
        (f) => f.type === "relationship",
      )) {
        const target = catalog.definitions.find((d) => d.id === f.target);
        for (const child of target?.fields || [])
          fields.push(`${f.name}.${child.name}`);
      }
      output = fields.map((field) => [
        field,
        check(field, view.fields.includes(field), fieldPanel),
      ]);
      function group(
        parent,
        initial = { logic: "and", conditions: [] },
        depth = 0,
      ) {
        const box = node("fieldset");
        parent.append(box);
        box.append(node("legend", "Filter group"));
        const logic = label(
          "Match",
          select(
            [
              ["and", "All (AND)"],
              ["or", "Any (OR)"],
            ],
            initial.logic,
          ),
          box,
        );
        const children = node("div");
        box.append(children);
        const readers = [];
        function condition(data = {}) {
          const row = node("div");
          children.append(row);
          const field = label("Field", select(fields, data.field), row),
            operator = label(
              "Operator",
              select(
                [
                  "eq",
                  "ne",
                  "contains",
                  "gt",
                  "gte",
                  "lt",
                  "lte",
                  "in",
                  "exists",
                ],
                data.operator,
              ),
              row,
            );
          const source = label(
            "Compare with",
            select(
              [
                ["value", "Fixed value"],
                ["parameter", "Query parameter"],
                ["today", "Today"],
              ],
              data.parameter ? "parameter" : data.relative ? "today" : "value",
            ),
            row,
          );
          const value = label(
            "Value or parameter name",
            input(
              data.parameter ||
                (data.value === undefined
                  ? ""
                  : typeof data.value === "object"
                    ? JSON.stringify(data.value)
                    : data.value),
            ),
            row,
          );
          readers.push({
            row,
            read: () => {
              let v = value.value;
              if (source.value === "value") {
                try {
                  v = JSON.parse(v);
                } catch {
                  /* Plain text remains text. */
                }
              }
              return {
                field: field.value,
                operator: operator.value,
                ...(source.value === "parameter"
                  ? { parameter: value.value }
                  : source.value === "today"
                    ? { relative: "today" }
                    : { value: v }),
              };
            },
          });
          row.append(button("Remove condition", () => row.remove()));
        }
        function nested(data) {
          const row = node("div");
          children.append(row);
          const read = group(row, data, depth + 1);
          readers.push({ row, read });
          row.append(button("Remove group", () => row.remove()));
        }
        for (const child of initial.conditions || [])
          child.conditions ? nested(child) : condition(child);
        box.append(button("Add condition", () => condition()));
        if (depth < 4) box.append(button("Add group", () => nested()));
        return () => ({
          logic: logic.value,
          conditions: readers
            .filter((r) => r.row.isConnected)
            .map((r) => r.read()),
        });
      }
      readFilters = group(filterPanel, view.filters);
      sorts = [];
      function addSort(data = {}) {
        const row = node("div");
        sortPanel.append(row);
        const field = label("Sort field", select(fields, data.field), row),
          direction = label(
            "Direction",
            select(["asc", "desc"], data.direction),
            row,
          );
        sorts.push({
          row,
          read: () => ({ field: field.value, direction: direction.value }),
        });
        row.append(button("Remove sort", () => row.remove()));
      }
      view.sort.forEach(addSort);
      sortPanel.append(button("Add sort field", () => addSort()));
    }
    collection.onchange = rebuild;
    rebuild();
    const result = card("Preview", panel);
    const read = () => ({
      id: id.value,
      name: name.value,
      collection: collection.value,
      public: isPublic.checked,
      pageSize: Number(pageSize.value),
      fields: output
        .filter(([, check]) => check.checked)
        .map(([field]) => field),
      filters: readFilters?.(),
      sort: sorts.filter((s) => s.row.isConnected).map((s) => s.read()),
      parameters: params.filter((p) => p.row.isConnected).map((p) => p.read()),
    });
    panel.append(
      button("Preview results", async () => {
        const data = await api("preview-view", { view: read() });
        result.replaceChildren(node("h2", `${data.total} matching records`));
        table(data.records, data.view.fields, result);
      }),
      button("Save view", async () => {
        await api("save-view", { view: read() });
        await refresh();
        viewsHome();
        notice("Data view saved. Select it in a page’s Data sources dropdown.");
      }),
    );
    if (view.id)
      panel.append(
        button("Delete view", async () => {
          if (!confirm("Delete this data view?")) return;
          await api("delete-view", { id: view.id });
          await refresh();
          viewsHome();
        }),
      );
  }
  refresh()
    .then(() => {
      notice("Ready.");
      if (root.dataset.mode === "schema") schemaHome();
      else if (root.dataset.mode === "views") viewsHome();
      else recordsHome();
    })
    .catch(report);
})();
