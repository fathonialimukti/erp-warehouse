import { Outlet } from 'react-router';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(46,115,255,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(180deg,_var(--background),_var(--surface-secondary))]">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}
