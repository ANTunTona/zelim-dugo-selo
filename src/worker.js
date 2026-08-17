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
      if (
        /^\/api\/proposals\/\d+\/support$/.test(url.pathname) &&
        request.method === "POST"
        ) {
        return supportProposal(env, url);
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