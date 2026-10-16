import { Controller, Post, Get, Put, Body, Req, UseGuards, HttpCode } from "@nestjs/common";
import { AiService } from "./ai.service.js";
import { DatabaseService } from "../database/database.service.js";
import { AdminGuard } from "../auth/admin.guard.js";
import { fail } from "../common/domain.js";

@Controller("ai")
export class AiController {
  constructor(
    private readonly service: AiService,
    private readonly database: DatabaseService,
  ) {}

  @Post("triage")
  @HttpCode(200)
  async triage(@Body() body: any, @Req() req: any) {
    const tenantId = req.user?.tenant_id || 1;
    return this.service.triage({
      title: String(body?.title || ""),
      description: String(body?.description || ""),
      tenant_id: tenantId,
    });
  }

  @Post("draft")
  @HttpCode(200)
  async draft(@Body() body: any, @Req() req: any) {
    if (!body?.ticket_id) fail(400, "invalid_ticket");
    // Only internal support staff (dealer, contractor, support, admin) can generate response drafts
    if (req.user?.role === "customer") {
      fail(403, "only_staff_can_generate_ai_drafts");
    }
    return this.service.generateDraft(String(body.ticket_id), req.user, {
      type: body.type,
      tone: body.tone,
      customInstruction: body.customInstruction,
    });
  }

  @Get("config")
  async getConfig(@Req() req: any) {
    const tenantId = req.user?.tenant_id || 1;
    const row = (
      await this.database.query(
        "SELECT ai_copilot_enabled, ai_auto_triage, ai_tone FROM tenants WHERE id=$1",
        [tenantId],
      )
    ).rows[0];
    return {
      ai_copilot_enabled: row?.ai_copilot_enabled ?? true,
      ai_auto_triage: row?.ai_auto_triage ?? true,
      ai_tone: row?.ai_tone ?? "professional",
    };
  }

  @Put("config")
  @HttpCode(200)
  @UseGuards(AdminGuard)
  async updateConfigPut(@Body() body: any, @Req() req: any) {
    return this.handleUpdateConfig(body, req);
  }

  @Post("config")
  @HttpCode(200)
  @UseGuards(AdminGuard)
  async updateConfigPost(@Body() body: any, @Req() req: any) {
    return this.handleUpdateConfig(body, req);
  }

  private async handleUpdateConfig(body: any, req: any) {
    const tenantId = req.user?.tenant_id || 1;
    const enabled = body.ai_copilot_enabled !== false;
    const autoTriage = body.ai_auto_triage !== false;
    const tone = ["professional", "friendly", "concise"].includes(body.ai_tone)
      ? body.ai_tone
      : "professional";

    await this.database.query(
      "UPDATE tenants SET ai_copilot_enabled=$1, ai_auto_triage=$2, ai_tone=$3 WHERE id=$4",
      [enabled, autoTriage, tone, tenantId],
    );

    return { ok: true, ai_copilot_enabled: enabled, ai_auto_triage: autoTriage, ai_tone: tone };
  }
}
