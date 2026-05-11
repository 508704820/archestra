import type { archestraApiTypes } from "@shared";

export type CatalogItem =
  archestraApiTypes.GetInternalMcpCatalogResponses["200"][number];

export type FieldScope = "static" | "preset" | "user";

export function fieldScope(field: {
  promptOnInstallation?: boolean;
  promptOnPreset?: boolean;
}): FieldScope {
  if (field.promptOnInstallation) return "user";
  if (field.promptOnPreset) return "preset";
  return "static";
}

export type CatalogFieldEntry = {
  key: string;
  origin: "userConfig" | "envVar";
  scope: FieldScope;
  required: boolean;
  description?: string;
  staticValue?: string | number | boolean | string[];
};

export function listCatalogFields(cat: CatalogItem): CatalogFieldEntry[] {
  const entries: CatalogFieldEntry[] = [];
  for (const [key, field] of Object.entries(cat.userConfig ?? {})) {
    entries.push({
      key,
      origin: "userConfig",
      scope: fieldScope(field),
      required: field.required ?? false,
      description: field.description,
      staticValue: field.default,
    });
  }
  for (const env of cat.localConfig?.environment ?? []) {
    entries.push({
      key: env.key,
      origin: "envVar",
      scope: fieldScope(env),
      required: env.required ?? false,
      description: env.description,
      staticValue: env.value ?? env.default,
    });
  }
  return entries;
}

export function presetFieldKeys(cat: CatalogItem): string[] {
  return listCatalogFields(cat)
    .filter((f) => f.scope === "preset")
    .map((f) => f.key);
}
