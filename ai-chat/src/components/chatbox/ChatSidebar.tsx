import type { KeyboardEvent } from 'react';
import type { Conversation, PromptTemplate } from '@/types/chat';

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConvId: string | null;
  filteredConversations: Conversation[];
  promptTemplates: PromptTemplate[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewChat: () => void;
  onSelectConversation: (conversation: Conversation) => void;
  onConversationKeyDown: (event: KeyboardEvent<HTMLButtonElement>, conversationId: string) => void;
  onSetConversationButtonRef: (conversationId: string, node: HTMLButtonElement | null) => void;
  onStartRename: (conversation: Conversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  onOpenNewTemplate: () => void;
  onInsertTemplate: (template: PromptTemplate) => void;
  onOpenEditTemplate: (template: PromptTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onCleanDrafts: () => void;
}

export default function ChatSidebar({
  conversations,
  currentConvId,
  filteredConversations,
  promptTemplates,
  searchQuery,
  onSearchChange,
  onNewChat,
  onSelectConversation,
  onConversationKeyDown,
  onSetConversationButtonRef,
  onStartRename,
  onDeleteConversation,
  onOpenNewTemplate,
  onInsertTemplate,
  onOpenEditTemplate,
  onDeleteTemplate,
  onCleanDrafts,
}: ChatSidebarProps) {
  return (
    <aside className="flex w-80 max-w-full flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-4">
        <button
          onClick={onNewChat}
          className="w-full rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
          type="button"
        >
          + New chat
        </button>
        <label className="mt-3 block">
          <span className="sr-only">Search conversations</span>
          <input
            value={searchQuery}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Search conversations"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length > 0 ? (
          filteredConversations.map(conversation => (
            <div
              key={conversation.id}
              className={`group flex w-full items-center gap-2 border-b border-gray-100 px-3 py-3 hover:bg-gray-100 ${
                currentConvId === conversation.id ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''
              }`}
            >
              <button
                ref={node => onSetConversationButtonRef(conversation.id, node)}
                onClick={() => onSelectConversation(conversation)}
                onKeyDown={event => onConversationKeyDown(event, conversation.id)}
                className="min-w-0 flex-1 text-left"
                type="button"
              >
                <div className="truncate text-sm font-medium text-gray-900">{conversation.title}</div>
                <div className="mt-1 text-xs text-gray-500">{new Date(conversation.updatedAt).toLocaleDateString()}</div>
              </button>
              <button
                onClick={() => onStartRename(conversation)}
                className="rounded p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
                title="Rename conversation"
                aria-label={`Rename conversation ${conversation.title}`}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2M12 5v14m6-7H6" />
                </svg>
              </button>
              <button
                onClick={() => onDeleteConversation(conversation.id)}
                className="rounded p-1 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                title="Delete conversation"
                aria-label={`Delete conversation ${conversation.title}`}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M10 11v6m4-6v6m1-10V5a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m-2 0l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12" />
                </svg>
              </button>
            </div>
          ))
        ) : (
          <div className="px-4 py-8 text-sm text-gray-500">No matching conversations</div>
        )}

        <div className="border-t border-gray-200 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Templates</h2>
            <button onClick={onOpenNewTemplate} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50" type="button">
              Add
            </button>
          </div>

          {promptTemplates.length > 0 ? (
            <div className="space-y-2">
              {promptTemplates.map(template => (
                <div key={template.id} className="rounded-md border border-gray-200 p-2">
                  <button
                    onClick={() => onInsertTemplate(template)}
                    className="block w-full text-left"
                    title="Insert template"
                    type="button"
                  >
                    <div className="truncate text-sm font-medium text-gray-900">{template.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-gray-500">{template.content}</div>
                  </button>
                  <div className="mt-2 flex justify-end gap-1">
                    <button onClick={() => onOpenEditTemplate(template)} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100" type="button">
                      Edit
                    </button>
                    <button onClick={() => onDeleteTemplate(template.id)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50" type="button">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500">
              No templates yet
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-3 py-3 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>{filteredConversations.length} conversations</span>
            <button onClick={onCleanDrafts} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100" type="button">
              Clean drafts
            </button>
          </div>
          <div className="mt-2 text-[11px] text-gray-400">
            Total loaded: {conversations.length}
          </div>
        </div>
      </div>
    </aside>
  );
}
