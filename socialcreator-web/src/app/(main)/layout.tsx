import { Menu } from "lucide-react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check if user has accepted CGU
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { cguAccepted: true, name: true, image: true },
  });

  if (!user?.cguAccepted) {
    redirect("/onboarding/cgu");
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar user={session.user} />
      <main className="lg:pl-[256px]">
        {/* Mobile header */}
        <header className="lg:hidden h-16 flex items-center gap-4 px-4 border-b border-hairline bg-canvas sticky top-0 z-30">
          <Menu className="w-6 h-6 text-ink" />
          <span className="font-display text-title-md text-ink">SocialCreator</span>
        </header>
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
