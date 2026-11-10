"use client";

import { useEffect, useState } from "react";
import { onSnapshot, Query, QueryDocumentSnapshot } from "firebase/firestore";

export type SharedQueryState<T> = {
  data: T[];
  loading: boolean;
  error: Error | null;
  fromCache: boolean;
  hasPendingWrites: boolean;
  lastDocument: QueryDocumentSnapshot | null;
};

type CacheEntry = {
  state: SharedQueryState<unknown>;
  listeners: Set<(state: SharedQueryState<unknown>) => void>;
  unsubscribe?: () => void;
  refs: number;
  touched: number;
};

const cache = new Map<string, CacheEntry>();
const emptyState = <T,>(): SharedQueryState<T> => ({
  data: [],
  loading: true,
  error: null,
  fromCache: true,
  hasPendingWrites: false,
  lastDocument: null,
});

function trimCache() {
  if (cache.size <= 24) return;
  for (const [key, entry] of Array.from(cache.entries())) {
    if (entry.refs === 0 && !entry.unsubscribe) cache.delete(key);
    if (cache.size <= 24) break;
  }
}

/** Sdílí jeden Firestore listener a poslední snapshot mezi obrazovkami. */
export function useSharedFirestoreQuery<T = Record<string, unknown>>(
  cacheKey: string,
  source: Query
): SharedQueryState<T> {
  const [local, setLocal] = useState<{ key: string; state: SharedQueryState<T> }>(() => ({
    key: cacheKey,
    state: (cache.get(cacheKey)?.state as SharedQueryState<T>) || emptyState<T>(),
  }));

  const state =
    local.key === cacheKey
      ? local.state
      : (cache.get(cacheKey)?.state as SharedQueryState<T>) || emptyState<T>();

  useEffect(() => {
    let entry = cache.get(cacheKey);

    if (!entry) {
      entry = {
        state: emptyState<unknown>(),
        listeners: new Set(),
        refs: 0,
        touched: Date.now(),
      };
      cache.set(cacheKey, entry);
    }

    const current = entry;
    current.refs += 1;
    current.touched = Date.now();

    const notify = (next: SharedQueryState<unknown>) => {
      setLocal({ key: cacheKey, state: next as SharedQueryState<T> });
    };

    current.listeners.add(notify);
    setLocal({ key: cacheKey, state: current.state as SharedQueryState<T> });

    if (!current.unsubscribe) {
      current.unsubscribe = onSnapshot(
        source,
        { includeMetadataChanges: true },
        snapshot => {
          const next: SharedQueryState<T> = {
            data: snapshot.docs.map(item => ({ id: item.id, ...item.data() } as T)),
            loading: false,
            error: null,
            fromCache: snapshot.metadata.fromCache,
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            lastDocument: snapshot.docs.length
              ? snapshot.docs[snapshot.docs.length - 1]
              : null,
          };

          current.state = next as SharedQueryState<unknown>;
          current.touched = Date.now();
          current.listeners.forEach(listener => listener(current.state));
        },
        error => {
          const next = { ...current.state, loading: false, error };
          current.state = next;
          current.listeners.forEach(listener => listener(next));
        }
      );
    }

    return () => {
      current.listeners.delete(notify);
      current.refs = Math.max(0, current.refs - 1);

      if (current.refs === 0) {
        current.unsubscribe?.();
        current.unsubscribe = undefined;
      }

      trimCache();
    };
  }, [cacheKey]);

  return state;
}
