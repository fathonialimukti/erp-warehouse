import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";

export function DefaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col min-h-screen bg-gray-100 dark:bg-background bg-linear-to-tr from-primary/5 to-secondary/15">
      <Navbar />
      <div className="flex flex-1">
        <aside className="shrink-0 p-6 pr-0 lg:block hidden">
          <Sidebar />
        </aside>
        <main className="flex-1 overflow-auto p-3 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
