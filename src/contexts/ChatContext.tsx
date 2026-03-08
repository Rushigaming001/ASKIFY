import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  image?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  model: string;
  mode: 'normal' | 'deepthink' | 'search' | 'reasoning';
  pinned?: boolean;
}

interface ChatContextType {
  chats: Chat[];
  currentChat: Chat | null;
  isLoading: boolean;
  createNewChat: () => Promise<void>;
  selectChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  deleteAllChats: () => Promise<void>;
  renameChat: (chatId: string, newTitle: string) => Promise<void>;
  togglePinChat: (chatId: string) => Promise<void>;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Promise<void>;
  updateChatSettings: (model: string, mode: 'normal' | 'deepthink' | 'search' | 'reasoning') => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load messages for a single chat
  const loadMessagesForChat = useCallback(async (chatId: string): Promise<Message[]> => {
    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return (data || []).map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.created_at).getTime(),
      image: msg.image || undefined
    }));
  }, []);

  // Load chats from database (no messages - loaded on demand)
  const loadChats = useCallback(async () => {
    if (!user) {
      setChats([]);
      setCurrentChat(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: chatData, error: chatError } = await supabase
        .from('ai_chats')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(200);

      if (chatError) throw chatError;

      // Load messages only for the most recent chat to avoid huge URL
      const recentChats = chatData || [];
      let firstChatMessages: Message[] = [];
      if (recentChats.length > 0) {
        firstChatMessages = await loadMessagesForChat(recentChats[0].id);
      }

      const loadedChats: Chat[] = recentChats.map((chat, idx) => ({
        id: chat.id,
        title: chat.title,
        createdAt: new Date(chat.created_at).getTime(),
        model: chat.model,
        mode: chat.mode as 'normal' | 'deepthink' | 'search' | 'reasoning',
        pinned: chat.pinned || false,
        messages: idx === 0 ? firstChatMessages : []
      }));

      setChats(loadedChats);
      if (loadedChats.length > 0 && !currentChat) {
        setCurrentChat(loadedChats[0]);
      } else if (currentChat) {
        const updated = loadedChats.find(c => c.id === currentChat.id);
        if (updated) setCurrentChat(updated);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, loadMessagesForChat]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const createNewChat = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('ai_chats')
        .insert({
          user_id: user.id,
          title: 'New Chat',
          model: 'grok',
          mode: 'normal'
        })
        .select()
        .single();

      if (error) throw error;

      const newChat: Chat = {
        id: data.id,
        title: data.title,
        messages: [],
        createdAt: new Date(data.created_at).getTime(),
        model: data.model,
        mode: data.mode as 'normal' | 'deepthink' | 'search' | 'reasoning',
        pinned: false
      };

      setChats([newChat, ...chats]);
      setCurrentChat(newChat);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const selectChat = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    // Load messages if not yet loaded for this chat
    if (chat.messages.length === 0) {
      const messages = await loadMessagesForChat(chatId);
      const updatedChat = { ...chat, messages };
      setChats(prev => prev.map(c => c.id === chatId ? updatedChat : c));
      setCurrentChat(updatedChat);
    } else {
      setCurrentChat(chat);
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      const { error } = await supabase
        .from('ai_chats')
        .delete()
        .eq('id', chatId);

      if (error) throw error;

      const updatedChats = chats.filter(c => c.id !== chatId);
      setChats(updatedChats);
      if (currentChat?.id === chatId) {
        setCurrentChat(updatedChats[0] || null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const deleteAllChats = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('ai_chats')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      setChats([]);
      setCurrentChat(null);
    } catch (error) {
      console.error('Error deleting all chats:', error);
    }
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('ai_chats')
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq('id', chatId);

      if (error) throw error;

      setChats(chats.map(c => c.id === chatId ? { ...c, title: newTitle } : c));
      if (currentChat?.id === chatId) {
        setCurrentChat({ ...currentChat, title: newTitle });
      }
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const togglePinChat = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    try {
      const { error } = await supabase
        .from('ai_chats')
        .update({ pinned: !chat.pinned, updated_at: new Date().toISOString() })
        .eq('id', chatId);

      if (error) throw error;

      setChats(chats.map(c => c.id === chatId ? { ...c, pinned: !c.pinned } : c));
      if (currentChat?.id === chatId) {
        setCurrentChat({ ...currentChat, pinned: !currentChat.pinned });
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const generateSmartTitle = (content: string): string => {
    const lowerContent = content.toLowerCase().trim();
    
    if (lowerContent.includes('hello') || lowerContent.includes('hi ') || lowerContent === 'hi' || lowerContent.includes('hey')) {
      return '👋 Greeting Chat';
    } else if (lowerContent.includes('help me') || lowerContent.includes('how do i') || lowerContent.includes('can you help')) {
      return '❓ Help Request';
    } else if (lowerContent.includes('code') || lowerContent.includes('programming') || lowerContent.includes('function') || lowerContent.includes('debug')) {
      return '💻 Coding Session';
    } else if (lowerContent.includes('write') && (lowerContent.includes('essay') || lowerContent.includes('story') || lowerContent.includes('article'))) {
      return '✍️ Writing Project';
    } else if (lowerContent.includes('explain') || lowerContent.includes('what is') || lowerContent.includes('tell me about')) {
      return '📚 Learning Query';
    } else if (lowerContent.includes('solve') || lowerContent.includes('calculate') || lowerContent.includes('math')) {
      return '🧮 Math Problem';
    } else if (lowerContent.includes('translate') || lowerContent.includes('language')) {
      return '🌐 Translation';
    } else if (lowerContent.includes('image') || lowerContent.includes('picture') || lowerContent.includes('draw')) {
      return '🖼️ Image Request';
    } else if (lowerContent.includes('video') || lowerContent.includes('youtube')) {
      return '🎬 Video Topic';
    } else {
      const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 'where', 'who', 'can', 'you', 'me', 'my', 'your', 'please', 'could', 'would', 'should', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'be', 'to', 'of', 'and', 'or', 'for', 'with', 'about', 'from', 'in', 'on', 'at', 'by', 'it', 'its', 'i', 'im', "i'm"];
      const words = lowerContent.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
      
      if (words.length >= 2) {
        const titleWords = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1));
        let title = titleWords.join(' ');
        if (title.length > 25) title = title.slice(0, 25) + '...';
        return title;
      } else if (words.length === 1) {
        return words[0].charAt(0).toUpperCase() + words[0].slice(1) + ' Chat';
      }
      return content.slice(0, 25) + (content.length > 25 ? '...' : '');
    }
  };

  const addMessage = async (message: Omit<Message, 'id' | 'timestamp'>) => {
    if (!currentChat || !user) return;

    try {
      // Insert message to database
      const { data: msgData, error: msgError } = await supabase
        .from('ai_chat_messages')
        .insert({
          chat_id: currentChat.id,
          role: message.role,
          content: message.content,
          image: message.image || null
        })
        .select()
        .single();

      if (msgError) throw msgError;

      const newMessage: Message = {
        id: msgData.id,
        role: message.role as 'user' | 'assistant',
        content: message.content,
        timestamp: new Date(msgData.created_at).getTime(),
        image: message.image
      };

      // Auto-rename if first user message
      let newTitle = currentChat.title;
      if (currentChat.messages.length === 0 && message.role === 'user') {
        newTitle = generateSmartTitle(message.content);
        await supabase
          .from('ai_chats')
          .update({ title: newTitle, updated_at: new Date().toISOString() })
          .eq('id', currentChat.id);
      } else {
        // Just update timestamp
        await supabase
          .from('ai_chats')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', currentChat.id);
      }

      const updatedChat = {
        ...currentChat,
        messages: [...currentChat.messages, newMessage],
        title: newTitle
      };

      setCurrentChat(updatedChat);
      setChats(chats.map(c => c.id === currentChat.id ? updatedChat : c));
    } catch (error) {
      console.error('Error adding message:', error);
    }
  };

  const updateChatSettings = async (model: string, mode: 'normal' | 'deepthink' | 'search' | 'reasoning') => {
    if (!currentChat) return;

    try {
      const { error } = await supabase
        .from('ai_chats')
        .update({ model, mode, updated_at: new Date().toISOString() })
        .eq('id', currentChat.id);

      if (error) throw error;

      const updatedChat = { ...currentChat, model, mode };
      setChats(chats.map(c => c.id === currentChat.id ? updatedChat : c));
      setCurrentChat(updatedChat);
    } catch (error) {
      console.error('Error updating chat settings:', error);
    }
  };

  return (
    <ChatContext.Provider value={{
      chats,
      currentChat,
      isLoading,
      createNewChat,
      selectChat,
      deleteChat,
      deleteAllChats,
      renameChat,
      togglePinChat,
      addMessage,
      updateChatSettings
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}