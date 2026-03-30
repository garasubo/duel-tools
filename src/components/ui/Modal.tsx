import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import Button from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      onClick={handleBackdropClick}
      className={`rounded-xl shadow-2xl p-0 w-full max-w-lg mx-auto backdrop:bg-black/50 backdrop:backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-col w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id={titleId} className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="閉じる">
            <span aria-hidden="true">✕</span>
          </Button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}
