import { Global, Module, DynamicModule } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";
@Global()
@Module({})
export class DatabaseModule {
  static register(connection: any): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: "DATABASE", useValue: connection },
        DatabaseService,
      ],
      exports: [DatabaseService],
    };
  }
}
