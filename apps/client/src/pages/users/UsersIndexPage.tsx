import { useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Dropdown, Modal, SearchField, Separator } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EntityPhoto } from '../../components/EntityPhoto';
import { hasPermissionAtom } from '../../lib/atoms';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { AiFillBar } from '../../components/AiFill/AiFillBar';
import { DataTable } from '../../components/DataTable';
import { useListPage } from '../../lib/useListPage';
import { trpcClient } from '../../lib/trpc';

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  photo?: string | null;
  role: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
};

function UsersIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('user@create');
  const canUpdate = hasPermission('user@update');
  const canDelete = hasPermission('user@delete');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // AI fill form — set the search box; the hook debounces + resets pagination.
  useAiFillForm({
    search: (v) => list.setSearchInput(String(v ?? '')),
  });

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        id: 'user',
        header: intl.formatMessage({ id: 'users.index.header_user', defaultMessage: 'User' }),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <EntityPhoto src={row.original.photo} alt={row.original.name ?? row.original.email} />
            <div>
              <p className="text-sm font-medium text-foreground">{row.original.name ?? '-'}</p>
              <p className="text-xs text-muted">{row.original.email}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'role',
        header: intl.formatMessage({ id: 'users.index.header_role', defaultMessage: 'Role' }),
        cell: ({ row }) => row.original.role?.name ?? '-',
      },
      {
        accessorKey: 'createdAt',
        header: intl.formatMessage({ id: 'users.index.header_created_at', defaultMessage: 'Created At' }),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('id-ID'),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="ghost" isIconOnly aria-label={intl.formatMessage({ id: 'users.index.actions_aria', defaultMessage: 'Actions' })}>
                <Icon icon="solar:menu-dots-bold" className="size-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label={intl.formatMessage({ id: 'users.index.actions_menu', defaultMessage: 'User actions' })}>
                <Dropdown.Item key="view" onPress={() => navigate(`/users/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  View
                </Dropdown.Item>
                {canUpdate ? (
                  <Dropdown.Item key="edit" className="text-warning" onPress={() => navigate(`/users/${row.original.id}/edit`)}>
                    <Icon icon="solar:pen-linear" className="size-4" />
                    Edit
                  </Dropdown.Item>
                ) : null}
                {canDelete ? (
                  <>
                    <Separator />
                    <Dropdown.Item
                      key="delete"
                      variant="danger"
                      className="text-danger"
                      onPress={() => {
                        setUserToDelete(row.original);
                        setDeleteModalOpen(true);
                      }}
                    >
                      <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                      Delete
                    </Dropdown.Item>
                  </>
                ) : null}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    [navigate],
  );

  const list = useListPage<UserRow>({
    queryKey: ['userList'],
    queryFn: (input) =>
      trpcClient.user.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search,
      }),
    columns,
  });

  const handleDelete = async () => {
    if (!userToDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await trpcClient.user.delete.mutate({ id: userToDelete.id });
      await queryClient.invalidateQueries({ queryKey: ['userList'] });
      queryClient.removeQueries({ queryKey: ['userDetail', userToDelete.id] });
      setDeleteModalOpen(false);
      setUserToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: 'users-index',
        page: list.currentPage,
        pageSize: list.table.getState().pagination.pageSize,
        totalUsers: list.totalEntries,
        searchQuery: list.search,
        canCreate,
      })}
    >
      <Card>
        <Card.Header>
          <div className="flex w-full items-start justify-between gap-3">
            <div>
              <Card.Title>{intl.formatMessage({ id: 'users.index.title', defaultMessage: 'Users' })}</Card.Title>
              <Card.Description>{intl.formatMessage({ id: 'users.index.description', defaultMessage: 'Manage system users and their assigned roles.' })}</Card.Description>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-80">
                <SearchField
                  variant="secondary"
                  fullWidth
                  id="user-search"
                  value={list.searchInput}
                  onChange={list.setSearchInput}
                  aria-label={intl.formatMessage({ id: 'users.index.search_placeholder', defaultMessage: 'Search by name, email, or role' })}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={intl.formatMessage({ id: 'users.index.search_placeholder', defaultMessage: 'Search by name, email, or role' })} />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>
              {canCreate ? (
                <Button onPress={() => navigate('/users/new')}>
                  {intl.formatMessage({ id: 'users.index.create_button', defaultMessage: 'Create User' })}
                </Button>
              ) : null}
            </div>
          </div>
        </Card.Header>

        <AiFillBar />

        <Card.Content>
          <DataTable<UserRow>
            table={list.table}
            columns={columns}
            isLoading={list.isLoading || list.isFetching}
            emptyState={{
              icon: 'solar:users-group-two-rounded-linear',
              message: list.search
                ? intl.formatMessage({ id: 'users.index.no_results', defaultMessage: 'No users match the search.' })
                : intl.formatMessage({ id: 'users.index.empty_state', defaultMessage: 'No user data available.' }),
            }}
            loadingMessage={intl.formatMessage({ id: 'users.index.loading', defaultMessage: 'Loading user data...' })}
            ariaLabel="Users table"
            rowHeaderId="user"
            onRowAction={(id) => navigate(`/users/${id}`)}
            totalEntries={list.totalEntries}
            pageStart={list.pageStart}
            pageEnd={list.pageEnd}
          />
        </Card.Content>
      </Card>

      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{intl.formatMessage({ id: 'users.index.delete_modal_title', defaultMessage: 'Delete User' })}</Modal.Heading>
                <p className="mt-1 text-sm text-muted">
                  {intl.formatMessage({ id: 'users.index.delete_modal_body', defaultMessage: 'Are you sure you want to delete user "{userName}"? This action cannot be undone.' }, { userName: userToDelete?.name ?? userToDelete?.email })}
                </p>
              </Modal.Header>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setDeleteModalOpen(false)}>
                  {intl.formatMessage({ id: 'users.index.cancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button variant="danger" onPress={() => void handleDelete()} isDisabled={isDeleting}>
                  {isDeleting ? intl.formatMessage({ id: 'users.index.deleting', defaultMessage: 'Deleting...' }) : intl.formatMessage({ id: 'users.index.delete', defaultMessage: 'Delete' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export { UsersIndexPage };
