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