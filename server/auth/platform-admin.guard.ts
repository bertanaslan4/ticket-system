import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { fail } from "../common/domain.js";
import { isPlatformAdmin } from "../common/tenant-context.js";

// Routes that act across all tenants (tenant management, global storage settings).
// Marks the request so TenantContextInterceptor leaves its queries unfiltered.
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!isPlatformAdmin(req.user))
      fail(403, "this_area_is_restricted_to_platform_admins");
    req.platformScope = true;
    return true;
  }
}
