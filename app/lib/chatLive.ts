"use client";

import { useEffect } from 'react';
import { auth } from './firebase';
import { CHAT_CHANGED } from './chat';

export function useChatLive(uid: string) {
  useEffect(() => {
    if (!uid) return;
    let connection: AbortController | undefined;
    let retry: number | undefined;
    let revision: string | undefined;
    let stopped = false;
    let failures = 0;

    async function connect() {
      const user = auth.currentUser;
      if (stopped || connection || user?.uid !== uid || document.visibilityState !== 'visible') return;
      const controller = new AbortController();
      connection = controller;
      let received = false;
      try {
        const response = await fetch('/api/chat/events', {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Authorization: 'Bearer ' + await user.getIdToken() },
        });
        if (!response.ok || !response.body) throw new Error('Chat stream unavailable');
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        try {
          while (!controller.signal.aborted) {
            const { done, value } = await reader.read();
            if (done || controller.signal.aborted || auth.currentUser?.uid !== uid) break;
            const lines = (buffer + value).split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const next = JSON.parse(line.slice(6)) as string;
              if (next !== revision) {
                revision = next;
                window.dispatchEvent(new Event(CHAT_CHANGED));
              }
              received = true;
            }
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
      } catch {
        // Periodic refresh remains available while the live connection retries.
      } finally {
        if (connection === controller) {
          connection = undefined;
          if (!stopped && document.visibilityState === 'visible') {
            failures = received ? 0 : Math.min(failures + 1, 5);
            retry = window.setTimeout(connect, received ? 250 : 1000 * 2 ** failures);
          }
        }
      }
    }

    function reconnect() {
      window.clearTimeout(retry);
      if (document.visibilityState === 'visible') {
        void connect();
      } else {
        connection?.abort();
        connection = undefined;
      }
    }

    reconnect();
    document.addEventListener('visibilitychange', reconnect);
    window.addEventListener('online', reconnect);
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      connection?.abort();
      document.removeEventListener('visibilitychange', reconnect);
      window.removeEventListener('online', reconnect);
    };
  }, [uid]);
}
