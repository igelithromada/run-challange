"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { MessageCircle } from 'lucide-react';
import { auth } from '../lib/firebase';
import { CHAT_CHANGED, type ChatUnread } from '../lib/chat';
import { showAppToast } from './AppToast';
import { useChatLive } from '../lib/chatLive';

export default function FloatingChat() {
  const [uid, setUid] = useState('');
  const [unread, setUnread] = useState(0);
  const version = useRef('');
  const newestIncoming = useRef<number | null>(null);
  const router = useRouter();
  const path = usePathname();
  const inChat = path === '/chat';
  const onLogin = path === '/login';
  useChatLive(onLogin ? '' : uid);

  useEffect(() => {
    let currentUid = '';
    return onAuthStateChanged(auth, user => {
      const nextUid = user?.uid || '';
      if (nextUid === currentUid) return;
      currentUid = nextUid;
      version.current = '';
      newestIncoming.current = null;
      setUid(nextUid);
      setUnread(0);
    });
  }, []);

  useEffect(() => {
    if (!uid || inChat || onLogin) return;

    let active = true;
    let busy = false;
    let pending = false;
    const controller = new AbortController();

    async function poll() {
      const user = auth.currentUser;
      if (!active || user?.uid !== uid || document.visibilityState !== 'visible') return;
      if (busy) { pending = true; return; }
      busy = true;
      try {
        const params = new URLSearchParams({ view: 'unread', version: version.current });
        const response = await fetch('/api/chat?' + params, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Authorization: 'Bearer ' + await user.getIdToken() },
        });
        if (!active || auth.currentUser?.uid !== uid || !response.ok) return;
        const data: ChatUnread = await response.json();
        if (!active || auth.currentUser?.uid !== uid) return;
        version.current = data.version;
        if (data.unread !== undefined) setUnread(data.unread);

        if (data.newestIncomingAt !== undefined) {
          const previous = newestIncoming.current;
          newestIncoming.current = Math.max(previous ?? 0, data.newestIncomingAt);
          if (previous !== null && data.newestIncomingAt > previous && data.enabled && document.hasFocus()) {
            showAppToast('Nové zprávy ve společném chatu', 'info');
          }
        }
      } catch {
        // Keep the last known count until the connection returns.
      } finally {
        busy = false;
        if (pending) { pending = false; void poll(); }
      }
    }
    void poll();
    const timer = window.setInterval(poll, 120000);
    document.addEventListener('visibilitychange', poll);
    window.addEventListener('online', poll);
    window.addEventListener(CHAT_CHANGED, poll);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
      window.removeEventListener('online', poll);
      window.removeEventListener(CHAT_CHANGED, poll);
    };
  }, [uid, inChat, onLogin]);

  if (!uid || onLogin) return null;
  const badge = unread >= 100 ? '99+' : String(unread);
  const label = inChat ? 'Napsat zprávu do chatu' :
    unread ? `Otevřít společný chat, nepřečtené zprávy: ${badge}` : 'Otevřít společný chat';

  return createPortal(
    <button type="button" className={`floating-chat${inChat ? ' is-active' : ''}`}
      aria-label={label} title={label} onClick={() => {
        if (!inChat) {
          router.push('/chat');
          return;
        }
        const input = document.getElementById('chat-text');
        input?.scrollIntoView({ block: 'center' });
        input?.focus();
      }}>
      <MessageCircle size={26} />
      {!inChat && unread > 0 && <span className="floating-chat-badge" aria-hidden="true">{badge}</span>}
    </button>,
    document.body
  );
}
