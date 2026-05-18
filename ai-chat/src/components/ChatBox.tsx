'use client';

import React, { useState, useEffect } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { useChat } from '@/hooks/useChat';
import { Conversation, Message } from '@/types/chat';

export default function ChatBox() {
  const { messages, isLoading, error, sendMessage, stopGeneration, clearMessages } = useChat({
    onMessage: (message) => {
      // 保存对话到 localStorage
      saveConversationToStorage(message);
    },
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  // 加载对话历史
  useEffect(() => {
    const saved = localStorage.getItem('conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(parsed);
        if (parsed.length > 0) {
          setCurrentConvId(parsed[0].id);
        }
      } catch (e) {
        console.error('Failed to load conversations:', e);
      }
    }
  }, []);

  // 保存对话到 localStorage
  const saveConversationToStorage = (newMessage: Message) => {
    const updatedConv: Conversation = {
      id: currentConvId || Date.now().toString(),
      title: messages.length === 0 ? newMessage.content.slice(0, 30) : (conversations.find(c => c.id === currentConvId)?.title || '新对话'),
      messages: [...messages, newMessage],
      createdAt: conversations.find(c => c.id === currentConvId)?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    let updatedConversations = [...conversations];
    const existingIndex = updatedConversations.findIndex(c => c.id === updatedConv.id);
    
    if (existingIndex >= 0) {
      updatedConversations[existingIndex] = updatedConv;
    } else {
      updatedConversations.unshift(updatedConv);
    }

    setConversations(updatedConversations);
    localStorage.setItem('conversations', JSON.stringify(updatedConversations));
  };

  const handleNewChat = () => {
    clearMessages();
    setCurrentConvId(null);
  };

  const handleSelectConversation = (conv: Conversation) => {
    setCurrentConvId(conv.id);
    // 这里需要实现加载历史消息到当前视图
    // 为简化，暂时只切换 ID
  };

  const handleSend = (content: string, files?: File[]) => {
    if (!currentConvId) {
      setCurrentConvId(Date.now().toString());
    }
    sendMessage(content, files);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 - 对话历史 */}
      {showSidebar && (
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={handleNewChat}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              + 新对话
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors border-b border-gray-100 ${
                  currentConvId === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="truncate text-sm font-medium text-gray-900">{conv.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(conv.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={showSidebar ? '隐藏侧边栏' : '显示侧边栏'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <h1 className="text-lg font-semibold text-gray-900">
            {currentConvId ? conversations.find(c => c.id === currentConvId)?.title || '对话' : '新对话'}
          </h1>
          
          <button
            onClick={clearMessages}
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="清空对话"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* 消息列表 */}
        <MessageList messages={messages} isLoading={isLoading} />

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mb-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 输入区域 */}
        <InputArea onSend={handleSend} onStop={stopGeneration} isLoading={isLoading} />
      </div>
    </div>
  );
}
