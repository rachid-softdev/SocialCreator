"use client";

import { BadgePill } from "@socialcreator/ui/badge-pill";
import { Button } from "@socialcreator/ui/button";
import { GripVertical, Plus, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";

interface ContentExample {
  id: string;
  content: string;
  platform?: string;
  tags: string[];
}

interface ContentBankEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ContentBankEditor({
  value,
  onChange,
  placeholder = "Paste examples of your past content here. This helps the AI understand your style:\n\n- Previous social posts\n- Blog articles\n- Newsletter snippets\n- Any content that represents your brand",
}: ContentBankEditorProps) {
  const [examples, setExamples] = useState<ContentExample[]>(() => {
    // Parser la valeur existante
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch {
      // Si pas JSON, convertir l'ancien format texte en exemples
      return value
        .split("\n\n")
        .filter(Boolean)
        .map((text, i) => ({
          id: `legacy-${i}`,
          content: text,
          tags: [],
        }));
    }
  });

  const [newExample, setNewExample] = useState("");
  const [newTag, setNewTag] = useState("");

  const addExample = () => {
    if (!newExample.trim()) return;

    const example: ContentExample = {
      id: `example-${Date.now()}`,
      content: newExample.trim(),
      tags: [],
    };

    const updatedExamples = [...examples, example];
    setExamples(updatedExamples);
    onChange(JSON.stringify(updatedExamples));
    setNewExample("");
  };

  const removeExample = (id: string) => {
    const updatedExamples = examples.filter((e) => e.id !== id);
    setExamples(updatedExamples);
    onChange(JSON.stringify(updatedExamples));
  };

  const addTagToExample = (exampleId: string) => {
    if (!newTag.trim()) return;

    const updatedExamples = examples.map((e) => {
      if (e.id === exampleId && !e.tags.includes(newTag.trim())) {
        return { ...e, tags: [...e.tags, newTag.trim()] };
      }
      return e;
    });

    setExamples(updatedExamples);
    onChange(JSON.stringify(updatedExamples));
    setNewTag("");
  };

  const removeTagFromExample = (exampleId: string, tag: string) => {
    const updatedExamples = examples.map((e) => {
      if (e.id === exampleId) {
        return { ...e, tags: e.tags.filter((t) => t !== tag) };
      }
      return e;
    });

    setExamples(updatedExamples);
    onChange(JSON.stringify(updatedExamples));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="block text-body-sm text-body">Content Bank</span>
          <p className="text-caption text-muted-soft">
            Add examples of your best content to help AI match your style
          </p>
        </div>
        <BadgePill>{examples.length} examples</BadgePill>
      </div>

      {/* Add new example */}
      <div className="rounded-lg border border-hairline p-4 bg-canvas-soft">
        <textarea
          value={newExample}
          onChange={(e) => setNewExample(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-md border border-hairline-strong bg-surface-card px-3 py-2 text-body-md text-ink placeholder:text-muted-soft resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary-active"
        />
        <div className="mt-3 flex justify-end">
          <Button onClick={addExample} disabled={!newExample.trim()} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Example
          </Button>
        </div>
      </div>

      {/* Examples list */}
      {examples.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-caption-uppercase text-muted font-medium">Your Examples</h4>
          {examples.map((example) => (
            <div key={example.id} className="rounded-lg border border-hairline bg-surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center text-muted-soft">
                  <GripVertical className="w-4 h-4 cursor-move mr-2" />
                </div>
                <div className="flex-1">
                  <p className="text-body-sm text-body whitespace-pre-wrap">
                    {example.content.length > 200
                      ? `${example.content.slice(0, 200)}...`
                      : example.content}
                  </p>

                  {/* Tags */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {example.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-strong text-caption text-muted"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTagFromExample(example.id, tag)}
                          className="hover:text-semantic-error"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <div className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-muted-soft" />
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTagToExample(example.id);
                          }
                        }}
                        placeholder="Add tag..."
                        className="w-20 text-caption bg-transparent border-none focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeExample(example.id)}
                  className="text-muted-soft hover:text-semantic-error"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="rounded-lg bg-canvas-soft p-4">
        <h4 className="text-caption font-medium text-body mb-2">Tips</h4>
        <ul className="text-caption text-muted space-y-1">
          <li>• Add 5-10 examples of your best performing content</li>
          <li>• Include different formats (text, threads, captions)</li>
          <li>• Use tags to categorize by topic or style</li>
          <li>• The AI will use these as inspiration, not copy</li>
        </ul>
      </div>
    </div>
  );
}
