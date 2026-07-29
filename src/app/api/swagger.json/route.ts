import { readFileSync } from "fs";
import { join } from "path";

export const GET = () => {
  const spec = readFileSync(join(process.cwd(), "public/openapi.json"), "utf-8");
  return new Response(spec, {
    headers: { "Content-Type": "application/json" },
  });
};
