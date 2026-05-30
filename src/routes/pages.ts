import type { Context } from "hono";
import type { Env } from "../app";
import { getEventByToken } from "../services/events";

function eventPageHtml(token: string, slotCount: number): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="event-token" content="${token}" />
    <meta name="slot-count" content="${slotCount}" />
    <title>Venn2Meet Event</title>
    <link rel="stylesheet" href="/css/app.css" />
  </head>
  <body>
    <main class="shell event-shell">
      <header class="event-header">
        <h1>Event Grid</h1>
        <p class="muted-copy">Submitted participants: <strong id="submitted-n">0</strong></p>
      </header>

      <section class="legend" aria-label="Legend">
        <span><i class="legend-chip is-perfect"></i> Perfect intersection</span>
        <span><i class="legend-chip is-near-perfect"></i> Near-perfect</span>
        <span><i class="legend-chip is-only-missing-me"></i> Only missing me</span>
        <span><i class="legend-chip is-my-time"></i> My time</span>
      </section>

      <p id="sync-feedback" class="feedback" aria-live="polite"></p>

      <section id="empty-state" class="empty-state" hidden>
        <h2>No perfect overlap yet</h2>
        <p>Try widening your availability or share the link with anyone still missing.</p>
      </section>

      <section class="grid-wrap">
        <div id="event-grid" class="event-grid" role="grid" aria-label="Availability grid"></div>
      </section>
    </main>

    <script type="module">
      import { mountEventApp } from "/js/event-app.js";
      mountEventApp();
    </script>
  </body>
</html>`;
}

export async function eventPageRoute(c: Context<Env>) {
  const token = c.req.param("token");
  const event = await getEventByToken(c.env.DB, token);
  if (!event) {
    return c.text("Event not found", 404);
  }

  return c.html(eventPageHtml(event.publicToken, event.slotCount));
}
