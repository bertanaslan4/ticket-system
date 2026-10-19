import { Controller, Get, Req, Res, HttpStatus } from "@nestjs/common";
import { RealtimeService, isPremiumTier } from "./realtime.service.js";
import { fail } from "../common/domain.js";

@Controller("realtime")
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Get("status")
  getStatus(@Req() req: any) {
    const user = req.user;
    if (!user) fail(401, "unauthorized");
    const isPremium = isPremiumTier(user.plan_tier);
    return {
      ok: true,
      is_premium: isPremium,
      plan_tier: user.plan_tier || "free",
      active_connections: this.realtimeService.getClientCount(user.tenant_id || 1),
    };
  }

  @Get("stream")
  connectStream(@Req() req: any, @Res() res: any) {
    const user = req.user;
    if (!user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: "unauthorized" });
    }

    // Gated as a Premium feature (Pro & Enterprise plans)
    if (!isPremiumTier(user.plan_tier)) {
      return res.status(HttpStatus.FORBIDDEN).json({
        error: "premium_feature_required",
        message: "Canlı bildirimler Pro ve Enterprise paketlerine özeldir.",
        required_tier: "pro",
        current_tier: user.plan_tier || "free",
      });
    }

    const tenantId = user.tenant_id || 1;

    // Set Server-Sent Events headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    // Send initial handshake
    const handshake = {
      type: "handshake",
      connected: true,
      tenant_id: tenantId,
      user_id: user.id,
      plan_tier: user.plan_tier,
      time: new Date().toISOString(),
    };
    res.write(`event: connected\ndata: ${JSON.stringify(handshake)}\n\n`);

    // Register active SSE stream
    this.realtimeService.addClient(tenantId, user.id, res);

    req.on("close", () => {
      this.realtimeService.removeClient(tenantId, res);
    });
  }
}
