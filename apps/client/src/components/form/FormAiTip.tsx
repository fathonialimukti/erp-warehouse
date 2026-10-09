import { useIntl } from "react-intl";
import { AppIcon } from "../AppIcon";

/**
 * Small accent callout used as the preview-rail footer on creative forms.
 * Points users to the AI Fill action in the hero header.
 */
export function FormAiTip() {
  const intl = useIntl();
  return (
    <div className="rounded-2xl border border-accent/25 bg-accent/10 p-4">
      <div className="flex items-center gap-2">
        <AppIcon name="magic-wand" className="size-4 text-accent" />
        <p className="text-sm font-semibold text-accent">
          {intl.formatMessage({
            id: "form.ai_tip_title",
            defaultMessage: "Let AI draft it",
          })}
        </p>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted">
        {intl.formatMessage({
          id: "form.ai_tip_desc",
          defaultMessage:
            "Open AI Fill in the header and describe what you need in plain words.",
        })}
      </p>
    </div>
  );
}
