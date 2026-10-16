import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { languageOf, translate } from "../shared/i18n.js";

export async function createApp(db: any, { frontend = false } = {}) {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(db),
    { bodyParser: false, logger: false, abortOnError: false },
  );
  app.disable("x-powered-by");
  // Behind a reverse proxy set TRUST_PROXY (hop count, e.g. 1) so rate limits see real client IPs.
  if (process.env.TRUST_PROXY)
    app.set(
      "trust proxy",
      /^\d+$/.test(process.env.TRUST_PROXY)
        ? Number(process.env.TRUST_PROXY)
        : process.env.TRUST_PROXY,
    );
  app.setGlobalPrefix("api");
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === "production"
          ? { directives: { imgSrc: ["'self'", "data:", "blob:"] } }
          : false,
    }),
  );
  app.use("/api", (req, res, next) => {
    const language = languageOf(req.headers["accept-language"]);
    res.set("Content-Language", language);
    res.vary("Accept-Language");
    res.set("Cache-Control", "no-store");
    const json = res.json.bind(res);
    res.json = (body) =>
      typeof body?.error === "string"
        ? json({
            ...body,
            error: translate(body.error, body.errorParams || {}, language),
            errorKey: body.error,
            errorParams: body.errorParams || {},
          })
        : json(body);
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== (process.env.APP_ORIGIN || "http://localhost:3000")
    )
      return res.status(403).json({ error: "request_origin_is_not_allowed" });
    next();
  });
  app.use('/api/admin/storage', rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'storage_rate_limit'}}));
  const parseJson = express.json({ limit: "64kb" });
  app.use((req, res, next) => parseJson(req, res, (error) => {
    if (!error) return next();
    if (error.type === 'entity.parse.failed') return res.status(400).json({error:'invalid_json_data'});
    if (error.type === 'entity.too.large') return res.status(413).json({error:'request_payload_is_too_large'});
    return next(error);
  }));
  app.use(
    "/api/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "too_many_sign_in_attempts_please_try_again_later" },
    }),
  );
  // Public self-service, account recovery and billing webhook endpoints are unauthenticated,
  // so each gets its own per-IP budget (invite codes in particular must not be brute-forced).
  const publicLimit = (windowMs: number, limit: number) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "too_many_requests_please_try_again_later" },
    });
  app.use("/api/public/signup", publicLimit(60 * 60 * 1000, 10));
  app.use("/api/public/join", publicLimit(15 * 60 * 1000, 20));
  app.use("/api/public/forgot-password", publicLimit(15 * 60 * 1000, 5));
  app.use("/api/public/reset-password", publicLimit(15 * 60 * 1000, 10));
  app.use("/api/public/verify-email", publicLimit(15 * 60 * 1000, 20));
  app.use("/api/me/verify-email/resend", publicLimit(15 * 60 * 1000, 5));
  app.use("/api/webhooks", publicLimit(60 * 1000, 120));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.use('/api/me/password', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'password_change_rate_limit' } }));
  if (frontend) {
    if (
      existsSync("dist/index.html") &&
      process.env.VITE_DEV_SERVER !== "true"
    ) {
      app.use(express.static(resolve("dist")));
      app.use((req, res, next) => {
        if (req.method === "GET" && !/^\/api(?:\/|$)/.test(req.path))
          return res.sendFile(resolve("dist/index.html"));
        next();
      });
    } else {
      const { createServer } = await import("vite");
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use((req, res, next) =>
        /^\/api(?:\/|$)/.test(req.url)
          ? next()
          : vite.middlewares(req, res, next),
      );
      const close = app.close.bind(app);
      app.close = async () => {
        await vite.close();
        await close();
      };
    }
  }
  await app.init();
  return app;
}
