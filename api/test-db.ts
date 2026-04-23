import { supabase } from "../lib/supabaseClient";
import type { Request, Response } from "express";

/**
 * Test endpoint to verify Supabase connection
 * Usage: GET /api/test-db
 */
export default async function handler(req: Request, res: Response) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data, error } = await supabase.from("leads").select("*").limit(10);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error,
      });
    }

    return res.status(200).json({
      success: true,
      count: data?.length || 0,
      data,
      message: "Supabase connection successful",
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error occurred",
    });
  }
}
