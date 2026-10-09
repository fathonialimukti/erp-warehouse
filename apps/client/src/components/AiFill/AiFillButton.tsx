import { Button } from "@heroui/react";
import { AppIcon } from "../AppIcon";
import { useSetAtom } from "jotai";
import { useIntl } from "react-intl";
import { aiChatOpenAtom, aiChatPresetMessageAtom } from "../../lib/atoms";
import { useAiFill } from "./useAiFill";

/**
 * AI Fill toggle button — designed to be rendered inside PageHeader's
 * `<ButtonGroup>` as a child. Toggles the collapsible `<AiFillPanel />`
 * and opens the global ERP assistant drawer (mounted in PrivateLayout)
 * with the localized `assistant.autoFill` prompt prefilled — never sent.
 */
export function AiFillButton() {
  const intl = useIntl();
  const { open, setOpen } = useAiFill();
  const setAiChatOpen = useSetAtom(aiChatOpenAtom);
  const setAiChatPresetMessage = useSetAtom(aiChatPresetMessageAtom);

  const handlePress = () => {
    setOpen(!open);
    setAiChatPresetMessage(
      intl.formatMessage({
        id: "assistant.autoFill",
        defaultMessage: "help me fill this form",
      }),
    );
    setAiChatOpen(true);
  };

  return (
    <Button
      variant="tertiary"
      onPress={handlePress}
      aria-expanded={open}
      aria-label={intl.formatMessage({
        id: "aiFill.fill",
        defaultMessage: "AI Fill",
      })}
      className="text-accent"
    >
      <AppIcon name="pen" width={16} />
      <span className="hidden md:block">
        {intl.formatMessage({ id: "aiFill.fill", defaultMessage: "AI Fill" })}
      </span>
    </Button>
  );
}
