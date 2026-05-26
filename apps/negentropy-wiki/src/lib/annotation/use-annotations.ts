"use client";

import { useState, useEffect, useCallback } from "react";

export interface AnnotationItem {
  id: string;
  entry_id: string;
  user_id: string;
  user_name: string | null;
  user_picture: string | null;
  body: string;
  quoted_text: string;
  anchor: {
    xpath: string;
    exact: string;
    prefix?: string;
    suffix?: string;
    text_offset?: number;
    text_length?: number;
  };
  pub_version: number;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export function useAnnotations(entryId: string | null) {
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadAnnotations = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/entries/${entryId}/annotations`);
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    void loadAnnotations();
  }, [loadAnnotations]);

  const createAnnotation = useCallback(
    async (params: {
      body: string;
      quoted_text: string;
      anchor: Record<string, unknown>;
    }): Promise<AnnotationItem | null> => {
      if (!entryId) return null;
      try {
        const res = await fetch(`/api/entries/${entryId}/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (res.ok) {
          const annotation = (await res.json()) as AnnotationItem;
          setAnnotations((prev) => [...prev, annotation]);
          setTotal((prev) => prev + 1);
          return annotation;
        }
      } catch {
        // ignore
      }
      return null;
    },
    [entryId],
  );

  const deleteAnnotation = useCallback(
    async (annotationId: string): Promise<boolean> => {
      if (!entryId) return false;
      try {
        const res = await fetch(`/api/entries/${entryId}/annotations/${annotationId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
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

  return { annotations, total, loading, createAnnotation, deleteAnnotation, reload: loadAnnotations };
}
