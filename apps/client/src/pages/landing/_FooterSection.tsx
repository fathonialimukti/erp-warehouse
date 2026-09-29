import { useNavigate } from "react-router";
import { useIntl } from "react-intl";
import appLogoUrl from "../../assets/logo.svg?url";

export function FooterSection() {
  const intl = useIntl();
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border bg-surface py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 sm:flex-row lg:px-10">
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
    </footer>
  );
}
