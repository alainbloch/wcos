/** Presentation defaults are metadata: every collection uses the same renderers. */
export const humanLabel = (value) =>
  String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
const ranks = ["L7", "L6", "L5", "L4", "L3", "L2", "L1"];
const presets = {
  moves: {
    label: "Moves",
    singularLabel: "Move",
    description: "Manage techniques, instructions, and training media.",
    orderField: "order",
    columns: ["name", "core", "types"],
    fields: {
      name: {},
      category: {},
      types: {
        label: "Move types",
        control: "multiselect",
        options: [
          "Straight Offense",
          "Offensive Defense",
          "Initiated Response",
        ],
      },
      creatorId: { label: "Creator" },
      core: { label: "Core move" },
      description: {},
      details: { label: "Details / instructions" },
      media: { label: "Images and videos", control: "media-list" },
      order: { control: "hidden" },
    },
  },
  members: {
    label: "Members",
    singularLabel: "Member",
    columns: ["position", "level", "steelRank", "active"],
    fields: {
      position: { label: "Circle name" },
      level: { control: "select", options: ranks },
      steelRank: { control: "select", options: ranks },
      circleName: { label: "Rank display", control: "hidden" },
      biography: {},
      image: { label: "Profile image" },
      active: {},
      region: {},
      merits: { label: "Titles and merits" },
      championships: {
        itemTemplate: { year: 2026, note: "" },
        group: "Honors",
      },
      fallenHero: { group: "Honors" },
      councilCurrent: { label: "Current council member", group: "Council" },
      councilPosition: { group: "Council" },
      councilTitle: { group: "Council" },
      councilTermStart: { group: "Council" },
      councilTermEnd: { group: "Council" },
      councilHistoricalDate: { group: "Council" },
      councilHistory: {
        group: "Council",
        itemTemplate: { position: "", start: "", end: "" },
      },
      dalmaterMode: {
        label: "Dalmater color",
        control: "select",
        options: ["kaiden", "custom"],
        group: "Dalmater",
      },
      dalmaterKaidenId: { label: "Kaiden", group: "Dalmater" },
      dalmaterColorName: { label: "Color name", group: "Dalmater" },
      dalmaterColorHex: { label: "Hex color", group: "Dalmater" },
    },
  },
  classes: {
    label: "Classes",
    singularLabel: "Class",
    columns: ["name", "location", "schedule", "active"],
    fields: { instructorIds: { label: "Instructors" } },
  },
  glossary: {
    label: "Glossary",
    singularLabel: "Term",
    columns: ["name", "definition"],
    fields: {},
  },
  updates: {
    label: "Updates",
    singularLabel: "Update",
    columns: ["title", "category", "dateLabel"],
    fields: {
      category: { control: "select", options: ["general", "council", "news"] },
      body: { label: "Content" },
      dateLabel: { control: "hidden" },
    },
  },
  pages: {
    label: "Pages",
    singularLabel: "Page",
    columns: ["title", "slug", "published"],
    fields: {
      parentSlug: { label: "Parent page" },
      content: { label: "Page HTML", group: "Page content" },
      dataSources: { group: "Page content" },
      dataView: { group: "Page content" },
      styleOverrides: { group: "Page content" },
    },
  },
};
export function withPresentation(definition) {
  const preset = presets[definition.id];
  const legacy = !definition.presentationVersion;
  const fields = definition.fields.map((field) => {
    const defaults = legacy ? preset?.fields[field.name] || {} : {};
    return {
      ...defaults,
      ...field,
      label:
        field.label && field.label !== field.name
          ? field.label
          : defaults.label || humanLabel(field.name),
      control: field.control || defaults.control,
      options: field.options || defaults.options,
    };
  });
  if (legacy && preset?.fields && definition.legacy) {
    const order = Object.keys(preset.fields);
    fields.sort(
      (a, b) =>
        (order.includes(a.name) ? order.indexOf(a.name) : 100) -
        (order.includes(b.name) ? order.indexOf(b.name) : 100),
    );
  }
  return {
    ...definition,
    label:
      definition.label === definition.id
        ? preset?.label || humanLabel(definition.id)
        : definition.label,
    singularLabel:
      definition.singularLabel || preset?.singularLabel || definition.label,
    description: definition.description || preset?.description || "",
    orderField:
      definition.orderField || (legacy ? preset?.orderField : undefined),
    columns: definition.legacy && preset ? preset.columns : definition.columns,
    fields,
  };
}
