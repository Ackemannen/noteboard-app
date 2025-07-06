import React, { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  x: number;
  y: number;
  rotation: number;
}

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
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedColor, setSelectedColor] = useState("yellow");

  const colors = [
    {
      name: "yellow",
      class: "bg-yellow-200 border-yellow-300",
      label: "Yellow",
    },
    { name: "pink", class: "bg-pink-200 border-pink-300", label: "Pink" },
    { name: "blue", class: "bg-blue-200 border-blue-300", label: "Blue" },
    { name: "green", class: "bg-green-200 border-green-300", label: "Green" },
    {
      name: "orange",
      class: "bg-orange-200 border-orange-300",
      label: "Orange",
    },
  ];

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setContent(initialData.content);
      setSelectedColor(initialData.color);
    } else {
      setTitle("");
      setContent("");
      setSelectedColor("yellow");
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onSave({
        title: title.trim(),
        content: content.trim(),
        color: selectedColor,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">
            {initialData ? "Edit Note" : "Create New Note"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title Input */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title (optional)
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-colors"
              placeholder="Enter a title..."
              maxLength={50}
            />
          </div>

          {/* Content Textarea */}
          <div>
            <label
              htmlFor="content"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Content *
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-colors resize-none"
              placeholder="Write your note here..."
              maxLength={200}
              required
            />
            <div className="text-xs text-gray-500 mt-1">
              {content.length}/200 characters
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setSelectedColor(color.name)}
                  className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                    color.class
                  } ${
                    selectedColor === color.name
                      ? "ring-2 ring-amber-500 ring-offset-2 scale-110"
                      : "hover:scale-105"
                  }`}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
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
                <span className="sm:block hidden">Delete</span>
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
              <span className="sm:block hidden">Note</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NoteModal;
