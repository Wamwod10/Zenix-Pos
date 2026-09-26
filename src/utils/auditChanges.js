const comparable = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
};

export const formatAuditValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ha" : "Yo‘q";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
};

export const buildFieldChanges = (before = {}, after = {}, fields = []) => fields.reduce((changes, field) => {
  const key = typeof field === "string" ? field : field.key;
  const label = typeof field === "string" ? field : (field.label || field.key);
  const previous = before?.[key];
  const next = after?.[key];
  if (comparable(previous) === comparable(next)) return changes;
  changes.push({ field:key, label, before:previous, after:next });
  return changes;
}, []);

export const normalizeActivityChanges = (changes) => {
  if (!changes) return [];
  if (Array.isArray(changes)) return changes.filter(Boolean).map((item) => ({
    field:item.field || item.key || "field",
    label:item.label || item.field || item.key || "O‘zgarish",
    before:item.before,
    after:item.after,
  }));
  if (typeof changes === "object" && ("before" in changes || "after" in changes)) return [{
    field:changes.field || "field",
    label:changes.label || changes.field || "O‘zgarish",
    before:changes.before,
    after:changes.after,
  }];
  return Object.entries(changes).map(([field, value]) => {
    if (value && typeof value === "object" && ("before" in value || "after" in value)) {
      return { field, label:value.label || field, before:value.before, after:value.after };
    }
    return { field, label:field, before:undefined, after:value };
  });
};
