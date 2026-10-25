import { layoutDefaults } from "../../services/layoutService.js";

export async function migrateEditableLayout(data) {
  if (!Array.isArray(data.siteSettings))
    data.siteSettings = [{ id: "siteSettings", ...data.siteSettings }];
  if (!data.siteSettings.length) data.siteSettings.push({ id: "siteSettings" });
  data.siteSettings[0].referenceLayout = {
    ...(await layoutDefaults()),
    ...data.siteSettings[0].referenceLayout,
  };
  delete data.navigation;
  for (const page of data.pages || []) {
    if (Array.isArray(page.dataSources))
      page.dataSources = page.dataSources.filter(
        (source) => source !== "navigation",
      );
  }
  data.migrations ||= {};
  data.migrations.editableLayout = true;
}
