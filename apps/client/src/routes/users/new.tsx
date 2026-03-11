import { createFileRoute } from '@tanstack/react-router';
import { createProtectedRouteLoader } from '../../lib/route-guard';
import { UserForm } from './components/-UserForm';

export const Route = createFileRoute('/users/new')({
    beforeLoad: createProtectedRouteLoader({
        requiredAnyPermissions: ['user:create', 'user:*'],
    }),
    component: CreateUserPage,
});

function CreateUserPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Create New User</h1>
                <p className="text-gray-600 mt-1">Add a new user to the system</p>
            </div>

            <UserForm />
        </div>
    );
}
