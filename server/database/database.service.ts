import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";

// A single injectable connection boundary preserves PostgreSQL transactions.
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(@Inject("DATABASE") private readonly connection: any) {}
  query(sql: string, params: any[] = []): Promise<any> {
    return this.connection.query(sql, params);
  }
  transaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
    return this.connection.transaction(work);
  }
  async onModuleDestroy() {
    await this.connection.close();
  }
}
