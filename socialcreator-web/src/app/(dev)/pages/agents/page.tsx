import { notFound } from "next/navigation";
import { DevBadge } from "@/components/dev/DevBadge";

const mockAgents = [
  {
    id: "agent-1",
    name: "Content Generator",
    type: "CONTENT",
    platforms: ["INSTAGRAM", "X", "LINKEDIN"],
    prompt:
      "You are a social media content creator. Generate engaging posts based on the user's brief. Adapt tone and format for each platform.",
    temperature: 0.7,
    maxTokens: 1024,
  },
  {
    id: "agent-2",
    name: "Thread Writer",
    type: "THREAD",
    platforms: ["X", "THREADS"],
    prompt:
      "Create a compelling thread based on the brief. Start with a hook, deliver value in each tweet, and end with a CTA. Use short, punchy sentences.",
    temperature: 0.8,
    maxTokens: 2048,
  },
  {
    id: "agent-3",
    name: "Video Scriptwriter",
    type: "SCRIPT",
    platforms: ["YOUTUBE", "TIKTOK"],
    prompt:
      "Write a video script based on the brief. Include intro hook, main content sections with timestamps, and outro CTA. Keep it conversational.",
    temperature: 0.6,
    maxTokens: 4096,
  },
] as const;

export default function AgentsPlaygroundPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-display-md text-ink">Agent Playground</h1>
        <DevBadge />
      </div>

      <p className="text-body-md text-muted mb-8 max-w-2xl">
        Inspect agent configurations, prompts, and platform targeting. These are mock agents for
        development purposes.
      </p>

      <div className="space-y-6">
        {mockAgents.map((agent) => (
          <div key={agent.id} className="rounded-xl border border-hairline bg-surface-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-title-sm text-ink">{agent.name}</h2>
                <span className="text-caption text-muted">{agent.type}</span>
              </div>
              <div className="flex gap-1.5">
                {agent.platforms.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-canvas-soft px-2.5 py-0.5 text-caption text-muted"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <span className="text-caption-uppercase text-muted block mb-2">System Prompt</span>
              <pre className="rounded-lg bg-ink p-4 text-body-sm text-on-dark overflow-x-auto whitespace-pre-wrap">
                {agent.prompt}
              </pre>
            </div>

            <div className="flex gap-6 text-caption">
              <div>
                <span className="text-muted block">Temperature</span>
                <span className="text-body-strong">{agent.temperature}</span>
              </div>
              <div>
                <span className="text-muted block">Max tokens</span>
                <span className="text-body-strong">{agent.maxTokens.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
