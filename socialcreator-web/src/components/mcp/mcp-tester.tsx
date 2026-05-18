"use client"

import { useState } from "react"
import { Play, Copy, Check, AlertCircle } from "lucide-react"
import { Button } from "@socialcreator/ui/button"

interface McpTesterProps {
  baseUrl?: string
  apiKey?: string
}

export function McpTester({ baseUrl = "/api/mcp", apiKey = "" }: McpTesterProps) {
  const [requestBody, setRequestBody] = useState(
    JSON.stringify(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "list_profiles",
        params: {},
      },
      null,
      2
    )
  )
  const [response, setResponse] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSend = async () => {
    setIsLoading(true)
    setResponse("")

    try {
      const parsed = JSON.parse(requestBody)
      const result = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey ? `Bearer ${apiKey}` : "",
        },
        body: JSON.stringify(parsed),
      })

      const data = await result.json()
      setResponse(JSON.stringify(data, null, 2))
    } catch (error) {
      setResponse(
        JSON.stringify(
          { error: error instanceof Error ? error.message : "Request failed" },
          null,
          2
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const copyResponse = () => {
    navigator.clipboard.writeText(response)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exampleRequests = [
    {
      name: "List Profiles",
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "list_profiles",
        params: {},
      },
    },
    {
      name: "List Agents",
      body: {
        jsonrpc: "2.0",
        id: 2,
        method: "list_agents",
        params: {},
      },
    },
    {
      name: "Create Agent",
      body: {
        jsonrpc: "2.0",
        id: 3,
        method: "create_agent",
        params: {
          profile_id: "profile_123",
          name: "My Agent",
          type: "TEXT_POST",
          platforms: ["X", "LINKEDIN"],
        },
      },
    },
    {
      name: "Run Agent",
      body: {
        jsonrpc: "2.0",
        id: 4,
        method: "run_agent",
        params: {
          agent_id: "agent_123",
          brief: "Write about our new product launch",
        },
      },
    },
    {
      name: "Get Run Status",
      body: {
        jsonrpc: "2.0",
        id: 5,
        method: "get_run_status",
        params: {
          run_id: "run_123",
        },
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {exampleRequests.map((example) => (
          <button
            key={example.name}
            onClick={() =>
              setRequestBody(JSON.stringify(example.body, null, 2))
            }
            className="px-2 py-1 text-caption bg-surface-strong rounded hover:bg-hairline transition-colors text-left"
          >
            {example.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-caption font-medium mb-2">Request</label>
          <textarea
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
            className="w-full h-64 px-3 py-2 bg-surface-dark text-on-dark rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder='{"jsonrpc": "2.0", ...}'
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-caption font-medium">Response</label>

            {response && (
              <Button
                variant="ghost"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={copyResponse}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            )}
          </div>

          <div
            className={`w-full h-64 px-3 py-2 rounded font-mono text-sm overflow-auto ${
              response
                ? response.includes("error")
                  ? "bg-surface-card border border-semantic-error/30 text-semantic-error"
                  : "bg-surface-dark text-on-dark"
                : "bg-surface-dark/50 text-muted"
            }`}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-on-dark/30 border-t-on-dark rounded-full animate-spin" />
                <span>Sending request...</span>
              </div>
            ) : response ? (
              response
            ) : (
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Response will appear here</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <Button
        onClick={handleSend}
        disabled={isLoading}
        icon={Play}
        iconPosition="right"
        className="w-full"
      >
        {isLoading ? "Sending..." : "Send Request"}
      </Button>
    </div>
  )
}