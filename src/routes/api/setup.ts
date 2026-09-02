import { createFileRoute } from "@tanstack/react-router";
import { bootstrapCareerSparks } from "@/lib/survey/bootstrap";

export const Route = createFileRoute("/api/setup")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          const owners = await sql<{ n: number }>`select count(*)::int as n from workspace_members where role = ${"owner"}`;
          return Response.json({ installed: (owners[0]?.n ?? 0) > 0 });
        } catch {
          return Response.json({ installed: false });
        }
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            email?: string;
            password?: string;
            name?: string;
          };
          const result = await bootstrapCareerSparks({
            email: body.email || "",
            password: body.password || "",
            name: body.name,
          });
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Install failed.";
          return Response.json({ error: true, message }, { status: 400 });
        }
      },
    },
  },
});
