import type { SVGProps } from "react";

/**
 * Third-party brand marks, vendored as static SVG files.
 *
 * These are trademarks owned by their projects — they are NOT part of the
 * in-house icon system (see `docs/design/design.md`) and must not be
 * restyled to match it. They are vendored rather than fetched at runtime so
 * the app has no icon dependency at all.
 *
 * Source: Simple Icons (CC0) and the svglogos collection.
 */

import AiSdkSvg from "../assets/brands/logos-vercel-ai-sdk.svg?react";
import HeroUiSvg from "../assets/brands/simple-icons-heroui.svg?react";
import PostgresqlSvg from "../assets/brands/logos-postgresql.svg?react";
import PrismaSvg from "../assets/brands/simple-icons-prisma.svg?react";
import ReactSvg from "../assets/brands/logos-react.svg?react";
import TauriSvg from "../assets/brands/simple-icons-tauri.svg?react";
import ThreejsSvg from "../assets/brands/logos-threejs.svg?react";
import TailwindSvg from "../assets/brands/logos-tailwindcss-icon.svg?react";
import TrpcSvg from "../assets/brands/logos-trpc.svg?react";
import TypescriptSvg from "../assets/brands/logos-typescript-icon.svg?react";

const BRANDS = {
  "ai-sdk": AiSdkSvg,
  heroui: HeroUiSvg,
  postgresql: PostgresqlSvg,
  prisma: PrismaSvg,
  react: ReactSvg,
  tauri: TauriSvg,
  tailwind: TailwindSvg,
  threejs: ThreejsSvg,
  trpc: TrpcSvg,
  typescript: TypescriptSvg,
} as const;

export type BrandName = keyof typeof BRANDS;

interface BrandIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: BrandName;
  size?: number;
}

export function BrandIcon({ name, size = 16, ...props }: BrandIconProps) {
  const Mark = BRANDS[name];
  return <Mark width={size} height={size} {...props} />;
}
