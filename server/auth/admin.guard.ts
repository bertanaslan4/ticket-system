import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { fail } from "../common/domain.js";
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== "super_admin")
      fail(403, "this_area_is_restricted_to_super_admins");
    return true;
  }
}
