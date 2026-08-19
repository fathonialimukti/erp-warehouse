import type { SkuType } from "../../../prisma/generated/client.js";

export interface SkuRow {
  code: string; name: string; type: SkuType; baseUnit: string;
  packageName: string; packagesPerPallet: number; quantityPerPackage: number;
  packageUnit: string; length: number; width: number; height: number; maxWeight: number;
  standardCost?: number;
}

export const RAW_SKUS: SkuRow[] = [
  { code: "RAW-PCM", name: "PCM/SoC module (AGX)", type: "RAW_MATERIAL", baseUnit: "pcs", packageName: "carton", packagesPerPallet: 48, quantityPerPackage: 100, packageUnit: "pcs", length: 1200, width: 1000, height: 1400, maxWeight: 600 },
  { code: "RAW-BATT", name: "Li-Ion pack 2500mAh", type: "RAW_MATERIAL", baseUnit: "pcs", packageName: "brick", packagesPerPallet: 60, quantityPerPackage: 50, packageUnit: "pcs", length: 1200, width: 1000, height: 1200, maxWeight: 400 },
  { code: "RAW-DISP", name: "6.5\" TFT display", type: "RAW_MATERIAL", baseUnit: "pcs", packageName: "carton", packagesPerPallet: 30, quantityPerPackage: 20, packageUnit: "pcs", length: 1200, width: 1000, height: 1500, maxWeight: 500 },
  { code: "RAW-CHG", name: "USB-C charger 18W", type: "RAW_MATERIAL", baseUnit: "pcs", packageName: "crate", packagesPerPallet: 54, quantityPerPackage: 40, packageUnit: "pcs", length: 1200, width: 1000, height: 1300, maxWeight: 450 },
  { code: "RAW-PCB", name: "Main PCB module", type: "RAW_MATERIAL", baseUnit: "pcs", packageName: "carton", packagesPerPallet: 48, quantityPerPackage: 60, packageUnit: "pcs", length: 1200, width: 1000, height: 1400, maxWeight: 380 },
  { code: "RAW-PLASTIC", name: "ABS housing set", type: "RAW_MATERIAL", baseUnit: "pcs", packageName: "sack", packagesPerPallet: 36, quantityPerPackage: 80, packageUnit: "pcs", length: 1200, width: 1000, height: 1600, maxWeight: 430 },
  { code: "RAW-CABLE", name: "Flex cable 40p", type: "RAW_MATERIAL", baseUnit: "pcs", packageName: "drum", packagesPerPallet: 72, quantityPerPackage: 100, packageUnit: "pcs", length: 1200, width: 1000, height: 1100, maxWeight: 250 },
  { code: "RAW-DRIVER", name: "Speaker driver 40mm", type: "RAW_MATERIAL", baseUnit: "pcs", packageName: "carton", packagesPerPallet: 30, quantityPerPackage: 25, packageUnit: "pcs", length: 1200, width: 1000, height: 1500, maxWeight: 320 },
  { code: "RAW-CARTON", name: "Retail carton (white)", type: "PACKAGING_MATERIAL", baseUnit: "pcs", packageName: "bundle", packagesPerPallet: 40, quantityPerPackage: 50, packageUnit: "pcs", length: 1200, width: 1000, height: 1600, maxWeight: 300 },
];

export const FG_SKUS: SkuRow[] = [
  { code: "FG-SPRK-MINI", name: "Nexus Spark Mini speaker", type: "FINISHED_GOOD", baseUnit: "pcs", packageName: "carton", packagesPerPallet: 60, quantityPerPackage: 12, packageUnit: "pcs", length: 1200, width: 1000, height: 1200, maxWeight: 400 },
  { code: "FG-SPRK-PRO", name: "Nexus Spark Pro speaker", type: "FINISHED_GOOD", baseUnit: "pcs", packageName: "carton", packagesPerPallet: 30, quantityPerPackage: 8, packageUnit: "pcs", length: 1200, width: 1000, height: 1400, maxWeight: 350 },
  { code: "FG-EARB-AIR", name: "Nexus AirBuds ANC", type: "FINISHED_GOOD", baseUnit: "pcs", packageName: "carton", packagesPerPallet: 48, quantityPerPackage: 20, packageUnit: "pcs", length: 1200, width: 1000, height: 1300, maxWeight: 200 },
  { code: "FG-EARB-SPORT", name: "Nexus SportBuds", type: "FINISHED_GOOD", baseUnit: "pcs", packageName: "carton", packagesPerPallet: 48, quantityPerPackage: 20, packageUnit: "pcs", length: 1200, width: 1000, height: 1300, maxWeight: 200 },
  { code: "FG-HUB-HOME", name: "Nexus SmartHub 8\"", type: "FINISHED_GOOD", baseUnit: "pcs", packageName: "carton", packagesPerPallet: 20, quantityPerPackage: 4, packageUnit: "pcs", length: 1200, width: 1000, height: 1600, maxWeight: 300 },
  { code: "FG-CHG-GA", name: "Nexus GaN 65W charger", type: "FINISHED_GOOD", baseUnit: "pcs", packageName: "carton", packagesPerPallet: 60, quantityPerPackage: 40, packageUnit: "pcs", length: 1200, width: 1000, height: 1200, maxWeight: 280 },
];

export function allSkuRows(): SkuRow[] { return [...RAW_SKUS, ...FG_SKUS]; }