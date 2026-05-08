"use client"

import { useState } from "react"
import { User, Key, CreditCard, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SettingsFormProps {
  onSave?: (data: { name: string; email: string }) => Promise<void>
  onDeleteAccount?: () => Promise<void>
}

export function SettingsForm({ onSave, onDeleteAccount }: SettingsFormProps) {
  const [activeTab, setActiveTab] = useState<"general" | "api-keys" | "billing" | "account">("general")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const tabs = [
    { key: "general" as const, label: "General", icon: User },
    { key: "api-keys" as const, label: "API Keys", icon: Key },
    { key: "billing" as const, label: "Billing", icon: CreditCard },
    { key: "account" as const, label: "Account", icon: AlertTriangle },
  ]

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave?.({ name, email })
    } catch (error) {
      console.error("Save error:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDeleteAccount?.()
    } catch (error) {
      console.error("Delete error:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface-card overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-hairline">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-body-sm transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-primary text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "general" && (
          <div className="space-y-4">
            <div>
              <label className="block text-caption font-medium mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-hairline focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-caption font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-hairline focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="your@email.com"
              />
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="mt-4">
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        )}

        {activeTab === "api-keys" && (
          <div>
            <p className="text-body-sm text-muted mb-4">
              Manage your API keys in the{" "}
              <a href="/settings/api-keys" className="text-primary hover:underline">
                API Keys
              </a>{" "}
              section.
            </p>
            <a
              href="/settings/api-keys"
              className="inline-block px-4 py-2 bg-primary text-on-primary rounded-pill text-body-sm"
            >
              Go to API Keys
            </a>
          </div>
        )}

        {activeTab === "billing" && (
          <div>
            <p className="text-body-sm text-muted mb-4">
              Manage your subscription in the{" "}
              <a href="/settings/billing" className="text-primary hover:underline">
                Billing
              </a>{" "}
              section.
            </p>
            <a
              href="/settings/billing"
              className="inline-block px-4 py-2 bg-primary text-on-primary rounded-pill text-body-sm"
            >
              Go to Billing
            </a>
          </div>
        )}

        {activeTab === "account" && (
          <div>
            <div className="rounded-lg bg-semantic-error/10 border border-semantic-error/30 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-semantic-error flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-body-sm font-medium text-semantic-error">
                    Delete account
                  </h4>
                  <p className="text-body-sm text-muted mt-1">
                    This action is irreversible. All your data, profiles, and content
                    will be permanently deleted.
                  </p>

                  {!showDeleteConfirm ? (
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="mt-3"
                    >
                      Delete my account
                    </Button>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <p className="text-body-sm text-semantic-error font-medium">
                        Are you sure? Type DELETE to confirm.
                      </p>
                      <input
                        type="text"
                        placeholder="DELETE"
                        className="w-full px-3 py-2 rounded-lg border border-semantic-error bg-surface-card text-ink"
                      />
                      <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="w-full"
                      >
                        {isDeleting ? "Deleting..." : "Yes, delete everything"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}