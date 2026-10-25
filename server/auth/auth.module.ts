import { Global, Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { SessionGuard } from "./session.guard.js";
import { AdminGuard } from "./admin.guard.js";
import { PlatformAdminGuard } from "./platform-admin.guard.js";
import { TenantContextInterceptor } from "./tenant-context.interceptor.js";
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminGuard,
    PlatformAdminGuard,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
  exports: [AuthService, AdminGuard, PlatformAdminGuard],
})
export class AuthModule {}
