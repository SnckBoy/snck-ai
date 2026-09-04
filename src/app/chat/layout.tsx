import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ChatShell from '@/components/chat/chat-shell';

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login');
  return <ChatShell user={user}>{children}</ChatShell>;
}
