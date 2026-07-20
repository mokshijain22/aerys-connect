'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { ResponsiveLayout } from '@/app/components/ResponsiveLayout';
import { NAV_ITEMS } from '@/app/lib/nav-items';
import Link from 'next/link';

const VIOLET = '#6C5CE7';
const VIOLET_LIGHT = '#8B7CF8';
const VIOLET_DIM = 'rgba(108,92,231,0.10)';
const BORDER = 'rgba(30,20,60,0.07)';
const MUTED = '#6B7280';
const INK = '#1A1A2E';
const GREEN = '#22C55E';
const CARD_SHADOW = '0 1px 2px rgba(20,10,50,0.04), 0 8px 24px -12px rgba(20,10,50,0.08)';

const NAV = NAV_ITEMS.map((item) => ({ ...item, active: item.href === '/whatsapp-inbox' }));

type Conversation = { conversation_id: number; phone: string; handoff_to_human: number; last_message_at: string };
type Message = { direction: 'incoming' | 'outgoing'; body: string; created_at: string };

export default function WhatsAppInboxPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selected) {
      fetchMessages(selected.conversation_id);
      const interval = setInterval(() => fetchMessages(selected.conversation_id), 5000);
      return () => clearInterval(interval);
    }
  }, [selected?.conversation_id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function fetchConversations() {
    try {
      const res = await fetch('/api/whatsapp/inbox');
      const json = await res.json();
      if (json.success) setConversations(json.data);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages(conversationId: number) {
    const res = await fetch('/api/whatsapp/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, action: 'fetch_messages' }),
    });
    const json = await res.json();
    if (json.success) setMessages(json.data);
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      await fetch('/api/whatsapp/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected.conversation_id, action: 'reply', message: replyText.trim() }),
      });
      setReplyText('');
      fetchMessages(selected.conversation_id);
    } finally {
      setSending(false);
    }
  }

  async function closeConversation() {
    if (!selected) return;
    await fetch('/api/whatsapp/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: selected.conversation_id, action: 'close' }),
    });
    setSelected(null);
    fetchConversations();
  }

  function timeAgo(dateStr: string) {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  if (role !== 'dealer' && role !== 'super_admin') {
    return (
      <ResponsiveLayout navItems={NAV}>
        <p className="text-sm p-6" style={{ color: MUTED }}>You don't have access to this page.</p>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout navItems={NAV}>
      <div className="-m-4 md:-m-6 p-4 md:p-6" style={{ backgroundColor: '#FAFAFF' }}>
        <div className="flex items-center gap-1.5 text-xs mb-4" style={{ color: MUTED }}>
          <Link href="/" className="hover:underline">Home</Link> <span>›</span>
          <span className="font-semibold" style={{ color: VIOLET }}>WhatsApp Inbox</span>
        </div>

        <div className="rounded-[20px] p-7 mb-6" style={{ background: `linear-gradient(135deg, ${VIOLET_DIM}, rgba(245,166,35,0.05))`, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}>
          <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: INK }}>WhatsApp Inbox</h1>
          <p className="text-sm mt-2" style={{ color: MUTED }}>Customers who asked for customer care — reply here, it sends straight to their WhatsApp.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5" style={{ height: 560 }}>
          {/* Conversation list */}
          <div className="rounded-[20px] bg-white border overflow-hidden flex flex-col" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            <div className="p-4 border-b" style={{ borderColor: BORDER }}>
              <p className="font-bold text-sm" style={{ color: INK }}>Waiting for reply ({conversations.length})</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && <p className="text-xs p-4" style={{ color: MUTED }}>Loading...</p>}
              {!loading && conversations.length === 0 && (
                <p className="text-xs p-4" style={{ color: MUTED }}>No active customer care chats right now.</p>
              )}
              {conversations.map((c) => (
                <button key={c.conversation_id} onClick={() => setSelected(c)}
                  className="w-full text-left px-4 py-3 border-b transition-colors hover:bg-[rgba(108,92,231,0.04)]"
                  style={{ borderColor: BORDER, backgroundColor: selected?.conversation_id === c.conversation_id ? VIOLET_DIM : 'transparent' }}>
                  <p className="text-sm font-semibold" style={{ color: INK }}>{c.phone}</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>{timeAgo(c.last_message_at)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Chat thread */}
          <div className="md:col-span-2 rounded-[20px] bg-white border overflow-hidden flex flex-col" style={{ borderColor: BORDER, boxShadow: CARD_SHADOW }}>
            {!selected ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: MUTED }}>Select a conversation to view messages.</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
                  <div>
                    <p className="font-bold text-sm" style={{ color: INK }}>{selected.phone}</p>
                    <p className="text-[11px]" style={{ color: MUTED }}>via WhatsApp</p>
                  </div>
                  <button onClick={closeConversation}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: GREEN }}>
                    ✓ Mark resolved
                  </button>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: '#F5F5FB' }}>
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm"
                        style={m.direction === 'outgoing'
                          ? { background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`, color: '#fff' }
                          : { backgroundColor: '#fff', color: INK, border: `1px solid ${BORDER}` }}>
                        <p>{m.body}</p>
                        <p className="text-[10px] mt-1 opacity-70">{new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 border-t flex items-center gap-2" style={{ borderColor: BORDER }}>
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
                    placeholder="Type a reply..."
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none border"
                    style={{ borderColor: BORDER, color: INK }}
                  />
                  <button onClick={sendReply} disabled={sending || !replyText.trim()}
                    className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})` }}>
                    {sending ? '...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}