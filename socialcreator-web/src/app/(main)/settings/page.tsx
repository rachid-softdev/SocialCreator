/**
 * Settings Page
 * User settings and preferences
 */

import { Bell, CreditCard, HelpCircle, Link2, Shield, User, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageHeader } from "@/components/layout/page-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get user profiles count for sidebar display
  const profilesCount = await prisma.profile.count({
    where: { userId: session.user.id },
  });

  const breadcrumbItems = [{ label: "Settings" }];

  const settingsSections = [
    {
      title: "Account",
      description: "Manage your personal information and account settings",
      icon: User,
      href: "/settings/account",
      comingSoon: true,
    },
    {
      title: "Profiles & Social Accounts",
      description: "Manage your brand profiles and connected social accounts",
      icon: Link2,
      href: "/profiles",
    },
    {
      title: "Teams",
      description: "Collaborate with your team and manage access",
      icon: Users,
      href: "/settings/teams",
    },
    {
      title: "Billing",
      description: "Manage your subscription and invoices",
      icon: CreditCard,
      href: "/settings/billing",
      comingSoon: true,
    },
    {
      title: "Notifications",
      description: "Configure your notification preferences",
      icon: Bell,
      href: "/settings/notifications",
    },
    {
      title: "Security",
      description: "Manage your account security",
      icon: Shield,
      href: "/settings/security",
      comingSoon: true,
    },
    {
      title: "Help & Support",
      description: "Get help and contact support",
      icon: HelpCircle,
      href: "/settings/help",
      comingSoon: true,
    },
  ];

  return (
    <div className="container max-w-4xl">
      <Breadcrumb items={breadcrumbItems} />

      <PageHeader title="Settings" description="Manage your preferences and account" />

      <div className="mt-8 space-y-4">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          const isComingSoon = section.comingSoon;

          if (isComingSoon) {
            return (
              <div
                key={section.title}
                className="flex items-center gap-4 p-6 bg-surface-card border border-hairline rounded-xl opacity-60"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-strong flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted" />
                </div>
                <div className="flex-1">
                  <h3 className="text-title-sm text-ink">{section.title}</h3>
                  <p className="text-body-sm text-muted mt-0.5">{section.description}</p>
                </div>
                <span className="text-caption text-muted-soft">Coming soon</span>
              </div>
            );
          }

          return (
            <Link
              key={section.title}
              href={section.href}
              className="flex items-center gap-4 p-6 bg-surface-card border border-hairline rounded-xl hover:border-hairline-strong hover:bg-surface-strong/50 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-mint flex items-center justify-center group-hover:scale-105 transition-transform">
                <Icon className="w-5 h-5 text-ink" />
              </div>
              <div className="flex-1">
                <h3 className="text-title-sm text-ink group-hover:text-ink">{section.title}</h3>
                <p className="text-body-sm text-muted mt-0.5">{section.description}</p>
              </div>
              <svg
                className="w-5 h-5 text-muted-soft group-hover:text-muted transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 p-6 bg-surface-card border border-hairline rounded-xl">
        <h3 className="text-title-sm text-ink mb-2">Statistics</h3>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-4 bg-surface-strong rounded-lg">
            <p className="text-display-sm text-ink">{profilesCount}</p>
            <p className="text-caption text-muted mt-1">Profiles</p>
          </div>
        </div>
      </div>
    </div>
  );
}
