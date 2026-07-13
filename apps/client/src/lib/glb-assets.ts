const glbModules = import.meta.glob('../assets/glb/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function toAssetKey(path: string) {
  const filename = path.split('/').pop() ?? '';
  return filename.replace(/\.glb$/i, '');
}

export const GLB_ASSET_URLS = Object.entries(glbModules).reduce<Record<string, string>>(
  (acc, [path, url]) => {
    acc[toAssetKey(path)] = url;
    return acc;
  },
  {},
);

export const ALL_GLB_ASSET_KEYS = Object.keys(GLB_ASSET_URLS).sort();

/** Compile-time union of all known GLB asset keys, derived from the glob map. */
export type GlbAssetKey = keyof typeof GLB_ASSET_URLS;

export function getGlbAssetUrl(assetKey: string) {
  return GLB_ASSET_URLS[assetKey];
}
