import { useCallback } from "react";
import type { AppStorageApi } from "./useAppStorage";

export function useTagManagement({ storage, updateStorage }: AppStorageApi) {
  const addKnownTag = useCallback(
    (tag: string) => {
      updateStorage((prev) => {
        if (prev.knownTags.includes(tag)) return prev;
        return { ...prev, knownTags: [...prev.knownTags, tag] };
      });
    },
    [updateStorage],
  );

  const updateKnownTag = useCallback(
    (oldTag: string, newTag: string) => {
      updateStorage((prev) => ({
        ...prev,
        knownTags: prev.knownTags.map((t) => (t === oldTag ? newTag : t)),
        records: prev.records.map((r) => ({
          ...r,
          reasonTags: r.reasonTags.map((t) => (t === oldTag ? newTag : t)),
        })),
      }));
    },
    [updateStorage],
  );

  const deleteKnownTag = useCallback(
    (tag: string) => {
      updateStorage((prev) => ({
        ...prev,
        knownTags: prev.knownTags.filter((t) => t !== tag),
        records: prev.records.map((r) => ({
          ...r,
          reasonTags: r.reasonTags.filter((t) => t !== tag),
        })),
      }));
    },
    [updateStorage],
  );

  const isTagUsed = useCallback(
    (tag: string) => storage.records.some((r) => r.reasonTags.includes(tag)),
    [storage.records],
  );

  return {
    knownTags: storage.knownTags,
    addKnownTag,
    updateKnownTag,
    deleteKnownTag,
    isTagUsed,
  };
}
