/**
 * ConnectedAccount Repository
 * Interface + Prisma Implementation
 *
 * SECURITY: Tokens are automatically encrypted on write and decrypted on read.
 * The encryption/decryption is transparent — callers always see plaintext tokens
 * at the repository boundary.
 */

import type { ConnectedAccount, Platform } from "@prisma/client";
import { decryptOAuthTokens, encryptOAuthTokens } from "@/lib/oauth/encryption";
import { prisma } from "@/lib/prisma";

// ============================================
// Repository Interface
// ============================================

export interface IConnectedAccountRepository {
  findById(id: string): Promise<ConnectedAccount | null>;
  findByProfileId(profileId: string): Promise<ConnectedAccount[]>;
  findByProfileAndPlatform(profileId: string, platform: Platform): Promise<ConnectedAccount | null>;
  findExpiringBefore(date: Date): Promise<ConnectedAccount[]>;
  create(data: CreateConnectedAccountInput): Promise<ConnectedAccount>;
  update(id: string, data: Partial<ConnectedAccount>): Promise<ConnectedAccount>;
  delete(id: string): Promise<void>;
}

export interface CreateConnectedAccountInput {
  profileId: string;
  platform: Platform;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId: string;
  accountName: string;
  accountAvatarUrl?: string;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaConnectedAccountRepository implements IConnectedAccountRepository {
  // ── Private encryption helpers ──────────────────────

  /** Encrypt sensitive fields before storage */
  private encryptSensitive<T extends { accessToken?: string; refreshToken?: string | null }>(
    data: T,
  ): T {
    if (!data.accessToken && !data.refreshToken) return data;

    const encrypted = encryptOAuthTokens(data.accessToken ?? "", data.refreshToken ?? null);

    return {
      ...data,
      accessToken: encrypted.accessToken,
      refreshToken: encrypted.refreshToken,
    };
  }

  /** Decrypt sensitive fields after retrieval */
  private decryptSensitive(account: ConnectedAccount | null): ConnectedAccount | null {
    if (!account) return null;
    if (!account.accessToken) return account;

    try {
      const decrypted = decryptOAuthTokens(account.accessToken, account.refreshToken);

      return {
        ...account,
        accessToken: decrypted.accessToken,
        refreshToken: decrypted.refreshToken ?? account.refreshToken,
      };
    } catch {
      // If decryption fails, return as-is (might be plaintext legacy data)
      return account;
    }
  }

  private decryptSensitiveArray(accounts: ConnectedAccount[]): ConnectedAccount[] {
    return accounts
      .map((a) => this.decryptSensitive(a))
      .filter((a): a is ConnectedAccount => a != null);
  }

  // ── Read methods ──────────────────────

  async findById(id: string): Promise<ConnectedAccount | null> {
    const account = await prisma.connectedAccount.findUnique({ where: { id } });
    return this.decryptSensitive(account);
  }

  async findByProfileId(profileId: string): Promise<ConnectedAccount[]> {
    const accounts = await prisma.connectedAccount.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });
    return this.decryptSensitiveArray(accounts);
  }

  async findByProfileAndPlatform(
    profileId: string,
    platform: Platform,
  ): Promise<ConnectedAccount | null> {
    const account = await prisma.connectedAccount.findUnique({
      where: { profileId_platform: { profileId, platform } },
    });
    return this.decryptSensitive(account);
  }

  async findExpiringBefore(date: Date): Promise<ConnectedAccount[]> {
    const accounts = await prisma.connectedAccount.findMany({
      where: { isActive: true, expiresAt: { lte: date } },
    });
    return this.decryptSensitiveArray(accounts);
  }

  // ── Write methods ──────────────────────

  async create(data: CreateConnectedAccountInput): Promise<ConnectedAccount> {
    const encrypted = this.encryptSensitive({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? null,
    });

    const saved = await prisma.connectedAccount.create({
      data: {
        profileId: data.profileId,
        platform: data.platform,
        accessToken: encrypted.accessToken,
        refreshToken: encrypted.refreshToken ?? null,
        expiresAt: data.expiresAt ?? null,
        accountId: data.accountId,
        accountName: data.accountName,
        accountAvatarUrl: data.accountAvatarUrl ?? null,
      },
    });

    return this.decryptSensitive(saved)!;
  }

  async update(id: string, data: Partial<ConnectedAccount>): Promise<ConnectedAccount> {
    const encrypted = this.encryptSensitive(data);

    const saved = await prisma.connectedAccount.update({
      where: { id },
      data: encrypted as any,
    });

    return this.decryptSensitive(saved)!;
  }

  async delete(id: string): Promise<void> {
    await prisma.connectedAccount.delete({ where: { id } });
  }
}
