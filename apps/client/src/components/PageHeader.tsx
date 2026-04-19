import { useIntl } from 'react-intl';
import { ButtonGroup, Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    onEdit?: () => void;
    onDelete?: () => void;
    onBack: () => void;
    onDetail?: () => void;
    isDisabled?: boolean;
    children?: ReactNode;
}

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

    const actions: Array<{ key: string; label: string; icon: string; onPress: () => void; className?: string }> = [
        onDetail && {
            key: 'detail',
            label: intl.formatMessage({ id: 'action_detail', defaultMessage: 'Detail' }),
            icon: 'mdi:information',
            onPress: onDetail,
            className: 'text-accent',
        },
        onEdit && {
            key: 'edit',
            label: intl.formatMessage({ id: 'action_edit', defaultMessage: 'Edit' }),
            icon: 'mdi:pencil',
            onPress: onEdit,
            className: 'text-warning',
        },
        onDelete && {
            key: 'delete',
            label: intl.formatMessage({ id: 'action_delete', defaultMessage: 'Delete' }),
            icon: 'mdi:delete',
            onPress: onDelete,
            className: 'text-danger',
        },
        onBack && {
            key: 'back',
            label: intl.formatMessage({ id: 'skuform_back', defaultMessage: 'Back' }),
            icon: 'mdi:keyboard-arrow-left',
            onPress: onBack,
        },
    ].filter(Boolean) as Array<{ key: string; label: string; icon: string; onPress: () => void; className?: string }>;

    return (
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <div className="flex items-center gap-2">
                <ButtonGroup variant="tertiary">
                {children}
                {actions.map((action, index) => (
                    <Button
                        key={action.key}
                        aria-label={action.label}
                        onPress={action.onPress}
                        isDisabled={isDisabled}
                        className={action.className}
                    >
                        {(index > 0 || children) ? <ButtonGroup.Separator /> : null}
                        <Icon icon={action.icon} />
                        <span className='hidden md:block'>{action.label}</span>
                    </Button>
                ))}
                </ButtonGroup>
            </div>
        </div>
    );
};