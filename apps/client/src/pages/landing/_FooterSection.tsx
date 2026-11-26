import { useNavigate } from "react-router";
import { useIntl } from "react-intl";
import appLogoUrl from "../../assets/logo.svg?url";

// Marketing site routes (English literals — no locale keys, per PLAN §4.4).
const FOOTER_LINKS = [
  { label: "Features", path: "/features" },
  { label: "Pricing", path: "/pricing" },
  { label: "About", path: "/about" },
  { label: "FAQ", path: "/faq" },
  { label: "Contact", path: "/contact" },
  { label: "Privacy", path: "/privacy" },
  { label: "Terms", path: "/terms" },
];

export function FooterSection() {
  const intl = useIntl();
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border bg-surface py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="text-sm font-medium text-muted transition-colors hover:text-accent"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="flex w-full flex-col items-center justify-between gap-3 border-t border-border pt-5 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={appLogoUrl} alt="WMS" className="size-6" />
            <span className="font-semibold text-foreground">
              {intl.formatMessage({
                id: "landing.nav.logo_alt",
                defaultMessage: "WMS",
              })}
            </span>
          </div>
          <p className="text-sm text-muted">
            {intl.formatMessage(
              {
                id: "landing.footer.copyright",
                defaultMessage:
                  "© {year} Fathoni Ali Mukti · All rights reserved.",
              },
              { year: new Date().getFullYear() },
            )}
          </p>
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-medium text-accent transition hover:opacity-80"
          >
            {intl.formatMessage({
              id: "landing.footer.try_demo",
              defaultMessage: "Try the Demo →",
            })}
          </button>
        </div>
      </div>
    </footer>
  );
}
