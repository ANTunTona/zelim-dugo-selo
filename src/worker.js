const allowedCategories = [
  "Promet",
  "Okoliš",
  "Djeca i mladi",
  "Sport i rekreacija",
  "Kultura",
  "Komunalna infrastruktura",
  "Sigurnost",
  "Ostalo"
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/proposals" && request.method === "GET") {
        return getApprovedProposals(env);
      }

      if (url.pathname === "/api/proposals" && request.method === "POST") {
        return createProposal(request, env);
      }
      if (url.pathname === "/api/visitors" && request.method === "POST") {
        return trackAnonymousVisitor(request, env);
      }

      if (url.pathname === "/api/public-stats" && request.method === "GET") {
        return getPublicStats(env);
      }
      if (
        /^\/api\/proposals\/\d+\/support$/.test(url.pathname) &&
        request.method === "POST"
        ) {
        return supportProposal(env, url);
      }
            if (url.pathname === "/api/admin/stats" && request.method === "GET") {
        return getAdminStats(request, env);
      }

      if (url.pathname === "/api/admin/proposals" && request.method === "GET") {
        return getAdminProposals(request, env);
      }

      if (
        url.pathname.startsWith("/api/admin/proposals/") &&
        request.method === "PATCH"
      ) {
        return updateProposalStatus(request, env, url);
      }
      if (
        url.pathname.startsWith("/api/admin/proposals/") &&
        request.method === "DELETE"
      ) {
        return deleteProposal(request, env, url);
      }
      return new Response("API ruta nije pronađena.", { status: 404 });
    } catch (error) {
      console.error(error);

      return Response.json(
        { error: "Dogodila se neočekivana pogreška." },
        { status: 500 }
      );
    }
  }
};

async function getApprovedProposals(env) {
  const { results } = await env.DB.prepare(`
    SELECT
      id,
      text,
      description,
      category,
      support_count AS support,
      created_at AS createdAt
    FROM proposals
    WHERE status = 'approved'
    ORDER BY datetime(created_at) DESC
  `).all();

  return Response.json(results);
}

async function createProposal(request, env) {
  const body = await request.json();

  const text = String(body.text || "").trim();
  const description = String(body.description || "").trim();
  const category = String(body.category || "").trim();

  if (text.length < 12 || text.length > 300) {
    return Response.json(
      { error: "Prijedlog mora imati između 12 i 300 znakova." },
      { status: 400 }
    );
  }

  if (description.length > 500) {
    return Response.json(
      { error: "Obrazloženje može imati najviše 500 znakova." },
      { status: 400 }
    );
  }

  if (!allowedCategories.includes(category)) {
    return Response.json(
      { error: "Odabrana kategorija nije dopuštena." },
      { status: 400 }
    );
  }

  const result = await env.DB.prepare(`
    INSERT INTO proposals (
      text,
      description,
      category,
      status
    )
    VALUES (?, ?, ?, 'pending')
  `)
    .bind(
      text.replace(/^(\.{3}|…)+/, "").trim(),
      description || null,
      category
    )
    .run();

  return Response.json(
    {
      success: true,
      id: result.meta.last_row_id,
      message: "Prijedlog je zaprimljen i čeka moderiranje."
    },
    { status: 201 }
  );
}


  async function supportProposal(env, url) {
  const pathParts = url.pathname.split("/").filter(Boolean);
  const id = Number(pathParts[2]);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json(
      { error: "Neispravan ID prijedloga." },
      { status: 400 }
    );
  }

  const result = await env.DB.prepare(`
    UPDATE proposals
    SET support_count = support_count + 1
    WHERE id = ? AND status = 'approved'
  `)
    .bind(id)
    .run();

  if (!result.meta.changes) {
    return Response.json(
      { error: "Prijedlog nije pronađen ili nije odobren." },
      { status: 404 }
    );
  }

  const proposal = await env.DB.prepare(`
    SELECT support_count AS support
    FROM proposals
    WHERE id = ?
  `)
    .bind(id)
    .first();

  return Response.json({
    success: true,
    id,
    support: Number(proposal.support || 0)
  });
}

  async function trackAnonymousVisitor(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Neispravan zahtjev." },
      { status: 400 }
    );
  }

  const visitorId = String(body.visitorId || "").trim();

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(visitorId)) {
    return Response.json(
      { error: "Neispravan anonimni identifikator." },
      { status: 400 }
    );
  }

  const encodedId = new TextEncoder().encode(visitorId);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encodedId
  );

  const visitorHash = Array.from(
    new Uint8Array(hashBuffer)
  )
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  await env.DB.prepare(`
    INSERT INTO visitors (
      visitor_hash,
      first_seen,
      last_seen
    )
    VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(visitor_hash)
    DO UPDATE SET last_seen = CURRENT_TIMESTAMP
  `)
    .bind(visitorHash)
    .run();

  return getPublicStats(env);
}

async function getPublicStats(env) {
  const visitorStats = await env.DB.prepare(`
    SELECT COUNT(*) AS uniqueVisitors
    FROM visitors
  `).first();

  const proposalStats = await env.DB.prepare(`
    SELECT
      COUNT(*) AS approvedProposals,
      COALESCE(SUM(support_count), 0) AS totalSupports
    FROM proposals
    WHERE status = 'approved'
  `).first();

  return Response.json({
    uniqueVisitors: Number(
      visitorStats.uniqueVisitors || 0
    ),
    approvedProposals: Number(
      proposalStats.approvedProposals || 0
    ),
    totalSupports: Number(
      proposalStats.totalSupports || 0
    )
  });
}




  function isAdminRequest(request, env) {
  const adminKey = request.headers.get("X-Admin-Key");
  return Boolean(env.ADMIN_KEY) && adminKey === env.ADMIN_KEY;
}



async function deleteProposal(request, env, url) {
  if (!isAdminRequest(request, env)) {
    return Response.json(
      { error: "Neovlašten pristup." },
      { status: 401 }
    );
  }

  const id = Number(url.pathname.split("/").pop());

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json(
      { error: "Neispravan ID prijedloga." },
      { status: 400 }
    );
  }

  const existing = await env.DB.prepare(`
    SELECT id
    FROM proposals
    WHERE id = ?
  `)
    .bind(id)
    .first();

  if (!existing) {
    return Response.json(
      { error: "Prijedlog nije pronađen." },
      { status: 404 }
    );
  }

  await env.DB.prepare(`
    DELETE FROM proposals
    WHERE id = ?
  `)
    .bind(id)
    .run();

  return Response.json({
    success: true,
    id
  });
}
async function getAdminStats(request, env) {
  if (!isAdminRequest(request, env)) {
    return Response.json(
      { error: "Neovlašten pristup." },
      { status: 401 }
    );
  }

  const [proposalStats, visitorStats, categoryResult] = await Promise.all([
    env.DB.prepare(`
      SELECT
        COUNT(*) AS totalProposals,
        COALESCE(
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END),
          0
        ) AS pendingProposals,
        COALESCE(
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END),
          0
        ) AS approvedProposals,
        COALESCE(
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END),
          0
        ) AS rejectedProposals,
        COALESCE(SUM(support_count), 0) AS totalSupports,
        AVG(
          CASE
            WHEN moderated_at IS NOT NULL
            THEN (
              julianday(moderated_at) - julianday(created_at)
            ) * 24
          END
        ) AS averageModerationHours
      FROM proposals
    `).first(),

    env.DB.prepare(`
      SELECT COUNT(*) AS uniqueVisitors
      FROM visitors
    `).first(),

    env.DB.prepare(`
      SELECT
        category,
        COUNT(*) AS total,
        COALESCE(
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END),
          0
        ) AS approved,
        COALESCE(SUM(support_count), 0) AS supports
      FROM proposals
      GROUP BY category
      ORDER BY total DESC, category ASC
    `).all()
  ]);

  const totalProposals = Number(
    proposalStats.totalProposals || 0
  );
  const pendingProposals = Number(
    proposalStats.pendingProposals || 0
  );
  const approvedProposals = Number(
    proposalStats.approvedProposals || 0
  );
  const rejectedProposals = Number(
    proposalStats.rejectedProposals || 0
  );
  const totalSupports = Number(
    proposalStats.totalSupports || 0
  );
  const uniqueVisitors = Number(
    visitorStats.uniqueVisitors || 0
  );
  const moderatedProposals =
    approvedProposals + rejectedProposals;

  const proposalsPer100Visitors = uniqueVisitors > 0
    ? (totalProposals / uniqueVisitors) * 100
    : 0;

  const approvalRate = moderatedProposals > 0
    ? (approvedProposals / moderatedProposals) * 100
    : 0;

  const averageModerationHours =
    proposalStats.averageModerationHours === null
      ? null
      : Number(proposalStats.averageModerationHours);

  return Response.json({
    totalProposals,
    pendingProposals,
    approvedProposals,
    rejectedProposals,
    totalSupports,
    uniqueVisitors,
    proposalsPer100Visitors: Number(proposalsPer100Visitors.toFixed(1)),
    approvalRate: Number(approvalRate.toFixed(1)),
    averageModerationHours:
      averageModerationHours === null
        ? null
        : Number(averageModerationHours.toFixed(1)),
    byCategory: categoryResult.results.map(row => ({
      category: row.category,
      total: Number(row.total || 0),
      approved: Number(row.approved || 0),
      supports: Number(row.supports || 0)
    }))
  });
}

async function getAdminProposals(request, env) {
  if (!isAdminRequest(request, env)) {
    return Response.json(
      { error: "Neovlašten pristup." },
      { status: 401 }
    );
  }

  const { results } = await env.DB.prepare(`
    SELECT
      id,
      text,
      description,
      category,
      status,
      support_count AS support,
      created_at AS createdAt,
      moderated_at AS moderatedAt
    FROM proposals
    ORDER BY datetime(created_at) DESC
  `).all();

  return Response.json(results);
}

async function updateProposalStatus(request, env, url) {
  if (!isAdminRequest(request, env)) {
    return Response.json(
      { error: "Neovlašten pristup." },
      { status: 401 }
    );
  }

  const id = Number(url.pathname.split("/").pop());

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json(
      { error: "Neispravan ID prijedloga." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const status = String(body.status || "").trim();

  if (!["approved", "rejected"].includes(status)) {
    return Response.json(
      { error: "Status mora biti approved ili rejected." },
      { status: 400 }
    );
  }

  const existing = await env.DB.prepare(`
    SELECT id
    FROM proposals
    WHERE id = ?
  `)
    .bind(id)
    .first();

  if (!existing) {
    return Response.json(
      { error: "Prijedlog nije pronađen." },
      { status: 404 }
    );
  }

  await env.DB.prepare(`
    UPDATE proposals
    SET
      status = ?,
      moderated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
    .bind(status, id)
    .run();

  return Response.json({
    success: true,
    id,
    status
  });

}