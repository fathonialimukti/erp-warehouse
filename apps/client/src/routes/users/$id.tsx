import React, { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { createProtectedRouteLoader } from '../../lib/route-guard';
import { UserForm } from './components/-UserForm';
import { UserDetail } from './components/-UserDetail';
import { queryClient, trpc } from '../../utils/trpc';

export const Route = createFileRoute('/users/$id')({
    beforeLoad: createProtectedRouteLoader({
        requiredAnyPermissions: ['user:read', 'user:*'],
    }),
    loader: async ({ params }) => {
        // Preload user data
        try {
            return await queryClient.fetchQuery(trpc.user.detail.queryOptions({ id: params.id }));
        } catch {
            return null;
        }
    },
    component: UserDetailPage,
});

function UserDetailPage() {
    const { id } = Route.useParams();
    const [showEdit, setShowEdit] = React.useState(false);
    const { data: user } = useQuery(trpc.user.detail.queryOptions({ id }));

    return (
        <div className="space-y-6">
            {showEdit ? (
                <>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Edit User</h1>
                        <p className="text-gray-600 mt-1">Update user information and role</p>
                    </div>
                    <UserForm
                        userId={id}
                        initialData={
                            user
                                ? {
                                    name: user.name ?? '',
                                    email: user.email,
                                    roleId: user.roleId || '',
                                }
                                : undefined
                        }
                    />
                </>
            ) : (
                <>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">User Details</h1>
                        <p className="text-gray-600 mt-1">View and manage user information</p>
                    </div>
                    <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
                        <UserDetail userId={id} />
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={() => setShowEdit(true)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                Edit User
                            </button>
                        </div>
                    </Suspense>
                </>
            )}
        </div>
    );
}
