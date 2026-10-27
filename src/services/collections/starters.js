import { collectionStore } from "./store.js";
import { normalizeView } from "./views.js";
/** Explicit, idempotent opt-in migration: no records or existing page bindings are rewritten. */
export async function installStarterViews() {
  return collectionStore.mutate((data) => {
    const common = {
      collection: "members",
      fields: ["position", "level", "region"],
      pageSize: 20,
      public: true,
    };
    const term = (field) => ({ field, operator: "exists", value: true });
    const council = {
      logic: "or",
      conditions: [
        { field: "councilCurrent", operator: "eq", value: true },
        ...["councilTermStart", "councilTermEnd", "councilHistoricalDate"].map(
          term,
        ),
      ],
    };
    const definitions = [
      { ...common, id: "all-members", name: "All Members" },
      {
        ...common,
        id: "current-council",
        name: "Current Council Members",
        filters: { field: "councilCurrent", operator: "eq", value: true },
      },
      {
        ...common,
        id: "former-council",
        name: "Former Council Members",
        filters: {
          logic: "and",
          conditions: [
            council,
            { field: "councilCurrent", operator: "ne", value: true },
          ],
        },
      },
      {
        ...common,
        id: "members-by-rank",
        name: "Members by Rank",
        sort: [{ field: "level", direction: "desc" }],
        filters: {
          field: "level",
          operator: "in",
          value: ["L1", "L2", "L3", "L4", "L5", "L6", "L7"],
        },
      },
      ...["general", "council", "news"].map((category) => ({
        id: `${category}-updates`,
        name: `${category} updates`,
        collection: "updates",
        fields: ["date", "body"],
        public: true,
        sort: [{ field: "date", direction: "desc" }],
        filters: { field: "category", operator: "eq", value: category },
      })),
    ];
    for (const view of definitions)
      if (!data.dynamic.views.some((v) => v.id === view.id))
        data.dynamic.views.push(normalizeView(data, view));
    return { success: true };
  });
}
