import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const admin = await prisma.user.create({
      data: {
        email: "admin@socialcreator.com",
        name: "Admin",
        role: "ADMIN",
        userRoles: {
          create: [{ role: "ADMIN" }, { role: "USER" }],
        },
      },
    });
    console.log("Admin user created:", admin.email);
  } else {
    console.log("Users already exist, skipping seed");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
