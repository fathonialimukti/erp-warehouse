export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Manajer Bisnis",
  description:
    "Sistem manajemen bisnis komprehensif untuk melacak penjualan, inventori, dan keuangan.",
  navItems: [
    {
      label: "Dasbor",
      href: "/",
    },
    {
      label: "Pelanggan",
      href: "/customer",
    },
    {
      label: "Produk",
      href: "/produk",
    },
    {
      label: "Departemen",
      href: "/departemen",
    },
    {
      label: "Faktur",
      href: "/invoices",
    },
    {
      label: "Penerimaan Bahan",
      href: "/penerimaan-bahan",
    },
  ],
  navMenuItems: [
    {
      label: "Dasbor",
      href: "/",
    },
    {
      label: "Pelanggan",
      href: "/customer",
    },
    {
      label: "Produk",
      href: "/produk",
    },
    {
      label: "Departemen",
      href: "/departemen",
    },
    {
      label: "Faktur",
      href: "/invoices",
    },
    {
      label: "Penerimaan Bahan",
      href: "/penerimaan-bahan",
    },
  ],
  links: {
    github: "https://github.com/heroui-inc/heroui",
    twitter: "https://twitter.com/hero_ui",
    docs: "https://heroui.com",
    discord: "https://discord.gg/9b6yyZKmH4",
    sponsor: "https://patreon.com/jrgarciadev",
  },
};
