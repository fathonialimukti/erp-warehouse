export const CAMPUS = {
  company: "Nexus Electronics BV",
  campusName: "Rotterdam Eemhaven Campus",
  addressBase: "Eemhavenweg 40, 3089 KA Rotterdam",
  country: "NL",
};

export const WAREHOUSE_CAPACITY: Record<string, number> = {
  WH01: 264, // Raw Material Hub
  WH02: 108, // Production Buffer (returns/quality/e-waste)
  WH03: 324, // Finished Goods DC
};

export const SEED_KEYS = {
  plan: "nexus.plan.v1",
  receipt: "nexus.receipt.v1",
  shipment: "nexus.shipment.v1",
  internal: "nexus.internal.v1",
} as const;