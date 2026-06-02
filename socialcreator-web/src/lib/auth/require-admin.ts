import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AuthError("Non authentifié", 401);
  }

  // Verify role from DATABASE — don't trust cached JWT token
  // JWT roles may be stale if admin was revoked between token refresh cycles
  let dbUser: { role: string | null; email: string } | null;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });
  } catch {
    throw new AuthError("Erreur de vérification administrateur", 500);
  }

  if (!dbUser || dbUser.role !== "ADMIN") {
    throw new AuthError("Accès non autorisé - rôle administrateur requis", 403);
  }

  return {
    id: session.user.id,
    email: dbUser.email ?? "",
  };
}
