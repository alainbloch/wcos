import sanitizeHtml from "sanitize-html";
import { viewService } from "./views.js";
import { collectionStore } from "./store.js";
import { assertSafe } from "./schema.js";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function normalizeBinding(input) {
  if (!input || !input.id) return null;
  assertSafe(input);
  const view = viewService.list().find((v) => v.id === input.id);
  if (!view) throw new Error("Select an existing data view.");
  if (!view.public)
    throw new Error(
      "Enable public access on the data view before binding it to a page.",
    );
  const layout = input.layout || "list",
    pagination = input.pagination || "numbered";
  if (
    !["list", "grid", "detail"].includes(layout) ||
    !["numbered", "more"].includes(pagination)
  )
    throw new Error("Invalid data view presentation.");
  return {
    id: view.id,
    layout,
    pagination,
    search: input.search === true || input.search === "on",
    sorting: input.sorting === true || input.sorting === "on",
    heading: String(input.heading || "").slice(0, 180),
    record: String(input.record || "").slice(0, 200),
  };
}
export function readBinding(body, existing = null) {
  if (Object.hasOwn(body, "viewId"))
    return normalizeBinding({
      id: body.viewId,
      layout: body.viewLayout,
      pagination: body.viewPagination,
      search: body.viewSearch,
      sorting: body.viewSorting,
      heading: body.viewHeading,
      record: body.viewRecord,
    });
  if (Object.hasOwn(body, "dataView")) return normalizeBinding(body.dataView);
  return existing;
}
export function renderDataView(binding, query = {}) {
  const config = normalizeBinding(binding);
  if (!config) return "";
  const requested = { ...query };
  // Each page has one configured component. Query controls cannot change its collection or projection.
  if (config.layout === "detail" && config.record)
    requested.record = config.record;
  if (requested.record) requested.page = 1;
  const result = viewService.run(config.id, requested, { publicOnly: true });
  const definition = collectionStore.definition(result.view.collection);
  const url = (changes) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...requested, ...changes }))
      if (value !== undefined && value !== "" && typeof value !== "object")
        params.set(key, String(value));
    return `?${escape(params.toString())}`;
  };
  let html = `<section class="data-view" data-view-component="${escape(config.id)}"><h2>${escape(config.heading || result.view.name)}</h2>`;
  if (config.search || config.sorting || result.view.parameters.length) {
    html += '<form method="get" class="data-view-controls">';
    if (config.search)
      html += `<label>Search <input type="search" name="q" value="${escape(query.q)}"></label>`;
    if (config.sorting)
      html += `<label>Sort <select name="sort"><option value="">Default order</option>${result.view.fields.map((f) => `<option value="${escape(f)}"${query.sort === f ? " selected" : ""}>${escape(f)}</option>`).join("")}</select></label><label>Direction <select name="direction"><option value="asc">Ascending</option><option value="desc"${query.direction === "desc" ? " selected" : ""}>Descending</option></select></label>`;
    for (const param of result.view.parameters)
      html += `<label>${escape(param.name)} <input name="${escape(param.name)}" value="${escape(query[param.name] ?? param.default)}"${param.required ? " required" : ""}></label>`;
    html += '<button type="submit">Apply</button></form>';
  }
  html += `<div class="data-view-records data-view-${config.layout}">`;
  const detail = config.layout === "detail" || requested.record;
  const records = detail ? result.records.slice(0, 1) : result.records;
  for (const record of records) {
    html += `<article class="data-view-record" data-record-id="${escape(record.id)}">`;
    for (const key of result.view.fields) {
      const [baseField, childField] = key.split(".");
      const relation = definition.fields.find((f) => f.name === baseField);
      const field =
          childField && relation?.target
            ? collectionStore
                .definition(relation.target)
                .fields.find((f) => f.name === childField)
            : relation,
        value = record[key];
      if (value === undefined || value === null) continue;
      html += `<div class="data-view-field"><strong>${escape(field?.label || key)}</strong>`;
      if (field?.type === "richtext") html += sanitizeHtml(String(value));
      else if (field?.type === "media") {
        for (const media of [value].flat()) {
          if (
            typeof media !== "string" ||
            !/^(https?:\/\/|\/(uploads|images)\/)/.test(media)
          )
            continue;
          if (/\.(mp4|webm)(\?|$)/i.test(media))
            html += `<video src="${escape(media)}" controls preload="metadata"></video>`;
          else
            html += `<img src="${escape(media)}" alt="${escape(field.label)}" loading="lazy">`;
        }
      } else
        html += `<p>${escape(typeof value === "object" ? JSON.stringify(value) : value)}</p>`;
      html += "</div>";
    }
    if (!detail)
      html += `<a href="${url({ record: record.id, page: 1 })}">View details</a>`;
    html += "</article>";
  }
  html += "</div>";
  if (!records.length) html += "<p>No records found.</p>";
  if (detail)
    html += `<a href="${url({ record: "", page: 1 })}">Back to list</a>`;
  else if (result.pages > 1) {
    html += '<nav aria-label="Record pages" class="data-view-pagination">';
    if (config.pagination === "more") {
      if (result.page < result.pages)
        html += `<a data-view-more href="${url({ page: result.page + 1 })}">Load More</a>`;
    } else {
      if (result.page > 1)
        html += `<a href="${url({ page: result.page - 1 })}">Previous</a>`;
      const start = Math.max(1, result.page - 3),
        end = Math.min(result.pages, result.page + 3);
      if (start > 1)
        html += `<a href="${url({ page: 1 })}">1</a><span>…</span>`;
      for (let page = start; page <= end; page++)
        html += `<a href="${url({ page })}"${page === result.page ? ' aria-current="page"' : ""}>${page}</a>`;
      if (end < result.pages)
        html += `<span>…</span><a href="${url({ page: result.pages })}">${result.pages}</a>`;
      if (result.page < result.pages)
        html += `<a href="${url({ page: result.page + 1 })}">Next</a>`;
    }
    html += "</nav>";
  }
  return html + "</section>";
}
