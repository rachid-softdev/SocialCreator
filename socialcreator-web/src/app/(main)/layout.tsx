import { redirect } from "next/navigation";
import { MobileHeader } from "@/components/layout/mobile-header";
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

  // Check if user has at least one profile
  const profileCount = await prisma.profile.count({
    where: { userId: session.user.id },
  });

  if (profileCount === 0) {
    redirect("/onboarding/profile");
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar (hidden on mobile) */}
      <div className="hidden lg:block">
        <Sidebar user={session.user} />
      </div>

      <main className="lg:pl-[256px]">
        {/* Mobile header with drawer */}
        <MobileHeader user={user} />
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
