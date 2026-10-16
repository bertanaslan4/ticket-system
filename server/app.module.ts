import {MailModule} from './mail/mail.module.js';
import {StorageModule} from './storage/storage.module.js';
import { Module, DynamicModule } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { TicketsModule } from "./tickets/tickets.module.js";
import { OrganizationsModule } from "./organizations/organizations.module.js";
import { UsersModule } from "./users/users.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { HealthController } from "./health.controller.js";
import { ProductsModule } from './products/products.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { OperationsModule } from './operations/operations.module.js';
import { BillingModule } from './billing/billing.module.js';
import { KnowledgeBaseModule } from './kb/kb.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { WidgetModule } from './widget/widget.module.js';
@Module({})
export class AppModule {
  static register(db: any): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DatabaseModule.register(db),
        AuthModule,
        MailModule,
        StorageModule,
        TicketsModule,
        OrganizationsModule,
        ProductsModule,
        TenantsModule,
        OperationsModule,
        BillingModule,
        KnowledgeBaseModule,
        TasksModule,
        IntegrationsModule,
        WidgetModule,
        UsersModule,
        ReportsModule,
        AuditModule,
      ],
      controllers: [HealthController],
    };
  }
}
