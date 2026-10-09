import { Button, Modal, Spinner, TextArea } from "@heroui/react";
import { AppIcon } from "../AppIcon";
import { useIntl } from "react-intl";
import { useAiFill } from "./useAiFill";

/**
 * AI Fill modal — opens from the PageHeader button. Shows a textarea +
 * submit button; loading state while streaming; auto-closes 1.2s after
 * the form is prefilled (the success chip is visible briefly).
 */
export function AiFillPanel() {
  const intl = useIntl();
  const { open, setOpen, instruction, setInstruction, submit, status, error } =
    useAiFill();

  const isLoading = status === "loading";

  return (
    <Modal isOpen={open} onOpenChange={setOpen}>
      <Modal.Backdrop
        variant="blur"
        isDismissable={!isLoading}
        isKeyboardDismissDisabled={isLoading}
      >
        <Modal.Container placement="center" size="md">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />

            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <AppIcon name="pen" width={20} />
              </Modal.Icon>
              <Modal.Heading>
                {intl.formatMessage({
                  id: "aiFill.fill",
                  defaultMessage: "AI Fill",
                })}
              </Modal.Heading>
              <p className="mt-1.5 text-sm leading-5 text-muted">
                {intl.formatMessage({
                  id: "aiFill.modal_subtitle",
                  defaultMessage:
                    "Describe what you want and the AI will fill the form for you.",
                })}
              </p>
            </Modal.Header>

            <Modal.Body className="space-y-4">
              <TextArea
                aria-label={intl.formatMessage({
                  id: "aiFill.placeholder",
                  defaultMessage: "please help me fill this form with ...",
                })}
                placeholder={intl.formatMessage({
                  id: "aiFill.placeholder",
                  defaultMessage: "please help me fill this form with ...",
                })}
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                disabled={isLoading}
                rows={4}
                fullWidth
              />

              {status === "success" && (
                <div className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success-soft-foreground">
                  <AppIcon name="check-circle" width={16} />
                  {intl.formatMessage({
                    id: "aiFill.success",
                    defaultMessage:
                      "Form prefilled — please review before saving.",
                  })}
                </div>
              )}

              {status === "error" && (
                <div className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
                  <AppIcon name="close-circle" width={16} />
                  {error ??
                    intl.formatMessage({
                      id: "aiFill.error",
                      defaultMessage: "AI Fill failed. Please try again.",
                    })}
                </div>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button variant="secondary" slot="close" isDisabled={isLoading}>
                {intl.formatMessage({
                  id: "aiFill.cancel",
                  defaultMessage: "Cancel",
                })}
              </Button>
              <Button
                variant="primary"
                onPress={submit}
                isDisabled={isLoading || !instruction.trim()}
              >
                {isLoading ? (
                  <Spinner size="sm" color="current" />
                ) : (
                  intl.formatMessage({
                    id: "aiFill.submit",
                    defaultMessage: "Submit",
                  })
                )}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
