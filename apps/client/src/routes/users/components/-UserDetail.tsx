import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { trpc } from '../../../utils/trpc';

interface UserDetailProps {
    userId: string;
}

export const UserDetail: React.FC<UserDetailProps> = ({ userId }) => {
    const { data: user, isLoading, error } = useQuery(
        trpc.user.detail.queryOptions({ id: userId })
    );

    if (isLoading) {
        return <div className="text-center py-8">Loading user details...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-600">Error loading user: {error.message}</div>;
    }

    if (!user) {
        return <div className="text-center py-8 text-gray-600">User not found</div>;
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{user.name}</h2>
                <Link
                    to={`/users/$id`}
                    params={{ id: userId }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Edit
                </Link>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Name</p>
                        <p className="text-lg text-gray-900">{user.name}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Email</p>
                        <p className="text-lg text-gray-900">{user.email}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Role</p>
                        <p className="text-lg text-gray-900">{user.role?.name || '-'}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Created</p>
                        <p className="text-lg text-gray-900">
                            {new Date(user.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </p>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                    <Link
                        to="/user"
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                        ← Back to Users
                    </Link>
                </div>
            </div>
        </div>
    );
};
