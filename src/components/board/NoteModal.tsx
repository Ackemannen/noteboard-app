"use client";

import React, { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTE_COLORS, type Note, type NoteColor } from "@/lib/notes";
import { cn } from "@/lib/utils";

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: { title: string; content: string; color: string }) => void;
  onDelete?: () => void;
  initialData?: Note | null;
}

const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
}) => {
  // The parent remounts this modal (via key) per note, so props seed the state.
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [selectedColor, setSelectedColor] = useState(
    initialData?.color ?? "yellow"
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const submit = () => {
    if (content.trim()) {
      onSave({
        title: title.trim(),
        content: content.trim(),
        color: selectedColor,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-modal-title"
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <h2 id="note-modal-title" className="text-xl font-semibold text-gray-800">
            {initialData ? "Edit Note" : "Create New Note"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
              Title (optional)
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-amber-500"
              placeholder="Enter a title..."
              maxLength={50}
            />
          </div>

          <div>
            <label htmlFor="content" className="mb-1 block text-sm font-medium text-gray-700">
              Content *
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={4}
              autoFocus
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-amber-500"
              placeholder="Write your note here..."
              maxLength={200}
              required
            />
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>{content.length}/200 characters</span>
              <span className="hidden sm:inline">Ctrl + Enter to save</span>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-gray-700">Color</span>
            <div className="flex gap-2">
              {(Object.keys(NOTE_COLORS) as NoteColor[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all duration-200",
                    NOTE_COLORS[color].className,
                    selectedColor === color
                      ? "scale-110 ring-2 ring-amber-500 ring-offset-2"
                      : "hover:scale-105"
                  )}
                  title={NOTE_COLORS[color].label}
                  aria-pressed={selectedColor === color}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            {onDelete && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:block">Delete</span>
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!content.trim()}
            >
              {initialData ? "Update" : "Create"}{" "}
              <span className="hidden sm:block">Note</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NoteModal;
