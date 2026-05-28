"use client";

import { Loader2, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface AgentRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  onSuccess?: () => void;
}

export function AgentRunModal({
  isOpen,
  onClose,
  agentId,
  agentName,
  onSuccess,
}: AgentRunModalProps) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (brief.trim().length < 10) {
      setError("Brief must be at least 10 characters");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/agents/${agentId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start run");
      }

      const { runId, status } = await response.json();

      // Close modal and refresh
      onClose();
      setBrief("");
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-lg">
          <div className="flex items-center justify-between p-6 border-b border-hairline">
            <div>
              <h2 className="text-title-md text-ink">Run Agent</h2>
              <p className="text-caption text-muted mt-1">{agentName}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-strong text-muted">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-6">
              <label className="block text-body-sm text-ink mb-2">
                Content Brief
                <span className="text-muted ml-1">(what do you want to generate?)</span>
              </label>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g., Create a motivational post about consistency in achieving goals..."
                className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-body-md text-ink placeholder:text-muted-soft focus:outline-none focus:border-primary resize-none"
                rows={5}
              />
              <p className="text-caption text-muted mt-2">
                {brief.length < 10
                  ? `${10 - brief.length} more characters needed`
                  : "Ready to generate"}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-semantic-error/10 border border-semantic-error/20">
                <p className="text-body-sm text-semantic-error">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-pill text-body-sm text-muted hover:bg-surface-strong transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || brief.trim().length < 10}
                className="inline-flex items-center gap-2 px-6 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Start Run
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
