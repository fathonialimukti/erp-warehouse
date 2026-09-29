import { useIntl } from "react-intl";
import { ButtonGroup, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import { PageTitle } from "./PageTitle";

interface PageHeaderProps {
  title: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onBack: () => void;
  onDetail?: () => void;
  isDisabled?: boolean;
  children?: ReactNode;
}

/**
 * ButtonGroup marks each of its *direct* children with an internal prop, which
 * React 19 rejects on Fragment/array children. Callers pass conditionals and
 * `<>…</>` blocks, so flatten to plain element children before they reach it,
 * re-keying because each nested `toArray` restarts its key numbering.
 */
const flattenGroupChildren = (node: ReactNode): ReactNode[] =>
  Children.toArray(node)
    .flatMap((child) =>
      isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
        ? flattenGroupChildren(child.props.children)
        : [child],
    )
    .map((child, index) =>
      isValidElement(child) ? cloneElement(child, { key: index }) : child,
    );

export const PageHeader = ({
  title,
  onEdit,
  onDelete,
  onBack,
  onDetail,
  isDisabled = false,
  children,
}: PageHeaderProps) => {
  const intl = useIntl();
  const extraActions = flattenGroupChildren(children);

  const actions: Array<{
    key: string;
    label: string;
    icon: string;
    onPress: () => void;
    className?: string;
  }> = [
    onDetail && {
      key: "detail",
      label: intl.formatMessage({
        id: "action_detail",
        defaultMessage: "Detail",
      }),
      icon: "mdi:information",
      onPress: onDetail,
      className: "text-accent",
    },
    onEdit && {
      key: "edit",
      label: intl.formatMessage({ id: "action_edit", defaultMessage: "Edit" }),
      icon: "mdi:pencil",
      onPress: onEdit,
      className: "text-warning",
    },
    onDelete && {
      key: "delete",
      label: intl.formatMessage({
        id: "action_delete",
        defaultMessage: "Delete",
      }),
      icon: "mdi:delete",
      onPress: onDelete,
      className: "text-danger",
    },
    onBack && {
      key: "back",
      label: intl.formatMessage({ id: "skuform_back", defaultMessage: "Back" }),
      icon: "mdi:keyboard-arrow-left",
      onPress: onBack,
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: string;
    onPress: () => void;
    className?: string;
  }>;

  return (
    <div className="flex justify-between items-center">
      <PageTitle title={title} />
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        <ButtonGroup variant="tertiary">
          {extraActions}
          {actions.map((action, index) => (
            <Button
              key={action.key}
              aria-label={action.label}
              onPress={action.onPress}
              isDisabled={isDisabled}
              className={action.className}
            >
              {index > 0 || extraActions.length > 0 ? (
                <ButtonGroup.Separator />
              ) : null}
              <Icon icon={action.icon} />
              <span className="hidden md:block">{action.label}</span>
            </Button>
          ))}
        </ButtonGroup>
      </div>
    </div>
  );
};
