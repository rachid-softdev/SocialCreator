/**
 * Review Dialog Component
 * Dialog for reviewing content: approve/reject with comment
 */

"use client";

import { Button } from "@socialcreator/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@socialcreator/ui/dialog";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ReviewDialogProps {
  contentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReviewDialog({ contentId, open, onOpenChange }: ReviewDialogProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  const handleApprove = async () => {
    setLoading("approve");
    setError("");

    try {
      const response = await fetch(`/api/v1/content/${contentId}/approve-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        onOpenChange(false);
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to approve content");
      }
    } catch (err) {
      console.error("Failed to approve content", err);
      setError("Failed to approve content");
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      setError("A review comment is required when rejecting content");
      return;
    }

    setLoading("reject");
    setError("");

    try {
      const response = await fetch(`/api/v1/content/${contentId}/reject-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() }),
      });

      if (response.ok) {
        onOpenChange(false);
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to reject content");
      }
    } catch (err) {
      console.error("Failed to reject content", err);
      setError("Failed to reject content");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Content</DialogTitle>
          <DialogDescription>
            Approve this content for publishing or reject it with feedback.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-caption text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="review-comment" className="text-body-sm font-medium">
              Review comment (required for rejection)
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setError("");
              }}
              placeholder="Provide feedback for the content creator..."
              className="w-full min-h-[100px] bg-surface-card border border-hairline rounded-lg px-3 py-2 text-body-sm resize-y"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReject} disabled={loading !== null}>
            {loading === "reject" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <XCircle className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button onClick={handleApprove} disabled={loading !== null}>
            {loading === "approve" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <CheckCircle className="w-4 h-4 mr-2" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
