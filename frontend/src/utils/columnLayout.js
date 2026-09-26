export const columnIdsKey = (definitions = []) => JSON.stringify(
  definitions.map((column) => String(column?.id ?? "")),
);

export const columnValuesKey = (values = []) => JSON.stringify(
  Array.isArray(values) ? values.map((value) => String(value)) : [],
);
