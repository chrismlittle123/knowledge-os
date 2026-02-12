import type { FastifyInstance } from 'fastify';
import { parsePlan } from '@fabrica/core';
import * as db from './db.js';
import { spawnContainer } from './container.js';

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fabrica Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
    h1 { color: #58a6ff; margin-bottom: 20px; }
    h2 { color: #8b949e; margin: 20px 0 10px; font-size: 14px; text-transform: uppercase; }
    .container { max-width: 1200px; margin: 0 auto; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #21262d; }
    th { color: #8b949e; font-weight: 500; }
    .status { padding: 2px 8px; border-radius: 12px; font-size: 12px; }
    .status-running { background: #1f6feb33; color: #58a6ff; }
    .status-completed { background: #23863533; color: #3fb950; }
    .status-failed { background: #f8514933; color: #f85149; }
    .status-escalated { background: #d29922; color: #0d1117; }
    .status-pending { background: #30363d; color: #8b949e; }
    .type { padding: 2px 6px; border-radius: 4px; font-size: 11px; }
    .type-progress { background: #1f6feb33; color: #58a6ff; }
    .type-error { background: #f8514933; color: #f85149; }
    .type-completion { background: #23863533; color: #3fb950; }
    .type-escalation { background: #d2992233; color: #d29922; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .time { color: #8b949e; font-size: 12px; }
    .refresh { color: #8b949e; font-size: 12px; margin-left: 10px; }
    .message-content { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .stats { display: flex; gap: 20px; }
    .stat { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px 20px; }
    .stat-value { font-size: 24px; font-weight: 600; color: #58a6ff; }
    .stat-label { font-size: 12px; color: #8b949e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Fabrica Dashboard</h1>
      <div class="stats">
        <div class="stat">
          <div class="stat-value" id="total-sessions">-</div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="running-count">-</div>
          <div class="stat-label">Running</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="completed-count">-</div>
          <div class="stat-label">Completed</div>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Sessions <span class="refresh" id="sessions-refresh"></span></h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Repo</th>
              <th>Status</th>
              <th>PR</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody id="sessions-table"></tbody>
        </table>
      </div>

      <div class="card">
        <h2>Recent Messages <span class="refresh" id="messages-refresh"></span></h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Session</th>
              <th>Type</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody id="messages-table"></tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    function formatTime(dateStr) {
      const d = new Date(dateStr);
      return d.toLocaleTimeString();
    }

    function formatDate(dateStr) {
      const d = new Date(dateStr);
      return d.toLocaleString();
    }

    function shortId(id) {
      return id.slice(0, 8);
    }

    function shortRepo(url) {
      return url.replace('https://github.com/', '').replace('.git', '');
    }

    async function fetchData() {
      try {
        const [sessionsRes, messagesRes] = await Promise.all([
          fetch('/sessions'),
          fetch('/messages')
        ]);

        const sessions = await sessionsRes.json();
        const messages = await messagesRes.json();

        // Update stats
        document.getElementById('total-sessions').textContent = sessions.count;
        document.getElementById('running-count').textContent =
          sessions.sessions.filter(s => s.status === 'running').length;
        document.getElementById('completed-count').textContent =
          sessions.sessions.filter(s => s.status === 'completed').length;

        // Update sessions table
        const sessionsHtml = sessions.sessions.map(s => \`
          <tr>
            <td><code>\${shortId(s.sessionId)}</code></td>
            <td>\${shortRepo(s.repoUrl)}</td>
            <td><span class="status status-\${s.status}">\${s.status}</span></td>
            <td>\${s.prUrl ? \`<a href="\${s.prUrl}" target="_blank">PR</a>\` : '-'}</td>
            <td class="time">\${formatDate(s.createdAt)}</td>
          </tr>
        \`).join('');
        document.getElementById('sessions-table').innerHTML = sessionsHtml || '<tr><td colspan="5">No sessions</td></tr>';
        document.getElementById('sessions-refresh').textContent = 'Updated ' + formatTime(new Date());

        // Update messages table
        const messagesHtml = messages.messages.slice(0, 20).map(m => \`
          <tr>
            <td class="time">\${formatTime(m.createdAt)}</td>
            <td><code>\${shortId(m.sessionId)}</code></td>
            <td><span class="type type-\${m.type}">\${m.type}</span></td>
            <td class="message-content">\${m.content?.message || '-'}</td>
          </tr>
        \`).join('');
        document.getElementById('messages-table').innerHTML = messagesHtml || '<tr><td colspan="4">No messages</td></tr>';
        document.getElementById('messages-refresh').textContent = 'Updated ' + formatTime(new Date());

      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    }

    // Initial fetch
    fetchData();

    // Poll every 2 seconds
    setInterval(fetchData, 2000);
  </script>
</body>
</html>`;

export async function registerRoutes(server: FastifyInstance): Promise<void> {
  // Dashboard
  server.get('/', async (_request, reply) => {
    return reply.type('text/html').send(DASHBOARD_HTML);
  });

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // List all sessions
  server.get('/sessions', async () => {
    const sessions = await db.getAllSessions();
    return {
      count: sessions.length,
      sessions: sessions.map((s) => ({
        sessionId: s.id,
        repoUrl: s.repoUrl,
        branchName: s.branchName,
        prUrl: s.prUrl,
        status: s.status,
        createdAt: s.createdAt,
        completedAt: s.completedAt,
      })),
    };
  });

  // List all messages (for dashboard)
  server.get('/messages', async () => {
    const messages = await db.getAllMessages();
    return {
      count: messages.length,
      messages: messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        type: m.type,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  });

  // Submit a plan for execution
  server.post<{
    Body: string;
  }>('/run', {
    config: {
      rawBody: true,
    },
  }, async (request, reply) => {
    const planContent = request.body;

    if (!planContent || typeof planContent !== 'string') {
      return reply.status(400).send({ error: 'Missing plan content. Send markdown as text/plain.' });
    }

    // Parse the plan
    let plan;
    try {
      plan = parsePlan(planContent);
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to parse plan',
        details: error instanceof Error ? error.message : String(error),
      });
    }

    // Create session in database
    const session = await db.createSession(plan.repoUrl);

    // Save the spec
    await db.saveSpec(session.id, planContent);

    // Update status to running
    await db.updateSession(session.id, { status: 'running' });

    // Send initial progress message
    await db.sendMessage(session.id, 'progress', {
      message: 'Session started, spawning container...',
    });

    // Spawn container asynchronously
    spawnContainer(session.id, plan).catch(async (error) => {
      server.log.error({ sessionId: session.id, error }, 'Container spawn failed');
      await db.updateSession(session.id, {
        status: 'failed',
        completedAt: new Date(),
      });
      await db.sendMessage(session.id, 'error', {
        message: error instanceof Error ? error.message : String(error),
      });
    });

    return reply.status(202).send({
      sessionId: session.id,
      status: 'running',
      plan: {
        title: plan.title,
        repoUrl: plan.repoUrl,
      },
    });
  });

  // Get session status
  server.get<{
    Params: { id: string };
  }>('/sessions/:id', async (request, reply) => {
    const { id } = request.params;

    const session = await db.getSession(id);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    return {
      sessionId: session.id,
      repoUrl: session.repoUrl,
      branchName: session.branchName,
      prUrl: session.prUrl,
      status: session.status,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    };
  });

  // Get session messages
  server.get<{
    Params: { id: string };
  }>('/sessions/:id/messages', async (request, reply) => {
    const { id } = request.params;

    const session = await db.getSession(id);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    const messages = await db.getMessages(id);

    return {
      sessionId: id,
      count: messages.length,
      messages: messages.map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        createdAt: m.createdAt,
        readAt: m.readAt,
      })),
    };
  });
}
