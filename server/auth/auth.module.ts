import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { SessionGuard } from "./session.guard.js";
import { AdminGuard } from "./admin.guard.js";
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminGuard,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [AuthService, AdminGuard],
})
export class AuthModule {}
