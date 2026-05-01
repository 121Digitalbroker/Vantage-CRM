import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import testDbHandler from "./api/test-db.js";
import metaWebhookHandler from "./api/meta-webhook.js";
import testEmailHandler from "./api/test-email.js";

const app = express();
const PORT = process.env.PORT || 4000;

const distDir = path.join(process.cwd(), "dist");
const spaIndexPath = path.join(distDir, "index.html");
const serveSpa = fs.existsSync(spaIndexPath);

app.set("trust proxy", 1);

// JSON + preserve raw body for Meta webhook signature verification (X-Hub-Signature-256)
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Register API routes before static / SPA fallback
app.get("/api/test-db", testDbHandler);
app.all("/api/test-email", testEmailHandler);
app.all("/api/meta-webhook", metaWebhookHandler);

if (serveSpa) {
  app.use(express.static(distDir, { index: false }));
  app.get("*", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(spaIndexPath);
  });
} else {
  app.get("/", (req, res) => {
    res.type("text/plain").send(
      "Express API only (no dist/ yet). Run `npm run build` then `npm start`, or use `npm run server` for API-only.\n" +
        "GET /api/test-db — POST /api/test-email — Meta: GET|POST /api/meta-webhook"
    );
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(
    `Express on port ${PORT}${serveSpa ? " (serving SPA from dist/ + /api/*)" : " (API only)"}`
  );
});
