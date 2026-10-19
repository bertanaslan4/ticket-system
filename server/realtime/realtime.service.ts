import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

export interface RealtimeClient {
  tenantId: number;
  userId: number;
  res: any;
  connectedAt: Date;
}

export function isPremiumTier(tier?: string): boolean {
  // Pro and Enterprise are premium tiers with real-time SSE streaming enabled
  return tier === "pro" || tier === "enterprise";
}

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  // Map of tenantId -> Set of client response objects
  private readonly clients = new Map<number, Set<RealtimeClient>>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private readonly database: DatabaseService) {
    // Send keep-alive heartbeat comment every 25 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 25000);
  }

  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    // Close all open connections
    for (const [tenantId, clientSet] of this.clients.entries()) {
      for (const client of clientSet) {
        try {
          client.res.end();
        } catch {}
      }
      clientSet.clear();
    }
    this.clients.clear();
  }

  addClient(tenantId: number, userId: number, res: any) {
    if (!this.clients.has(tenantId)) {
      this.clients.set(tenantId, new Set());
    }
    const client: RealtimeClient = {
      tenantId,
      userId,
      res,
      connectedAt: new Date(),
    };
    this.clients.get(tenantId)!.add(client);
    this.logger.log(`SSE client connected: tenant=${tenantId}, user=${userId}. Total in tenant: ${this.clients.get(tenantId)!.size}`);
  }

  removeClient(tenantId: number, res: any) {
    const clientSet = this.clients.get(tenantId);
    if (!clientSet) return;

    for (const client of clientSet) {
      if (client.res === res) {
        clientSet.delete(client);
        break;
      }
    }

    if (clientSet.size === 0) {
      this.clients.delete(tenantId);
    }
  }

  getClientCount(tenantId?: number): number {
    if (tenantId !== undefined) {
      return this.clients.get(tenantId)?.size || 0;
    }
    let total = 0;
    for (const set of this.clients.values()) {
      total += set.size;
    }
    return total;
  }

  broadcastToTenant(tenantId: number, event: string, data: any) {
    const clientSet = this.clients.get(tenantId);
    if (!clientSet || clientSet.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify({ ...data, timestamp: new Date().toISOString() })}\n\n`;

    const deadClients: RealtimeClient[] = [];
    for (const client of clientSet) {
      try {
        client.res.write(payload);
      } catch (err: any) {
        this.logger.warn(`Failed to write to SSE client: ${err.message}`);
        deadClients.push(client);
      }
    }

    // Clean up disconnected clients
    for (const dead of deadClients) {
      clientSet.delete(dead);
    }
  }

  private sendHeartbeat() {
    const comment = `: heartbeat\n\n`;
    for (const [tenantId, clientSet] of this.clients.entries()) {
      const deadClients: RealtimeClient[] = [];
      for (const client of clientSet) {
        try {
          client.res.write(comment);
        } catch {
          deadClients.push(client);
        }
      }
      for (const dead of deadClients) {
        clientSet.delete(dead);
      }
    }
  }
}
