# Authentication Setup Guide

## Overview

This turborepo includes a complete authentication system with login functionality using:

- **Backend**: tRPC + Prisma with PostgreSQL
- **Frontend**: React + Mantine UI
- **Password**: bcrypt for secure hashing
- **Tokens**: JWT for session management
- **RBAC**: Role-Based Access Control with permissions

## Features

- Login with email and password
- JWT token-based authentication
- Role-based access control (RBAC)
- Permission management
- Secure password hashing with bcrypt
- Persistent authentication state using localStorage

## File Structure

### Server

```
apps/server/
├── src/
│   ├── routers/
│   │   └── auth.ts          # tRPC auth procedures (login, verifyToken)
│   ├── lib/
│   │   ├── prisma.ts        # Prisma client setup
│   │   └── password.ts      # Password hashing utilities
│   ├── seed.ts              # Database seeding script
│   └── router.ts            # Main tRPC router
├── prisma/
│   ├── schema.prisma        # Database schema with User, Role, Permission models
│   └── generated/           # Generated Prisma client
```

### Client

```
apps/client/
├── src/
│   ├── auth/
│   │   ├── AuthContext.tsx      # Authentication context & provider
│   │   ├── LoginPage.tsx        # Login form component
│   │   └── ProtectedRoute.tsx   # Protected route wrapper
│   ├── App.tsx              # Updated with auth logic
│   ├── main.tsx             # Wrapped with AuthProvider
│   └── trpc.ts              # tRPC client setup
```

## Database Schema

### User

- `id`: UUID (ULID)
- `email`: Unique email address
- `name`: Optional user name
- `password`: Hashed password (bcrypt)
- `createdAt`, `updatedAt`: Timestamps

### Role

- `id`: UUID (ULID)
- `name`: Unique role name
- `description`: Optional description
- Relationship: `permissions` (RoleHasPermission)

### Permission

- `id`: UUID (ULID)
- `name`: Unique permission name
- `description`: Optional description

### UserHasRole (Join Table)

- Links users to roles with timestamps

### RoleHasPermission (Join Table)

- Links roles to permissions with timestamps

## API Endpoints (tRPC)

### Login

```typescript
POST /trpc/auth.login
Input: { email: string, password: string }
Output: {
  token: string,
  user: {
    id: string,
    email: string,
    name: string | null,
    roles: Array<{
      id: string,
      name: string,
      permissions: string[]
    }>
  }
}
```

### Verify Token

```typescript
GET /trpc/auth.verifyToken
Input: { token: string }
Output: { valid: boolean, user: { userId, email, name } | null }
```

## Usage

### Environment Variables

Set `JWT_SECRET` in `.env` (server):

```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key-change-this-in-production
```

### Database Setup

1. Run migrations:

```bash
cd apps/server
bun run db:push
```

2. Seed with test data:

```bash
bun run db:seed
```

This creates:

- Admin role with full permissions
- User role with view permission
- Test accounts:
  - **Admin**: `admin@example.com` / `password123`
  - **User**: `user@example.com` / `password123`

### Running the Application

**Server** (from project root):

```bash
cd apps/server
bun run dev
```

**Client** (from project root):

```bash
cd apps/client
bun run dev
```

## Client-Side Usage

### Using Auth Context

```typescript
import { useAuth } from './auth/AuthContext';

function MyComponent() {
  const { user, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <LoginPage />;

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Using Protected Routes

```typescript
import { ProtectedRoute } from './auth/ProtectedRoute';

<ProtectedRoute requiredPermissions={['edit_data']}>
  <MyEditComponent />
</ProtectedRoute>
```

### Using tRPC for Login

```typescript
import { useTRPC } from './trpc';
import { useAuth } from './auth/AuthContext';

function LoginForm() {
  const trpc = useTRPC();
  const { setAuthData } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    const result = await trpc.auth.login.mutate({ email, password });
    setAuthData(result.token, result.user);
  };
}
```

## Creating Users

To create additional users, use Prisma Client or write a script:

```typescript
import { prisma } from './lib/prisma';
import { hashPassword } from './lib/password';

const password = await hashPassword('user_password');
const user = await prisma.user.create({
  data: {
    email: 'newuser@example.com',
    name: 'New User',
    password: password,
    userHasRoles: {
      create: [
        {
          roleId: 'role_id_here', // Get from database
        },
      ],
    },
  },
});
```

## Adding New Permissions

To add new permissions, either:

1. Use Prisma Studio:

```bash
cd apps/server
bun run db:studio
```

2. Or create migrations:

```bash
cd apps/server
bun run db:migrate
```

## Security Considerations

- **JWT Secret**: Change `JWT_SECRET` in production to a strong, random value
- **HTTPS**: Always use HTTPS in production
- **Token Expiration**: Currently set to 7 days, adjust as needed in `auth.ts`
- **Password Policy**: Implement password strength requirements in production
- **Rate Limiting**: Add rate limiting to login endpoint
- **Refresh Tokens**: Consider implementing refresh token rotation for better security

## Troubleshooting

### Login fails with "Invalid email or password"

- Verify the user exists in the database
- Check that the password was hashed correctly
- Use Prisma Studio to inspect user records

### Token not persisting

- Check browser localStorage is enabled
- Verify `setAuthData` is being called after login
- Check browser console for errors

### tRPC connection errors

- Verify `VITE_TRPC_URL` environment variable is set correctly
- Ensure server is running on the correct port
- Check CORS configuration in server

## Next Steps

1. **Add Refresh Tokens**: Implement token refresh mechanism
2. **Add Password Reset**: Create forgot password functionality
3. **Add User Registration**: Implement self-registration (with admin approval)
4. **Add Two-Factor Authentication**: Enhance security with 2FA
5. **Add Audit Logging**: Log all authentication events
6. **Add Email Verification**: Verify email addresses on registration
