import React from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpc } from '../../../utils/trpc';

interface UserFormProps {
    userId?: string;
    initialData?: {
        name: string;
        email: string;
        roleId: string;
    };
}

export const UserForm: React.FC<UserFormProps> = ({ userId, initialData }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const { data: rolesData } = useQuery(
        trpc.role.list.queryOptions({ page: 1, limit: 100 })
    );

    const createMutation = useMutation(
        trpc.user.create.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['user.list'] });
                navigate({ to: '/user' });
            },
            onError: (error: any) => {
                setError((error.data?.zodError?.[0]?.message as string) || error.message);
            },
        })
    );

    const updateMutation = useMutation(
        trpc.user.update.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['user.list'] });
                if (userId) {
                    queryClient.invalidateQueries({ queryKey: ['user.detail', { id: userId }] });
                }
                navigate({ to: '/user' });
            },
            onError: (error: any) => {
                setError((error.data?.zodError?.[0]?.message as string) || error.message);
            },
        })
    );

    const form = useForm({
        defaultValues: {
            name: initialData?.name || '',
            email: initialData?.email || '',
            password: '',
            roleId: initialData?.roleId || '',
        },
        onSubmit: async ({ value }) => {
            setIsSubmitting(true);
            setError(null);

            try {
                if (userId) {
                    await updateMutation.mutateAsync({
                        id: userId,
                        ...(value.password && { password: value.password }),
                        name: value.name,
                        email: value.email,
                        roleId: value.roleId,
                    });
                } else {
                    if (!value.password) {
                        setError('Password is required for new users');
                        setIsSubmitting(false);
                        return;
                    }
                    await createMutation.mutateAsync({
                        name: value.name,
                        email: value.email,
                        password: value.password,
                        roleId: value.roleId,
                    });
                }
            } finally {
                setIsSubmitting(false);
            }
        },
    });

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">{userId ? 'Edit User' : 'Create User'}</h2>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
            )}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    form.handleSubmit();
                }}
                className="space-y-6 bg-white p-6 rounded-lg border border-gray-200"
            >
                <form.Field
                    name="name"
                    validators={{
                        onBlur: ({ value }) => {
                            if (!value) return 'Name is required';
                            if (value.length < 2) return 'Name must be at least 2 characters';
                        },
                    }}
                >
                    {(field) => (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                            <input
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                type="text"
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="John Doe"
                            />
                            {field.state.meta.errors && (
                                <span className="text-sm text-red-600 mt-1 block">{field.state.meta.errors[0]}</span>
                            )}
                        </div>
                    )}
                </form.Field>

                <form.Field
                    name="email"
                    validators={{
                        onBlur: ({ value }) => {
                            if (!value) return 'Email is required';
                            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
                        },
                    }}
                >
                    {(field) => (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                            <input
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                type="email"
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="john@example.com"
                            />
                            {field.state.meta.errors && (
                                <span className="text-sm text-red-600 mt-1 block">{field.state.meta.errors[0]}</span>
                            )}
                        </div>
                    )}
                </form.Field>

                <form.Field
                    name="password"
                    validators={{
                        onBlur: ({ value }) => {
                            if (!userId && !value) return 'Password is required for new users';
                            if (value && value.length < 6) return 'Password must be at least 6 characters';
                        },
                    }}
                >
                    {(field) => (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Password {!userId && '*'}</label>
                            <input
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                type="password"
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder={userId ? 'Leave blank to keep current password' : 'Enter password'}
                            />
                            {field.state.meta.errors && (
                                <span className="text-sm text-red-600 mt-1 block">{field.state.meta.errors[0]}</span>
                            )}
                            {userId && <p className="text-xs text-gray-500 mt-1">Leave blank to keep the current password</p>}
                        </div>
                    )}
                </form.Field>

                <form.Field
                    name="roleId"
                    validators={{
                        onBlur: ({ value }) => {
                            if (!value) return 'Role is required';
                        },
                    }}
                >
                    {(field) => (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                            <select
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                            >
                                <option value="">Select a role</option>
                                {rolesData?.data.map((role: { id: string; name: string }) => (
                                    <option key={role.id} value={role.id}>
                                        {role.name}
                                    </option>
                                ))}
                            </select>
                            {field.state.meta.errors && (
                                <span className="text-sm text-red-600 mt-1 block">{field.state.meta.errors[0]}</span>
                            )}
                        </div>
                    )}
                </form.Field>

                <div className="flex gap-3 pt-4">
                    <button
                        type="submit"
                        disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
                        className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {isSubmitting ? 'Saving...' : userId ? 'Update User' : 'Create User'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate({ to: '/user' })}
                        className="flex-1 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};
