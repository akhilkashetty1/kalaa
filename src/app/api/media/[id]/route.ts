import { mediaResponse, readMedia } from "@/server/media";

// A library image, for the live site and the editor preview. Public on purpose: it is the picture on a
// public web page. Works on every host because /api is outside the tenant rewrite. The id is a random
// UUID, so only images that a page actually uses are ever requested.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const found = await readMedia(id);
  return found ? mediaResponse(found, found.object) : new Response("Not found", { status: 404 });
}
