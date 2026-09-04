import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AdminShell from '@/components/admin/admin-shell';

export const metadata = {
  title: 'Admin',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (user.role !== 'OWNER') redirect('/chat');
  return <AdminShell>{children}</AdminShell>;
}
