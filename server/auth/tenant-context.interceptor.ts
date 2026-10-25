import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { runWithTenant } from "../common/tenant-context.js";

// Runs the handler of a signed-in request inside its tenant, so DatabaseService applies RLS to it.
// Guards run before interceptors, so req.user and req.platformScope are already set here.
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== "http") return next.handle();
    const req = context.switchToHttp().getRequest();
    const tenantId = Number(req.user?.tenant_id);
    if (!tenantId || req.platformScope) return next.handle();
    return new Observable((subscriber) =>
      runWithTenant(tenantId, () => next.handle().subscribe(subscriber)),
    );
  }
}
