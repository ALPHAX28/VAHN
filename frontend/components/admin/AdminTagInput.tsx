"use client";

import { useState, KeyboardEvent } from "react";

interface AdminTagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function AdminTagInput({
  tags,
  onChange,
  placeholder = "Type tag and press Enter...",
}: AdminTagInputProps) {
  const [inputValue, setInputValue] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  function addTag() {
    const trimmed = inputValue.trim().replace(/^,+|,+$/g, "");
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue("");
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div className="admin-tag-input-container">
      <div className="admin-tag-input-pills">
        {tags.map((tag, idx) => (
          <span key={`${tag}-${idx}`} className="admin-tag-pill">
            {tag}
            <button
              type="button"
              className="admin-tag-pill-remove"
              onClick={() => removeTag(idx)}
              title="Remove tag"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          type="text"
          className="admin-tag-input-field"
          placeholder={tags.length === 0 ? placeholder : "Add another tag..."}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
        />
      </div>
      <span className="admin-form-hint">Press Enter or comma (,) to add tags</span>
    </div>
  );
}
