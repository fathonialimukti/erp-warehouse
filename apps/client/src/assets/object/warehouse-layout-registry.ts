import React from "react";
import { useGLTF } from "@react-three/drei";
import {
  Instances as WH01Instances,
  WH01 as WH01Model,
  WAREHOUSE_LAYOUT_URLS as WH01_LAYOUT_URLS,
} from "./WH01";
import {
  Instances as WH02Instances,
  Model as WH02Model,
  WAREHOUSE_LAYOUT_URLS as WH02_LAYOUT_URLS,
} from "./WH02";
import {
  Instances as WH03Instances,
  Model as WH03Model,
  WAREHOUSE_LAYOUT_URLS as WH03_LAYOUT_URLS,
} from "./WH03";

export interface WarehouseLayoutEntry {
  Instances: React.ComponentType<{
    children?: React.ReactNode;
    url?: string;
    [key: string]: unknown;
  }>;
  Model: React.ComponentType<React.ComponentPropsWithoutRef<"group">>;
  url: string;
}

const REGISTRY: Record<string, WarehouseLayoutEntry> = {
  WH01: {
    Instances: WH01Instances,
    Model: WH01Model,
    url: WH01_LAYOUT_URLS["WH01"] as string,
  },
  WH02: {
    Instances: WH02Instances,
    Model: WH02Model,
    url: WH02_LAYOUT_URLS["WH02"] as string,
  },
  WH03: {
    Instances: WH03Instances,
    Model: WH03Model,
    url: WH03_LAYOUT_URLS["WH03"] as string,
  },
};

const FALLBACK_LAYOUT = REGISTRY["WH01"] as WarehouseLayoutEntry;

/**
 * Returns the layout entry for the given warehouse objectId.
 * Falls back to WH01 if the objectId is not registered.
 */
export function resolveWarehouseLayout(
  objectId?: string | null,
): WarehouseLayoutEntry {
  if (!objectId) return FALLBACK_LAYOUT;
  return REGISTRY[objectId] ?? FALLBACK_LAYOUT;
}

/** Preload all registered warehouse GLB files. */
export function preloadAllWarehouseLayouts(): void {
  for (const entry of Object.values(REGISTRY)) {
    useGLTF.preload(entry.url);
  }
}
