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
    if (control.type === "checkbox") {
      el.classList.add("collection-checkbox");
      el.append(control, node("span", text));
    } else el.append(node("span", text), control);
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
    message.hidden = false;
    message.className = "alert alert-error";
  }
  function notice(text) {
    message.textContent = text;
    message.hidden = !text;
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
  const human = (value) =>
    String(value || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]/g, " ")
      .replace(/^./, (c) => c.toUpperCase());
  const display = (value) =>
    value == null || value === ""
      ? "—"
      : typeof value === "boolean"
        ? value
          ? "Yes"
          : "No"
        : Array.isArray(value)
          ? value.length
            ? value.map(display).join(", ")
            : "None"
          : typeof value === "object"
            ? Object.entries(value)
                .map(([k, v]) => `${human(k)}: ${display(v)}`)
                .join(" · ")
            : String(value);
  function table(records, fields, parent, action, definition) {
    const wrap = node("div", undefined, { class: "admin-table-container" }),
      grid = node("table", undefined, { class: "admin-table" });
    const head = node("tr");
    fields.forEach((f) =>
      head.append(
        node(
          "th",
          definition?.fields.find((field) => field.name === f)?.label ||
            human(f),
        ),
      ),
    );
    if (action) head.append(node("th", "Actions"));
    grid.append(head);
    const tbody = node("tbody");
    grid.append(tbody);
    for (const row of records) {
      const tr = node("tr");
      tr.dataset.recordId = row.id || "";
      for (const field of fields)
        tr.append(
          node(
            "td",
            definition?.fields.find((f) => f.name === field)?.type ===
              "richtext"
              ? new DOMParser().parseFromString(
                  String(row[field] || ""),
                  "text/html",
                ).body.textContent
              : display(row[field]),
          ),
        );
      if (action) {
        const td = node("td", undefined, { class: "collection-row-actions" });
        action(row, td);
        tr.append(td);
      }
      tbody.append(tr);
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
          definition.locked ? "Inspect protected schema" : "Edit schema",
          () => schemaForm(definition),
        ),
      ),
    );
  }
  function schemaForm(definition) {
    pending = null;
    workspace.replaceChildren();
    const form = card(
      definition.locked
        ? "Protected system collection"
        : definition.label
          ? `${definition.label} schema`
          : "New collection",
    );
    form.append(button("Back", schemaHome));
    if (definition.locked) {
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
    const metadata = node("div", undefined, { class: "schema-metadata" });
    form.append(metadata);
    const id = label("Identifier", input(definition.id), metadata),
      title = label("Display label", input(definition.label), metadata);
    if (definition.id) id.readOnly = true;
    const singular = label(
      "Singular label (for Add/Edit)",
      input(definition.singularLabel || definition.label),
      metadata,
    );
    const description = label(
      "Description",
      input(definition.description),
      metadata,
    );
    const orderField = label(
      "Manual ordering field",
      select(
        [
          ["", "None"],
          ...definition.fields
            .filter((f) => f.type === "number")
            .map((f) => [f.name, f.label]),
        ],
        definition.orderField,
      ),
      metadata,
    );
    const rows = node("div");
    form.append(
      button("Expand all fields", () => {
        [...rows.children].forEach((row) => (row.open = true));
      }),
      button("Collapse all fields", () => {
        [...rows.children].forEach((row) => (row.open = false));
      }),
    );
    form.append(rows);
    const editors = [];
    function addField(field = {}) {
      const row = node("details", undefined, { class: "schema-field" }),
        controls = {};
      const summary = node(
        "summary",
        `${field.label || human(field.name) || "New field"} · ${field.type || "string"}${field.required ? " · Required" : ""}`,
      );
      row.append(summary);
      rows.append(row);
      row.open = !field.name;
      row.addEventListener("input", () => {
        summary.textContent = `${controls.label.value || human(controls.name.value) || "New field"} · ${controls.type.value}${controls.required.checked ? " · Required" : ""}`;
      });
      editors.push({ row, controls });
      controls.name = label("Field identifier", input(field.name), row);
      controls.label = label("Label", input(field.label), row);
      controls.group = label("Form section", input(field.group), row);
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
      const options = node("details", undefined, { class: "schema-options" });
      row.append(options);
      function typeOptions() {
        options.replaceChildren(
          node("summary", "Choices, defaults and validation"),
        );
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
        if (["enum", "array", "string", "text"].includes(type))
          controls.options = label(
            "Choices (one per line)",
            node("textarea", (field.options || []).join("\n")),
            options,
          );
        if (type === "relationship" || field.control === "reference") {
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
              ["one-to-one", "many-to-one", "one-to-many", "many-to-many"],
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
        if (["string", "text", "array"].includes(type))
          controls.control = label(
            "Form control",
            select(
              type === "array"
                ? ["list", "multiselect", "media-list"]
                : ["input", "textarea", "select", "reference", "hidden"],
              field.control,
            ),
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
          ...definition.fields.find((field) => field.name === c.name.value),
          name: c.name.value,
          label: c.label.value,
          group: c.group.value,
          type: c.type.value,
          required: c.required.checked,
          nullable:
            definition.fields.find((field) => field.name === c.name.value)
              ?.nullable === true,
          optionRule: definition.fields.find(
            (field) => field.name === c.name.value,
          )?.optionRule,
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
      return {
        ...definition,
        id: id.value,
        label: title.value,
        singularLabel: singular.value,
        description: description.value,
        orderField: orderField.value,
        fields,
        columns,
      };
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
    if (definition.id && !definition.system) {
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
    }
    if (definition.id) {
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
    if (!selected) {
      const panel = card("Collections");
      const links = node("div", undefined, { class: "collection-directory" });
      for (const def of catalog.definitions.filter((d) => !d.locked))
        links.append(
          node("a", def.label, {
            class: "btn",
            href: `/admin/collections/${encodeURIComponent(def.id)}`,
          }),
        );
      panel.append(links);
      return;
    }
    const def = catalog.definitions.find((d) => d.id === selected);
    if (!def || def.locked) return;
    const panel = card();
    const heading = document.querySelector(".admin-heading h1");
    if (heading) heading.textContent = def.label;
    const top = node("div", undefined, { class: "collection-heading" });
    top.append(
      node("p", def.description || `Manage ${def.label.toLowerCase()}.`),
    );
    const create = button(`Add ${def.singularLabel || def.label}`, () =>
      recordForm(def),
    );
    create.classList.add("btn-primary");
    top.append(create);
    panel.append(top);
    const toolbar = node("form", undefined, { class: "collection-toolbar" });
    panel.append(toolbar);
    const search = label("Search", input(q, "search"), toolbar);
    search.placeholder = `Search ${def.label.toLowerCase()}…`;
    const sorting = label(
      "Sort by",
      select(
        [
          ["", "Default order"],
          ...def.fields
            .filter((f) => !["array", "object", "richtext"].includes(f.type))
            .map((f) => [f.name, f.label]),
        ],
        sort,
      ),
      toolbar,
    );
    const order = label(
      "Direction",
      select(
        [
          ["asc", "Ascending"],
          ["desc", "Descending"],
        ],
        direction,
      ),
      toolbar,
    );
    const apply = node("button", "Apply", { type: "submit", class: "btn" });
    toolbar.append(apply);
    toolbar.onsubmit = (event) => {
      event.preventDefault();
      recordsHome(selected, 1, search.value, sorting.value, order.value).catch(
        report,
      );
    };
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
        cell.append(
          button("View", () => recordForm(def, row.id, true)),
          button("Edit", () => recordForm(def, row.id)),
          button("Delete", async () => {
            if (!confirm(`Delete ${row.name || row.title || "this record"}?`))
              return;
            await api("delete-record", { collection: def.id, id: row.id });
            await recordsHome(selected, page, q, sort, direction);
          }),
        );
        if (def.orderField && !q && !sort) {
          for (const [caption, delta] of [
            ["↓", 1],
            ["↑", -1],
          ]) {
            const move = button(caption, async () => {
              await api("move-record", {
                collection: def.id,
                id: row.id,
                delta,
              });
              await recordsHome(selected, page, q, sort, direction);
            });
            move.setAttribute(
              "aria-label",
              `Move ${row.name || row.title || "record"} ${delta < 0 ? "up" : "down"}`,
            );
            cell.prepend(move);
          }
        }
      },
      def,
    );
    if (def.orderField && !q && !sort) {
      panel.insertBefore(
        node(
          "p",
          "Drag a row to reorder, or use Up / Down. Changes save automatically.",
        ),
        panel.querySelector(".admin-table-container"),
      );
      let dragged;
      for (const row of panel.querySelectorAll("tbody tr")) {
        row.draggable = true;
        row.ondragstart = (event) => {
          dragged = row.dataset.recordId;
          event.dataTransfer.setData("text/plain", dragged);
        };
        row.ondragover = (event) => event.preventDefault();
        row.ondrop = async (event) => {
          event.preventDefault();
          if (!dragged || dragged === row.dataset.recordId) return;
          try {
            await api("move-record", {
              collection: def.id,
              id: dragged,
              beforeId: row.dataset.recordId,
            });
            await recordsHome(selected, page);
          } catch (error) {
            report(error);
          }
        };
      }
    }
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
  function structuredControl(field, value, parent) {
    const hidden = input("", "hidden");
    const section = node("fieldset", undefined, {
      class: "collection-structured",
    });
    section.append(node("legend", field.label));
    const media = field.control === "media-list";
    const isArray = field.type === "array";
    let data = structuredClone(value ?? (isArray ? [] : {}));
    const rows = node("div");
    section.append(rows);
    const sync = () => {
      hidden.value = JSON.stringify(data);
      section.dispatchEvent(new Event("input", { bubbles: true }));
    };
    function scalar(value, changed) {
      if (value && typeof value === "object") {
        const nested = node("div");
        const input = structuredControl(
          { label: "Details", type: Array.isArray(value) ? "array" : "object" },
          value,
          nested,
        );
        nested.addEventListener("input", () =>
          changed(JSON.parse(input.value)),
        );
        return nested;
      }
      const control = input(
        value ?? "",
        typeof value === "boolean"
          ? "checkbox"
          : typeof value === "number"
            ? "number"
            : "text",
      );
      if (typeof value === "boolean") control.checked = value;
      control.oninput = () =>
        changed(
          control.type === "checkbox"
            ? control.checked
            : control.type === "number"
              ? Number(control.value)
              : control.value,
        );
      return control;
    }
    async function attachPicker(row, item, url) {
      const picker = label(
        "Choose uploaded media",
        select([["", "Choose…"], ...(await api("media"))]),
        row,
      );
      picker.onchange = () => {
        item.url = picker.value;
        url.value = picker.value;
        sync();
      };
      const file = label("Upload image or video", input("", "file"), row);
      file.accept = "image/*,video/mp4,video/webm";
      row.append(
        button("Upload", async () => {
          if (!file.files[0]) throw new Error("Choose a file.");
          const payload = new FormData();
          payload.append("file", file.files[0]);
          const response = await fetch("/admin/schema-api/upload", {
            method: "POST",
            headers: { "X-CSRF-Token": root.dataset.csrf },
            body: payload,
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          item.url = result.url;
          url.value = result.url;
          sync();
        }),
      );
    }
    function render() {
      rows.replaceChildren();
      let dragged;
      for (const [key, value] of Object.entries(data)) {
        const row = node("div", undefined, { class: "collection-item" });
        rows.append(row);
        if (isArray) {
          row.draggable = true;
          row.ondragstart = (event) => {
            dragged = Number(key);
            event.stopPropagation();
            event.dataTransfer.setData("text/plain", key);
          };
          row.ondragover = (event) => event.preventDefault();
          row.ondrop = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (dragged === undefined || dragged === Number(key)) return;
            const item = data.splice(dragged, 1)[0];
            data.splice(Number(key), 0, item);
            render();
            sync();
          };
        }
        if (media) {
          const type = label(
            "Type",
            select(
              (field.items?.properties?.type?.enum || []).map((value) => [
                value,
                human(value),
              ]),
              value.type,
            ),
            row,
          );
          const url = label("URL", input(value.url), row);
          const caption = label("Caption", input(value.caption), row);
          type.onchange = () => {
            value.type = type.value;
            sync();
          };
          url.oninput = () => {
            value.url = url.value;
            sync();
          };
          caption.oninput = () => {
            value.caption = caption.value;
            sync();
          };
          const preview = node(
            value.type === "video" ? "video" : "img",
            undefined,
            { class: "collection-media-preview" },
          );
          if (/^(https?:\/\/|\/(uploads|images)\/)/.test(value.url || ""))
            preview.src = value.url;
          if (value.type === "video") preview.controls = true;
          else preview.alt = value.caption || "Media preview";
          row.append(preview);
          row.addEventListener("input", () => {
            if (/^(https?:\/\/|\/(uploads|images)\/)/.test(value.url || ""))
              preview.src = value.url;
            else preview.removeAttribute("src");
          });
          attachPicker(row, value, url).catch(report);
        } else
          label(
            isArray ? `Item ${Number(key) + 1}` : human(key),
            scalar(value, (v) => {
              data[key] = v;
              sync();
            }),
            row,
          );
        const actions = node("div", undefined, {
          class: "collection-item-actions",
        });
        if (isArray)
          for (const [caption, delta] of [
            ["Move up", -1],
            ["Move down", 1],
          ]) {
            const move = button(caption, () => {
              const index = Number(key),
                target = index + delta;
              if (target < 0 || target >= data.length) return;
              [data[index], data[target]] = [data[target], data[index]];
              render();
              sync();
            });
            move.disabled =
              Number(key) + delta < 0 || Number(key) + delta >= data.length;
            actions.append(move);
          }
        actions.append(
          button("Remove", () => {
            isArray ? data.splice(Number(key), 1) : delete data[key];
            render();
            sync();
          }),
        );
        row.append(actions);
      }
      if (!Object.keys(data).length)
        rows.append(node("p", media ? "No media added." : "No items added."));
    }
    const key = !isArray ? label("New property", input(), section) : null;
    const valueType =
      !media && !field.itemTemplate
        ? label(
            "New item type",
            select([
              ["string", "Text"],
              ["number", "Number"],
              ["boolean", "Checkbox"],
              ["object", "Object"],
              ["array", "List"],
            ]),
            section,
          )
        : null;
    const newValue = () =>
      ({ string: "", number: 0, boolean: false, object: {}, array: [] })[
        valueType?.value || "string"
      ];
    section.append(
      button(media ? "Add image or video" : "Add item", () => {
        if (isArray)
          data.push(structuredClone(field.itemTemplate ?? newValue()));
        else {
          if (
            !key.value ||
            ["__proto__", "prototype", "constructor"].includes(key.value)
          )
            throw new Error("Enter a valid property name.");
          if (Object.hasOwn(data, key.value))
            throw new Error("That property already exists.");
          data[key.value] = newValue();
          key.value = "";
        }
        render();
        sync();
      }),
    );
    parent.append(section);
    render();
    sync();
    return hidden;
  }

  async function recordForm(def, id, readonly = false, unsaved) {
    const record =
      unsaved ||
      (id ? await api("record", undefined, { collection: def.id, id }) : {});
    workspace.replaceChildren();
    const panel = card();
    const heading = document.querySelector(".admin-heading h1");
    if (heading)
      heading.textContent = `${readonly ? "View" : id ? "Edit" : "Add"} ${def.singularLabel || def.label}`;
    panel.append(button(`Back to ${def.label}`, () => recordsHome(def.id)));
    if (def.id === "pages" && id)
      panel.append(
        node("a", "Open page layout editor", {
          href: `/admin/page-design/${encodeURIComponent(id)}`,
          class: "btn",
        }),
      );
    const form = node("form", undefined, { class: "admin-form" });
    panel.append(form);
    const controls = new Map(),
      errors = new Map(),
      groups = new Map();
    for (const field of def.fields) {
      let fieldParent = form;
      if (field.group) {
        if (!groups.has(field.group)) {
          const group = node("fieldset", undefined, {
            class: "collection-structured",
          });
          group.append(node("legend", field.group));
          form.append(group);
          groups.set(field.group, group);
        }
        fieldParent = groups.get(field.group);
      }
      let value = record[field.name] ?? field.default;
      if (field.control === "hidden") continue;
      if (readonly) {
        const section = node("div");
        section.append(node("strong", field.label), node("p", display(value)));
        fieldParent.append(section);
        continue;
      }
      let control;
      if (field.type === "boolean") {
        control = input("", "checkbox");
        control.checked = value === true;
      } else if (field.type === "array" && field.options?.length) {
        control = input(JSON.stringify(value || []), "hidden");
        const choices = node("details", undefined, {
          class: "collection-multiselect",
        });
        const summary = node("summary");
        const selected = new Set(value || []);
        const update = () => {
          control.value = JSON.stringify([...selected]);
          summary.textContent = selected.size
            ? [...selected].join(", ")
            : "Choose…";
        };
        choices.append(summary);
        for (const option of field.options) {
          const checkbox = check(option, selected.has(option), choices);
          checkbox.onchange = () => {
            checkbox.checked ? selected.add(option) : selected.delete(option);
            update();
          };
        }
        update();
        label(field.label, choices, fieldParent);
      } else if (field.type === "array" || field.type === "object") {
        control = structuredControl(field, value, fieldParent);
      } else if (field.type === "enum" || field.control === "select")
        control = select([["", "Choose…"], ...(field.options || [])], value);
      else if (field.type === "relationship" || field.control === "reference") {
        control = select([]);
        if (
          field.type === "relationship" &&
          !["one-to-one", "many-to-one"].includes(field.cardinality)
        )
          control.multiple = true;
        else control.append(node("option", "Choose…", { value: "" }));
        const selected = new Set([value].flat().filter(Boolean));
        selected.forEach((id) => {
          const option = node("option", id, { value: id });
          option.selected = true;
          control.append(option);
        });
        label(field.label, control, fieldParent);
        const searchPanel = node("details", undefined, {
          class: "relationship-search",
        });
        searchPanel.append(node("summary", "Find more options"));
        fieldParent.append(searchPanel);
        const find = label(
          `Find ${field.label}`,
          input("", "search"),
          searchPanel,
        );
        let relationshipPage = 1;
        async function loadOptions(reset = false) {
          if (reset) relationshipPage = 1;
          const result = await api("records", undefined, {
            collection: field.target,
            optionRule: field.optionRule || "",
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
        searchPanel.append(
          button("Search related records", () => loadOptions(true)),
          more,
        );
        await loadOptions();
        for (const id of selected) {
          const option = [...control.options].find((o) => o.value === id);
          if (option?.textContent === id) {
            try {
              const row = await api("record", undefined, {
                collection: field.target,
                id,
              });
              option.textContent = row.title || row.name || row.position || id;
            } catch {
              /* Legacy snapshot references can outlive their source. */
            }
          }
        }
        if (control.multiple) {
          control.parentElement.hidden = true;
          const choices = node("details", undefined, {
            class: "collection-multiselect",
          });
          const summary = node("summary"),
            list = node("div");
          choices.append(summary, list);
          const updateChoices = () => {
            list.replaceChildren();
            summary.textContent =
              [...control.selectedOptions]
                .map((o) => o.textContent)
                .join(", ") || "Choose…";
            for (const option of control.options) {
              const checkbox = check(option.textContent, option.selected, list);
              checkbox.onchange = () => {
                option.selected = checkbox.checked;
                updateChoices();
              };
            }
          };
          new MutationObserver(updateChoices).observe(control, {
            childList: true,
            subtree: true,
            characterData: true,
          });
          updateChoices();
          label(field.label, choices, fieldParent);
        }
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
      if (control.type === "hidden") form.append(control);
      else if (!control.parentElement)
        label(
          `${field.label}${field.required ? " *" : ""}`,
          control,
          fieldParent,
        );
      if (field.type === "richtext") {
        const editor = node("div", undefined, {
          contenteditable: "true",
          role: "textbox",
          "aria-label": `${field.label} rich text`,
          class: "source-editor",
        });
        // Only server-sanitized rich text is inserted here.
        if (unsaved) editor.textContent = value || "";
        else editor.innerHTML = value || "";
        editor.oninput = () => {
          control.value = editor.innerHTML;
        };
        control.oninput = () => {
          editor.textContent = control.value;
        };
        control.parentElement.hidden = true;
        label(field.label, editor, fieldParent);
        for (const command of ["bold", "italic", "insertUnorderedList"])
          fieldParent.append(
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
          fieldParent,
        );
        picker.onchange = () => {
          control.value = picker.value;
        };
        const upload = label(
          "Upload image or video",
          input("", "file"),
          fieldParent,
        );
        upload.accept = "image/*,video/mp4,video/webm";
        fieldParent.append(
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

      const error = node("p", "", {
        role: "alert",
        class: "field-error",
        "data-field-error": field.name,
      });
      fieldParent.append(error);
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
          const control = controls.get(field.name);
          if (!control) {
            if (record[field.name] !== undefined)
              values[field.name] = record[field.name];
            continue;
          }
          const raw = control.value;
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
          else if (!["number", "date"].includes(field.type))
            values[field.name] = "";
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
      notice("");
      if (root.dataset.mode === "schema") schemaHome();
      else if (root.dataset.mode === "views") viewsHome();
      else {
        if (root.dataset.hasErrors === "true") {
          const definition = catalog.definitions.find(
            (d) => d.id === root.dataset.initialCollection,
          );
          const values = JSON.parse(
            root.querySelector("[data-unsaved]").textContent,
          );
          recordForm(
            definition,
            root.dataset.record || undefined,
            false,
            values,
          )
            .then(() => {
              notice(
                "Your unsaved values are preserved. Correct the errors and save again.",
              );
              const errors = JSON.parse(
                root.querySelector("[data-unsaved-errors]").textContent,
              );
              for (const [name, text] of Object.entries(errors)) {
                const error = [
                  ...workspace.querySelectorAll("[data-field-error]"),
                ].find((el) => el.dataset.fieldError === name);
                if (error) error.textContent = text;
              }
            })
            .catch(report);
          return;
        }
        const definition = catalog.definitions.find(
          (d) => d.id === root.dataset.initialCollection,
        );
        if (definition && (root.dataset.record || root.dataset.new === "true"))
          recordForm(definition, root.dataset.record || undefined).catch(
            report,
          );
        else
          recordsHome(root.dataset.initialCollection || undefined).catch(
            report,
          );
      }
    })
    .catch(report);
})();
