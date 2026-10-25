// Import the two source HTML files into seed records and CMS templates.
// Usage: node scripts/extract-updates.mjs general.html council.html
import fs from "node:fs";
import { load } from "cheerio";
import { createHash } from "node:crypto";
const [generalPath, councilPath] = process.argv.slice(2);
if (!generalPath || !councilPath)
  throw new Error("Provide general and council HTML paths");
const records = [];
function record(label, body, category) {
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const parts = label.trim().match(/^(\w+)\s+(?:(\d{1,2}),?\s+)?(\d{4})$/);
  if (!parts || !months.includes(parts[1].slice(0, 3).toLowerCase()))
    throw new Error(`Unrecognized date: ${label}`);
  const date = `${parts[3]}-${String(months.indexOf(parts[1].slice(0, 3).toLowerCase()) + 1).padStart(2, "0")}${parts[2] ? "-" + parts[2].padStart(2, "0") : ""}`;
  records.push({
    sourceKey: createHash("sha256")
      .update(category + "|" + label + "|" + body)
      .digest("hex"),
    title: "",
    date,
    dateLabel: label.trim(),
    category,
    body: body.trim(),
  });
}
let general = fs.readFileSync(generalPath, "utf8");
let $ = load(general, { sourceCodeLocationInfo: true });
const headings = $("h4").toArray();
for (const heading of headings) {
  const nodes = $(heading).nextUntil("h4").not("hr").toArray();
  record(
    $(heading).text(),
    nodes.map((node) => $.html(node)).join(""),
    "general",
  );
}
const parent = $(headings[0]).parent()[0].sourceCodeLocation;
const generalLoop = `{% for update in generalUpdates %}\n<h4>{{ update.dateLabel }}{% if update.title %} — {{ update.title }}{% endif %}</h4>\n{{ update.body | safe }}\n{% if not loop.last %}<hr style="border: 0; border-top: 1px solid #383838; width: 100%;">{% endif %}\n{% else %}<p>No updates yet.</p>{% endfor %}`;
general =
  general.slice(0, parent.startTag.endOffset) +
  generalLoop +
  general.slice(parent.endTag.startOffset);
fs.writeFileSync("docs/cms/updates.html", general);
let council = fs.readFileSync(councilPath, "utf8");
$ = load(council, { sourceCodeLocationInfo: true });
const details = $("details").toArray();
const widgets = details.map((node) => $(node).closest(".elementor-widget")[0]);
for (const node of details)
  record(
    $(node).find("summary .title").text(),
    $(node).find(".card-body").html(),
    "council",
  );
const first = widgets[0].sourceCodeLocation;
let widget = council.slice(first.startOffset, first.endOffset);
const w = load(widget, null, false);
w("summary .title").text("UPDATE_TITLE_TOKEN");
w(".card-body").html("UPDATE_BODY_TOKEN");
widget = w
  .html()
  .replace(
    "UPDATE_TITLE_TOKEN",
    "{{ update.dateLabel }}{% if update.title %} — {{ update.title }}{% endif %}",
  )
  .replace("UPDATE_BODY_TOKEN", "{{ update.body | safe }}");
const replacements = widgets.map((node, i) => ({
  ...node.sourceCodeLocation,
  text:
    i === 0
      ? `{% for update in councilUpdates %}\n${widget}\n{% else %}<p>No council updates yet.</p>{% endfor %}`
      : "",
}));
for (const r of replacements.reverse())
  council =
    council.slice(0, r.startOffset) + r.text + council.slice(r.endOffset);
fs.writeFileSync("docs/cms/wcos-council-updates.html", council);
fs.writeFileSync(
  "src/content/updates.json",
  JSON.stringify(records, null, 2) + "\n",
);
console.log(`Extracted ${records.length} updates; generated both templates.`);
