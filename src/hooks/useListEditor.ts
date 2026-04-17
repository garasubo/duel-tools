import { useState, useRef, useEffect } from "react";

export interface UseListEditorOptions<T> {
  onAdd: (value: string) => void;
  onUpdate: (key: T, value: string) => void;
}

export function useListEditor<T>({ onAdd, onUpdate }: UseListEditorOptions<T>) {
  const [editingKey, setEditingKey] = useState<T | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addValue, setAddValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingKey !== null) editInputRef.current?.focus();
  }, [editingKey]);

  useEffect(() => {
    if (isAdding) addInputRef.current?.focus();
  }, [isAdding]);

  const startEdit = (key: T, initial: string) => {
    setEditingKey(key);
    setEditValue(initial);
  };

  const commitEdit = () => {
    if (editingKey !== null && editValue.trim()) {
      onUpdate(editingKey, editValue.trim());
    }
    setEditingKey(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const startAdd = () => {
    setEditingKey(null);
    setIsAdding(true);
  };

  const commitAdd = () => {
    if (addValue.trim()) {
      onAdd(addValue.trim());
    }
    setIsAdding(false);
    setAddValue("");
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setAddValue("");
  };

  const isEditing = (key: T) => editingKey === key;

  return {
    editingKey,
    isEditing,
    editValue,
    setEditValue,
    editInputRef,
    startEdit,
    commitEdit,
    cancelEdit,
    isAdding,
    addValue,
    setAddValue,
    addInputRef,
    startAdd,
    commitAdd,
    cancelAdd,
  };
}
