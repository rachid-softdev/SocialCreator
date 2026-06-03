"use client";

import { Button } from "@socialcreator/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@socialcreator/ui/dialog";
import { TextInput } from "@socialcreator/ui/text-input";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import logger from "@/lib/logger";

export function TeamDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamName.trim()) {
      setError("Team name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName }),
      });

      if (response.ok) {
        setTeamName("");
        setOpen(false);
        router.refresh();
      } else {
        setError("Failed to create team");
      }
    } catch (err) {
      logger.error({ err }, "Failed to create team");
      setError("Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTeamName("");
    setError("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new team</DialogTitle>
          <DialogDescription>
            Teams let you collaborate with others. You can share profiles and manage access
            together.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-body-sm font-medium">Team name</label>
            <TextInput
              placeholder="My Team"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                setError("");
              }}
              error={!!error}
            />
            {error && <p className="text-caption text-semantic-error">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
