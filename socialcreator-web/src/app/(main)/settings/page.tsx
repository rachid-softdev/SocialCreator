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

  const breadcrumbItems = [{ label: "Paramètres" }];

  const settingsSections = [
    {
      title: "Compte",
      description: "Gérez vos informations personnelles et votre compte",
      icon: User,
      href: "/settings/account",
      comingSoon: true,
    },
    {
      title: "Profils & Comptes sociaux",
      description: "Gérez vos profils de marque et comptes sociaux connectés",
      icon: Link2,
      href: "/profiles",
    },
    {
      title: "Équipes",
      description: "Collaborez avec votre équipe et gérez les accès",
      icon: Users,
      href: "/settings/teams",
    },
    {
      title: "Abonnement",
      description: "Gérez votre abonnement et vos facturations",
      icon: CreditCard,
      href: "/settings/billing",
      comingSoon: true,
    },
    {
      title: "Notifications",
      description: "Configurez vos préférences de notification",
      icon: Bell,
      href: "/settings/notifications",
    },
    {
      title: "Sécurité",
      description: "Gérez la sécurité de votre compte",
      icon: Shield,
      href: "/settings/security",
      comingSoon: true,
    },
    {
      title: "Aide & Support",
      description: "Obtenez de l'aide et contactez le support",
      icon: HelpCircle,
      href: "/settings/help",
      comingSoon: true,
    },
  ];

  return (
    <div className="container max-w-4xl">
      <Breadcrumb items={breadcrumbItems} />

      <PageHeader title="Paramètres" description="Gérez vos préférences et votre compte" />

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
                <span className="text-caption text-muted-soft">Bientôt disponible</span>
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
        <h3 className="text-title-sm text-ink mb-2">Statistiques</h3>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-4 bg-surface-strong rounded-lg">
            <p className="text-display-sm text-ink">{profilesCount}</p>
            <p className="text-caption text-muted mt-1">Profils</p>
          </div>
        </div>
      </div>
    </div>
  );
}
