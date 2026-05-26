"use client";

import { useState, useEffect, useCallback } from "react";

export interface CommentItem {
  id: string;
  entry_id: string;
  user_id: string;
  user_name: string | null;
  user_picture: string | null;
  body: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export function useComments(entryId: string | null) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadComments = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/entries/${entryId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const createComment = useCallback(
    async (body: string): Promise<CommentItem | null> => {
      if (!entryId) return null;
      try {
        const res = await fetch(`/api/entries/${entryId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        if (res.ok) {
          const comment = (await res.json()) as CommentItem;
          setComments((prev) => [...prev, comment]);
          setTotal((prev) => prev + 1);
          return comment;
        }
      } catch {
        // ignore
      }
      return null;
    },
    [entryId],
  );

  const deleteComment = useCallback(
    async (commentId: string): Promise<boolean> => {
      if (!entryId) return false;
      try {
        const res = await fetch(`/api/entries/${entryId}/comments/${commentId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setComments((prev) => prev.filter((c) => c.id !== commentId));
          setTotal((prev) => prev - 1);
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    },
    [entryId],
  );

  return { comments, total, loading, createComment, deleteComment, reload: loadComments };
}
