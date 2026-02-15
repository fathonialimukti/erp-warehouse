import {
  LayoutDashboard,
  Package,
  FileText,
  Users,
  Building2,
  PackageCheck,
  LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const navigationItems: NavigationItem[] = [
  {
    label: "Dasbor",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Faktur",
    href: "/invoices",
    icon: FileText,
  },
  {
    label: "Produk",
    href: "/produk",
    icon: Package,
  },
  {
    label: "Departemen",
    href: "/departemen",
    icon: Building2,
  },
  {
    label: "Customer",
    href: "/customer",
    icon: Users,
  },
  {
    label: "Penerimaan Bahan",
    href: "/penerimaan-bahan",
    icon: PackageCheck,
  },
];
