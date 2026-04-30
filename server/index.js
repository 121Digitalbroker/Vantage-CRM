import "dotenv/config";
import express from "express";
import testDbHandler from "./api/test-db.js";
import metaWebhookHandler from "./api/meta-webhook.js";
import testEmailHandler from "./api/test-email.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.set("trust proxy", 1);

// JSON + preserve raw body for Meta webhook signature verification (X-Hub-Signature-256)
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Basic root route (API port is PORT, default 4000)
app.get("/", (req, res) => {
  res.send(
    "Express running! GET /api/test-db — POST /api/test-email — Meta: GET|POST /api/meta-webhook"
  );
});

// Register route inside Express server
app.get("/api/test-db", testDbHandler);
app.all("/api/test-email", testEmailHandler);
app.all("/api/meta-webhook", metaWebhookHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Express server is running on http://localhost:${PORT}`);
});
