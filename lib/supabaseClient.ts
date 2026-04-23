import { createClient } from "@supabase/supabase-js";
import { Lead, User, FollowUp, Note } from "../types";
import { type } from "os";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase environment variables are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file"
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

// Type-safe database helper types
type Database = {
  leads: Lead;
  users: User;
  followups: FollowUp;
  notes: Note;
};
