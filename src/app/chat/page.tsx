import ChatArea from '@/components/chat/chat-area';

export default function NewChatPage() {
  return (
    <div className="h-full">
      <ChatArea conversationId={null} initialMessages={[]} initialTitle="" />
    </div>
  );
}
