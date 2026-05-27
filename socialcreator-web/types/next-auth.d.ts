import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      cguAccepted: boolean;
      role: "USER" | "ADMIN";
      roles: ("USER" | "ADMIN")[];
    };
  }
  interface User {
    cguAccepted?: boolean;
    role: "USER" | "ADMIN";
    roles?: ("USER" | "ADMIN")[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    cguAccepted: boolean;
    role: "USER" | "ADMIN";
    roles: ("USER" | "ADMIN")[];
  }
}
