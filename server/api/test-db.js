import supabase from "../lib/supabaseClient.js";

export default async function testDbHandler(req, res) {
  const { data, error } = await supabase
    .from("leads")
    .select("*");

  if (error) {
    return res.status(500).json(error);
  }

  return res.json(data);
}
