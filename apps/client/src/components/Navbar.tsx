import {
  Dropdown,
  Avatar,
} from '@heroui/react';
import { useSetAtom, useAtomValue } from 'jotai';
import { authUserAtom, sidebarOpenAtom } from '../lib/atoms';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { useAuthActions } from '../lib/useAuth';
import type { Key } from 'react';

export default function Navbar() {
  const navigate = useNavigate();
  const user = useAtomValue(authUserAtom);
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);
  const { logout } = useAuthActions();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleUserAction = async (key: Key) => {
    if (key === 'logout') {
      await handleLogout();
      return;
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  return (
    <nav className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 md:mx-4 md:mb-0 md:mt-4 md:rounded-2xl md:border md:shadow-xl">
      <div className="flex items-center justify-between px-6 py-4 md:px-5 md:py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Toggle sidebar"
          >
            <Icon icon="solar:hamburger-menu-linear" className="h-5 w-5" />
          </button>
          <p className="text-lg font-bold">Warehouse ERP</p>
        </div>

        <div>
          {user ? (
            <Dropdown>
              <Dropdown.Trigger className="flex text-left items-center">
                <Avatar
                  size="sm"
                  className="cursor-pointer transition-transform"
                />
                <div className="hidden md:flex md:flex-col md:ml-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user.roleName}
                  </p>
                </div>
              </Dropdown.Trigger>

              <Dropdown.Popover>
                <Dropdown.Menu aria-label="User Actions" onAction={handleUserAction}>
                  <Dropdown.Item id="profile" textValue="profile" className="h-14 gap-2">
                    <p className="font-semibold">Signed in as</p>
                    <p className="font-semibold">{user.name}</p>
                  </Dropdown.Item>
                  <Dropdown.Item id="role" textValue="role">
                    Role: {user.roleName}
                  </Dropdown.Item>
                  <Dropdown.Item id="email" textValue="email">
                    {user.email}
                  </Dropdown.Item>
                  <Dropdown.Item id="settings" textValue="settings">My Settings</Dropdown.Item>
                  <Dropdown.Item id="team_settings" textValue="team settings">Team Settings</Dropdown.Item>
                  <Dropdown.Item id="analytics" textValue="analytics">Analytics</Dropdown.Item>
                  <Dropdown.Item id="system" textValue="system">System</Dropdown.Item>
                  <Dropdown.Item id="configurations" textValue="configurations">Configurations</Dropdown.Item>
                  <Dropdown.Item id="help_and_feedback" textValue="help and feedback">Help & Feedback</Dropdown.Item>
                  <Dropdown.Item id="logout" textValue="logout" variant="danger">
                    Log Out
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
