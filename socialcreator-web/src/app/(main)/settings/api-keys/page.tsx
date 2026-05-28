"use client";

import { useEffect, useState } from "react";
import { ApiKeyManager } from "@/components/mcp/api-key-manager";
import { McpTester } from "@/components/mcp/mcp-tester";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsed?: string | null;
  createdAt: string;
  revokedAt?: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    fetchKeys();

    // Check for API key in URL query params (from creation flow)
    const params = new URLSearchParams(window.location.search);
    const newKey = params.get("apiKey");
    if (newKey) {
      setApiKey(newKey);
      // Clean URL
      window.history.replaceState({}, "", "/settings/api-keys");
    }
  }, [fetchKeys]);

  const fetchKeys = async () => {
    try {
      const response = await fetch("/api/api-keys");
      const data = await response.json();
      setKeys(data.keys || []);
    } catch (error) {
      console.error("Failed to fetch keys:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (name: string) => {
    const response = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error("Failed to create API key");
    }

    const data = await response.json();
    return data;
  };

  const handleRevoke = async (id: string) => {
    const response = await fetch(`/api/api-keys/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to revoke API key");
    }

    await fetchKeys();
  };

  return (
    <div className="max-w-content mx-auto px-6 py-section">
      <h1 className="text-title-md mb-2">API Keys</h1>
      <p className="text-body-sm text-muted mb-8">
        Manage your API keys to programmatically access SocialCreator.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* API Key Manager */}
        <div>
          <h2 className="text-title-sm mb-4">Your API Keys</h2>

          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-24 bg-surface-strong rounded-xl" />
            </div>
          ) : (
            <ApiKeyManager initialKeys={keys} onCreate={handleCreate} onRevoke={handleRevoke} />
          )}
        </div>

        {/* MCP Tester */}
        <div>
          <h2 className="text-title-sm mb-4">Test the API</h2>

          <div className="rounded-xl border border-hairline bg-surface-card p-4">
            <McpTester apiKey={apiKey} />
          </div>
        </div>
      </div>

      {/* Documentation */}
      <div className="mt-12">
        <h2 className="text-title-sm mb-4">Quick Start</h2>

        <div className="rounded-xl border border-hairline bg-surface-card p-6">
          <h3 className="text-body-sm font-medium mb-3">Using cURL</h3>

          <pre className="bg-surface-dark text-on-dark rounded-lg p-4 overflow-x-auto text-body-sm font-mono">
            {`# List profiles
curl -X POST https://socialcreator.com/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"jsonrpc": "2.0", "id": 1, "method": "list_profiles", "params": {}}'`}
          </pre>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-card p-6 mt-4">
          <h3 className="text-body-sm font-medium mb-3">Using JavaScript</h3>

          <pre className="bg-surface-dark text-on-dark rounded-lg p-4 overflow-x-auto text-body-sm font-mono">
            {`const response = await fetch('/api/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'list_profiles',
    params: {}
  })
})

const data = await response.json()
console.log(data.result)`}
          </pre>
        </div>

        <div className="mt-4 text-center">
          <a
            href="https://docs.socialcreator.com/api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-body-sm text-primary hover:underline"
          >
            View full API documentation →
          </a>
        </div>
      </div>
    </div>
  );
}
