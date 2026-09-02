import { createFileRoute } from "@tanstack/react-router";
import { describeDatabaseUrl, resolveDatabaseUrl } from "@/lib/pg-url";
import { bootstrapCareerSparks } from "@/lib/survey/bootstrap";

export const Route = createFileRoute("/api/setup")({
  server: {
    handlers: {
      GET: async () => {
        const url = resolveDatabaseUrl();
        return Response.json({
          ready: Boolean(url),
          ...describeDatabaseUrl(url),
        });
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
          const url = resolveDatabaseUrl();
          const info = describeDatabaseUrl(url);
          console.error("[setup]", err, info);
          return Response.json({ error: true, message, ...info }, { status: 400 });
        }
      },
    },
  },
});
