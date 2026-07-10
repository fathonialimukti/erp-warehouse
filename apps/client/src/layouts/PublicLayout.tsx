import { Outlet } from 'react-router';

function PublicLayout() {
  return (
    <div className="relative min-h-screen bg-surface-secondary">
      {/* Ambient backdrop accents */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-accent/[0.06] blur-[8rem]" />
        <div className="absolute -bottom-40 -right-20 size-[28rem] rounded-full bg-indigo-400/[0.05] blur-[7rem]" />
      </div>
      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}

export { PublicLayout };
