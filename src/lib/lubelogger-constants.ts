export const LL_RECORD_TYPES = [
  { key: "servicerecords", label: "Service Records", path: "/servicerecords" },
  { key: "oilchanges",     label: "Oil Changes",     path: "/oilchangerecords" },
  { key: "repairs",        label: "Repairs",         path: "/repairrecords" },
  { key: "tirerecords",    label: "Tire Records",    path: "/tirechangerecords" },
] as const;

export type LLRecordType = typeof LL_RECORD_TYPES[number]["key"];
