import { Outlet } from "react-router";
import { LandingNavbar } from "../landing/_LandingNavbar";
import { FooterSection } from "../landing/_FooterSection";

/**
 * Public marketing shell: shared navbar, scrollable main, shared footer.
 *
 * Distinct from `PublicLayout` (the centered login shell). The home page at `/`
 * keeps its own inline navbar/footer and is NOT wrapped by this layout.
 */
function MarketingLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-foreground"
      >
        Skip to content
      </a>

      <LandingNavbar />

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <FooterSection />
    </div>
  );
}

export default MarketingLayout;
