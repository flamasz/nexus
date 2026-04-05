import { redirect } from 'next/navigation';
import { UserList } from '@/components/admin';
import { getAllUsers, changeUserPassword, getCurrentUser, updateUserAccess } from '@/app/actions/users';
import { resolveUserAccess } from '@/lib/auth/permissions';

export default async function AdminPage() {
  const currentUser = await getCurrentUser();
  const access = resolveUserAccess(currentUser);

  if (!currentUser || !access.canManageUsers) {
    redirect('/');
  }

  const users = await getAllUsers();

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background">
      <main className="max-w-6xl mx-auto p-6 w-full">
        <div className="mb-8">
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-foreground-muted mt-1">
            Manage organization-scoped roles, permissions, assignments, and passwords.
          </p>
        </div>

        <UserList
          users={users}
          onChangePassword={changeUserPassword}
          onUpdateUserAccess={updateUserAccess}
        />
      </main>
    </div>
  );
}
