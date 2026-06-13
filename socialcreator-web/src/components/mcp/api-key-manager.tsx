"use client";

import { Button } from "@socialcreator/ui/button";
import { AlertTriangle, Check, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import logger from "@/lib/logger";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsed?: string | null;
  createdAt: string;
  revokedAt?: string | null;
}

interface ApiKeyManagerProps {
  initialKeys?: ApiKey[];
  onCreate?: (
    name: string,
  ) => Promise<{ id: string; name: string; prefix: string; apiKey: string }>;
  onRevoke?: (id: string) => Promise<void>;
}

export function ApiKeyManager({ initialKeys = [], onCreate, onRevoke }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<{
    name: string;
    prefix: string;
    apiKey: string;
  } | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeConfirmKeyId, setRevokeConfirmKeyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!newKeyName.trim() || !onCreate) return;

    setIsCreating(true);
    try {
      const result = await onCreate(newKeyName.trim());
      setCreatedKey({
        name: result.name,
        prefix: result.prefix,
        apiKey: result.apiKey,
      });
      setNewKeyName("");
      // Add to list after creation (will refresh)
      setKeys((prev) => [
        ...prev,
        {
          id: result.id,
          name: result.name,
          prefix: result.prefix,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      logger.error({ err: error }, "Failed to create key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!onCreate) return;

    setRevokingId(id);
    try {
      await onRevoke?.(id);
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)),
      );
    } catch (error) {
      logger.error({ err: error }, "Failed to revoke key");
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateStr));
  };

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className="space-y-6">
      {/* Create new key modal */}
      {isCreating && (
        <div className="rounded-xl border border-hairline bg-surface-card p-4">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="API key name (e.g., Production, Development)"
            className="w-full px-3 py-2 rounded-lg border border-hairline focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={!newKeyName.trim()} className="mt-3">
            Create Key
          </Button>
        </div>
      )}

      {/* New key display - only shown once */}
      {createdKey && (
        <div className="rounded-xl border border-gradient-peach bg-gradient-peach/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-semantic-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-title-sm font-medium mb-1">API Key created - save it now!</h4>
              <p className="text-body-sm text-muted mb-3">
                This key will only be shown once. Copy it now and store it securely.
              </p>

              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-surface-dark text-on-dark rounded font-mono text-sm break-all">
                  {createdKey.apiKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(createdKey.apiKey)}
                  icon={copied ? Check : Copy}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCreatedKey(null)}
            className="mt-3 w-full"
          >
            I&apos;ve saved my key
          </Button>
        </div>
      )}

      {/* Active keys */}
      {activeKeys.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-title-sm font-medium text-muted uppercase tracking-wide">
            Active Keys
          </h4>

          {activeKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-lg border border-hairline p-3 bg-surface-card"
            >
              <div>
                <p className="text-body-sm font-medium">{key.name}</p>
                <p className="text-body-sm text-muted font-mono">{key.prefix}...</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-body-sm text-muted">Created {formatDate(key.createdAt)}</span>

                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setRevokeConfirmKeyId(key.id)}
                  disabled={revokingId === key.id}
                  className="text-semantic-error hover:text-semantic-error"
                >
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-title-sm font-medium text-muted uppercase tracking-wide">
            Revoked Keys
          </h4>

          {revokedKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-lg border border-hairline p-3 bg-surface-strong opacity-60"
            >
              <div>
                <p className="text-body-sm font-medium">{key.name}</p>
                <p className="text-body-sm text-muted font-mono">{key.prefix}...</p>
              </div>

              <span className="text-body-sm text-muted">
                Revoked {key.revokedAt ? formatDate(key.revokedAt) : "N/A"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* No keys message */}
      {keys.length === 0 && !isCreating && (
        <div className="text-center py-8 text-muted">
          <p>No API keys yet.</p>
          <Button
            variant="outline"
            icon={Plus}
            onClick={() => setIsCreating(true)}
            className="mt-3"
          >
            Create your first API key
          </Button>
        </div>
      )}

      {/* Create button */}
      {!isCreating && keys.length > 0 && (
        <Button
          variant="outline"
          icon={Plus}
          onClick={() => setIsCreating(true)}
          className="w-full"
        >
          Create New Key
        </Button>
      )}

      <ConfirmDialog
        open={!!revokeConfirmKeyId}
        onOpenChange={(open) => {
          if (!open) setRevokeConfirmKeyId(null);
        }}
        title="Revoke API key?"
        description="This action cannot be undone. The API key will stop working immediately."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={() => {
          if (revokeConfirmKeyId) handleRevoke(revokeConfirmKeyId);
          setRevokeConfirmKeyId(null);
        }}
      />
    </div>
  );
}
