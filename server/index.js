import "dotenv/config";
import express from "express";
import testDbHandler from "./api/test-db.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Enable JSON parsing
app.use(express.json());

// Basic root route so visiting localhost:3000 doesn't show an error
app.get("/", (req, res) => {
  res.send("Express server is running! Visit /api/test-db to test Supabase.");
});

// Register route inside Express server
app.get("/api/test-db", testDbHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Express server is running on http://localhost:${PORT}`);
});
