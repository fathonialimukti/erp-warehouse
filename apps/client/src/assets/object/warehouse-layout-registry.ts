import React from 'react';
import { useGLTF } from '@react-three/drei';
import { Instances as WH01Instances, WH01 as WH01Model, WAREHOUSE_LAYOUT_URLS } from './WH01';

export interface WarehouseLayoutEntry {
  Instances: React.ComponentType<{ children?: React.ReactNode; url?: string; [key: string]: unknown }>;
  Model: React.ComponentType<React.ComponentPropsWithoutRef<'group'>>;
  url: string;
}

const REGISTRY: Record<string, WarehouseLayoutEntry> = {
  wh_01: {
    Instances: WH01Instances,
    Model: WH01Model,
    url: WAREHOUSE_LAYOUT_URLS['wh_01'] as string,
  },
};

const FALLBACK_LAYOUT = REGISTRY['wh_01'] as WarehouseLayoutEntry;

/**
 * Returns the layout entry for the given warehouse objectId.
 * Falls back to wh_01 if the objectId is not registered.
 */
export function resolveWarehouseLayout(objectId?: string | null): WarehouseLayoutEntry {
  if (!objectId) return FALLBACK_LAYOUT;
  return REGISTRY[objectId] ?? FALLBACK_LAYOUT;
}

/** Preload all registered warehouse GLB files. */
export function preloadAllWarehouseLayouts(): void {
  for (const entry of Object.values(REGISTRY)) {
    useGLTF.preload(entry.url);
  }
}
