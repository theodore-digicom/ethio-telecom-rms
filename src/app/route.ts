import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

export function GET() {
  try {
    const htmlPath = join(process.cwd(), "src/app/page.html");
    const html = readFileSync(htmlPath, "utf-8");
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    // Fallback if HTML not found
    return new Response(
      `<!DOCTYPE html><html><head><title>API</title></head><body><h1>Ethio Telecom RMS API</h1><p>Documentation loading...</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
