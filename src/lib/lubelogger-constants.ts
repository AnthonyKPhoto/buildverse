export const LL_RECORD_TYPES = [
  { key: "servicerecords", label: "Service Records",  path: "/servicerecords" },
  { key: "oilchanges",     label: "Oil Changes",      path: "/oilchanges" },
  { key: "repairs",        label: "Repairs",          path: "/repairs" },
  { key: "tirerecords",    label: "Tire Records",     path: "/tirerecords" },
] as const;

export type LLRecordType = typeof LL_RECORD_TYPES[number]["key"];
