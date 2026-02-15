import { Chip } from '@heroui/react';

import { useOnlineStatus } from '@/hooks/use-online-status';

export const OnlineStatusIndicator = () => {
  const { isOnline } = useOnlineStatus();

  if (isOnline) {
    return null; // Don't show anything when online
  }

  return (
    <Chip className='text-xs' color='warning' size='sm'>
      Offline - Showing cached data
    </Chip>
  );
};
