/**
 * User Repository
 * Interface + Prisma Implementation
 */

import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Repository Interface
// ============================================

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserInput): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  updateCguAcceptance(id: string): Promise<User>;
}

export interface CreateUserInput {
  email: string;
  name?: string;
  image?: string;
  password?: string;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async create(data: CreateUserInput): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name ?? null,
        image: data.image ?? null,
        password: data.password ?? null,
      },
    });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  }

  async updateCguAcceptance(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        cguAccepted: true,
        cguAcceptedAt: new Date(),
      },
    });
  }
}
