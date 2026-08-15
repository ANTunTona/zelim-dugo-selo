"use strict";

const SUPPORT_KEY = "zds.supported.v1";
const VIEWS_KEY = "zds.pageViews.v1";


const categoryIcons = {
  Promet: "🚌",
  Okoliš: "🌳",
  "Djeca i mladi": "🛝",
  "Sport i rekreacija": "🏊",
  Kultura: "🎭",
  "Komunalna infrastruktura": "🛠️",
  Sigurnost: "🛡️",
  Ostalo: "💬"
};

const state = {
  proposals: [],
  search: "",
  category: "all",
  sort: "newest",
  adminStatus: "all",
  adminKey: ""
};

const el = {
  proposalForm: document.querySelector("#proposalForm"),
  proposalText: document.querySelector("#proposalText"),
  proposalCategory: document.querySelector("#proposalCategory"),
  proposalDescription: document.querySelector("#proposalDescription"),
  website: document.querySelector("#website"),
  rulesAccepted: document.querySelector("#rulesAccepted"),
  charCount: document.querySelector("#charCount"),
  proposalList: document.querySelector("#proposalList"),
  approvedCount: document.querySelector("#approvedCount"),
  supportCount: document.querySelector("#supportCount"),
  categoryCount: document.querySelector("#categoryCount"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  sortFilter: document.querySelector("#sortFilter"),
  adminLoginDialog: document.querySelector("#adminLoginDialog"),
  adminPanelDialog: document.querySelector("#adminPanelDialog"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  adminCode: document.querySelector("#adminCode"),
  adminList: document.querySelector("#adminList"),
  adminStatusFilter: document.querySelector("#adminStatusFilter"),
  adminTotal: document.querySelector("#adminTotal"),
  adminPending: document.querySelector("#adminPending"),
  adminApproved: document.querySelector("#adminApproved"),
  adminViews: document.querySelector("#adminViews"),
  toastWrap: document.querySelector("#toastWrap"),
  menuButton: document.querySelector("#menuButton"),
  navLinks: document.querySelector("#navLinks")
};

initialise();

async function initialise() {
  incrementViews();
  populateCategoryFilter();
  bindEvents();

  document.querySelector("#currentYear").textContent =
    new Date().getFullYear();

  el.proposalList.innerHTML =
    '<div class="empty">Učitavanje prijedloga…</div>';

  try {
    await loadPublicProposals();
    renderAll();
  } catch (error) {
    console.error(error);

    el.proposalList.innerHTML =
      '<div class="empty">Prijedloge trenutačno nije moguće učitati.</div>';

    toast(
      error.message || "Učitavanje prijedloga nije uspjelo.",
      "error"
    );
  }
}

function bindEvents() {
  el.proposalText.addEventListener("input", () => {
    el.charCount.textContent = el.proposalText.value.length;
  });

  el.proposalForm.addEventListener("submit", handleProposalSubmit);

  el.searchInput.addEventListener("input", event => {
    state.search = event.target.value
      .trim()
      .toLocaleLowerCase("hr");

    renderPublicProposals();
  });

  el.categoryFilter.addEventListener("change", event => {
    state.category = event.target.value;
    renderPublicProposals();
  });

  el.sortFilter.addEventListener("change", event => {
    state.sort = event.target.value;
    renderPublicProposals();
  });

  document
    .querySelector("#openAdminButton")
    .addEventListener("click", () => {
      el.adminLoginDialog.showModal();
      el.navLinks.classList.remove("open");
    });

  el.adminLoginForm.addEventListener("submit", handleAdminLogin);

  el.adminStatusFilter.addEventListener("change", event => {
    state.adminStatus = event.target.value;
    renderAdmin();
  });

  document
    .querySelector("#exportButton")
    .addEventListener("click", exportJson);

  const resetButton = document.querySelector("#resetButton");

  if (resetButton) {
    resetButton.hidden = true;
  }

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      document
        .querySelector("#" + button.dataset.close)
        .close();
    });
  });

  el.menuButton.addEventListener("click", () => {
    el.navLinks.classList.toggle("open");
  });

  el.navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      el.navLinks.classList.remove("open");
    });
  });
}

async function loadPublicProposals() {
  const response = await fetch("/api/proposals", {
    headers: {
      Accept: "application/json"
    }
  });

  const result = await readJson(response);

  if (!response.ok) {
    throw new Error(
      result.error || "Učitavanje prijedloga nije uspjelo."
    );
  }

  state.proposals = Array.isArray(result)
    ? result.map(proposal =>
        normalizeProposal(proposal, "approved")
      )
    : [];
}

async function handleProposalSubmit(event) {
  event.preventDefault();

  const text = el.proposalText.value.trim();
  const category = el.proposalCategory.value;
  const description =
    el.proposalDescription.value.trim();

  if (el.website.value) {
    toast("Slanje nije uspjelo.", "error");
    return;
  }

  if (text.length < 12) {
    toast(
      "Prijedlog treba imati najmanje 12 znakova.",
      "error"
    );

    el.proposalText.focus();
    return;
  }

  if (!category) {
    toast("Odaberi kategoriju.", "error");
    el.proposalCategory.focus();
    return;
  }

  if (!el.rulesAccepted.checked) {
    toast("Potvrdi pravila zajednice.", "error");
    el.rulesAccepted.focus();
    return;
  }

  const submitButton =
    el.proposalForm.querySelector('[type="submit"]');

  try {
    if (submitButton) {
      submitButton.disabled = true;
    }

    const response = await fetch("/api/proposals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        text,
        category,
        description
      })
    });

    const result = await readJson(response);

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Slanje prijedloga nije uspjelo."
      );
    }

    el.proposalForm.reset();
    el.charCount.textContent = "0";

    toast(
      "Prijedlog je zaprimljen i čeka pregled administratora."
    );
  } catch (error) {
    console.error(error);

    toast(
      error.message ||
        "Dogodila se pogreška pri slanju.",
      "error"
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();

  const adminKey = el.adminCode.value;

  

  el.adminList.innerHTML =
    '<div class="empty">Učitavanje prijedloga…</div>';

  try {
    await loadAdminProposals(adminKey);

    state.adminKey = adminKey;
    state.adminStatus =
      el.adminStatusFilter.value;

    el.adminLoginDialog.close();
    el.adminCode.value = "";

    renderAll();

    el.adminPanelDialog.showModal();
  } catch (error) {
    console.error(error);

    toast(
      error.message ||
        "Administraciju nije moguće učitati.",
      "error"
    );
  }
}

async function loadAdminProposals(
  adminKey = state.adminKey
) {
  const response = await fetch(
    "/api/admin/proposals",
    {
      headers: {
        Accept: "application/json",
        "X-Admin-Key": adminKey
      }
    }
  );

  const result = await readJson(response);

  if (!response.ok) {
    throw new Error(
      result.error ||
        "Učitavanje administracije nije uspjelo."
    );
  }

  state.proposals = Array.isArray(result)
    ? result.map(proposal =>
        normalizeProposal(proposal)
      )
    : [];
}

function renderAll() {
  renderStats();
  renderPublicProposals();
  renderAdmin();
}

function renderStats() {
  const approved = state.proposals.filter(
    proposal => proposal.status === "approved"
  );

  const supports = approved.reduce(
    (sum, proposal) =>
      sum + proposal.support,
    0
  );

  const categories = new Set(
    approved.map(proposal => proposal.category)
  );

  el.approvedCount.textContent =
    approved.length.toLocaleString("hr-HR");

  el.supportCount.textContent =
    supports.toLocaleString("hr-HR");

  el.categoryCount.textContent =
    categories.size.toLocaleString("hr-HR");
}

function renderPublicProposals() {
  const visible = state.proposals
    .filter(
      proposal =>
        proposal.status === "approved"
    )
    .filter(proposal => {
      const searchableText =
        `${proposal.text} ${proposal.description}`
          .toLocaleLowerCase("hr");

      const searchMatch =
        !state.search ||
        searchableText.includes(state.search);

      const categoryMatch =
        state.category === "all" ||
        proposal.category === state.category;

      return searchMatch && categoryMatch;
    });

  visible.sort((a, b) => {
    if (state.sort === "support") {
      return b.support - a.support;
    }

    if (state.sort === "oldest") {
      return (
        new Date(a.createdAt) -
        new Date(b.createdAt)
      );
    }

    return (
      new Date(b.createdAt) -
      new Date(a.createdAt)
    );
  });

  if (!visible.length) {
    el.proposalList.innerHTML =
      '<div class="empty">Nema prijedloga koji odgovaraju odabranim kriterijima.</div>';

    return;
  }

  const supported = loadSupported();

  el.proposalList.innerHTML = visible
    .map(proposal => {
      const alreadySupported =
        supported.includes(proposal.id);

      return `
        <article class="proposal-card">
          <div class="proposal-top">
            <div
              class="proposal-icon"
              aria-hidden="true"
            >
              ${
                categoryIcons[
                  proposal.category
                ] || "💬"
              }
            </div>

            <div>
              <h3>…${escapeHtml(
                proposal.text
              )}</h3>

              <div class="meta">
                <span class="chip">
                  ${escapeHtml(
                    proposal.category
                  )}
                </span>

                <span>
                  ${formatDate(
                    proposal.createdAt
                  )}
                </span>
              </div>
            </div>
          </div>

          <p class="proposal-description">
            ${escapeHtml(
              proposal.description
            )}
          </p>

          <div class="proposal-actions">
            <span class="support-count">
              🤝 ${proposal.support.toLocaleString(
                "hr-HR"
              )} podrški
            </span>

            <button
              class="button button-outline"
              type="button"
              data-support-id="${proposal.id}"
              ${alreadySupported ? "disabled" : ""}
            >
              ${
                alreadySupported
                ? "Podržano ✓"
                : "Podrži"
              }
            </button>
          </div>
        </article>
      `;
    })
    .join("");
    el.proposalList
  .querySelectorAll("[data-support-id]")
  .forEach(button => {
    button.addEventListener("click", () => {
      supportProposal(button.dataset.supportId);
    });
  });
}

async function supportProposal(id) {
  const proposalId = String(id);
  const supported = loadSupported();

  if (supported.includes(proposalId)) {
    toast(
      "Ovaj prijedlog već si podržao u ovom pregledniku.",
      "error"
    );
    return;
  }

  const proposal = state.proposals.find(
    item => item.id === proposalId
  );

  if (!proposal || proposal.status !== "approved") {
    toast("Prijedlog nije dostupan.", "error");
    return;
  }

  const button = el.proposalList.querySelector(
    `[data-support-id="${proposalId}"]`
  );

  try {
    if (button) {
      button.disabled = true;
    }

    const response = await fetch(
      `/api/proposals/${encodeURIComponent(proposalId)}/support`,
      {
        method: "POST",
        headers: {
          Accept: "application/json"
        }
      }
    );

    const result = await readJson(response);

    if (!response.ok) {
      throw new Error(
        result.error || "Podršku nije moguće spremiti."
      );
    }

    proposal.support = Number(result.support || 0);
    supported.push(proposalId);

    localStorage.setItem(
      SUPPORT_KEY,
      JSON.stringify(supported)
    );

    renderStats();
    renderPublicProposals();
    toast("Hvala na podršci!");
  } catch (error) {
    console.error(error);

    if (button) {
      button.disabled = false;
    }

    toast(
      error.message || "Podršku nije moguće spremiti.",
      "error"
    );
  }
}

function renderAdmin() {
  const list = state.proposals.filter(
    proposal => {
      return (
        state.adminStatus === "all" ||
        proposal.status ===
          state.adminStatus
      );
    }
  );

  el.adminTotal.textContent =
    state.proposals.length;

  el.adminPending.textContent =
    state.proposals.filter(
      proposal =>
        proposal.status === "pending"
    ).length;

  el.adminApproved.textContent =
    state.proposals.filter(
      proposal =>
        proposal.status === "approved"
    ).length;

  el.adminViews.textContent = Number(
    localStorage.getItem(VIEWS_KEY) || 0
  );

  if (!list.length) {
    el.adminList.innerHTML =
      '<div class="empty">Nema prijedloga u ovom statusu.</div>';

    return;
  }

  el.adminList.innerHTML = list
    .map(proposal => `
      <article class="admin-item">
        <div>
          <h4>…${escapeHtml(
            proposal.text
          )}</h4>

          <p>
            ${escapeHtml(
              proposal.description
            )}
          </p>

          <p style="margin-top:8px">
            <strong>
              ${escapeHtml(
                proposal.category
              )}
            </strong>
            · ${formatDate(
              proposal.createdAt
            )}
            · ${proposal.support} podrški
          </p>

          <span class="status ${proposal.status}">
            ${statusLabel(
              proposal.status
            )}
          </span>
        </div>

        <div class="admin-actions">
          ${
            proposal.status !== "approved"
              ? `
                <button
                  class="button button-soft"
                  data-action="approve"
                  data-id="${proposal.id}"
                >
                  Odobri
                </button>
              `
              : ""
          }

          ${
            proposal.status !== "rejected"
              ? `
                <button
                  class="button button-outline"
                  data-action="reject"
                  data-id="${proposal.id}"
                >
                  Odbij
                </button>
              `
              : ""
          }
        </div>
      </article>
    `)
    .join("");

  el.adminList
    .querySelectorAll("[data-action]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          adminAction(
            button.dataset.action,
            button.dataset.id
          );
        }
      );
    });
}

async function adminAction(action, id) {
  const statusByAction = {
    approve: "approved",
    reject: "rejected"
  };

  const status = statusByAction[action];

  if (!status || !state.adminKey) {
    return;
  }

  try {
    const response = await fetch(
      `/api/admin/proposals/${encodeURIComponent(
        id
      )}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
          Accept: "application/json",
          "X-Admin-Key":
            state.adminKey
        },
        body: JSON.stringify({
          status
        })
      }
    );

    const result = await readJson(response);

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Promjena statusa nije uspjela."
      );
    }

    await loadAdminProposals();
    renderAll();

    toast(
      status === "approved"
        ? "Prijedlog je odobren."
        : "Prijedlog je odbijen."
    );
  } catch (error) {
    console.error(error);

    toast(
      error.message ||
        "Promjena statusa nije uspjela.",
      "error"
    );
  }
}

function normalizeProposal(
  proposal,
  defaultStatus = "pending"
) {
  return {
    id: String(proposal.id),
    text: String(proposal.text || ""),
    description: String(
      proposal.description || ""
    ),
    category: String(
      proposal.category || "Ostalo"
    ),
    status: String(
      proposal.status || defaultStatus
    ),
    support: Number(
      proposal.support || 0
    ),
    createdAt:
      proposal.createdAt ||
      new Date().toISOString(),
    moderatedAt:
      proposal.moderatedAt || null
  };
}

function populateCategoryFilter() {
  el.categoryFilter.innerHTML =
    '<option value="all">Sve kategorije</option>' +
    Object.keys(categoryIcons)
      .map(category => `
        <option value="${escapeHtml(category)}">
          ${escapeHtml(category)}
        </option>
      `)
      .join("");
}

function loadSupported() {
  try {
    const stored =
      localStorage.getItem(SUPPORT_KEY);

    const parsed = stored
      ? JSON.parse(stored)
      : [];

    return Array.isArray(parsed)
      ? parsed.map(String)
      : [];
  } catch {
    return [];
  }
}

function incrementViews() {
  const current = Number(
    localStorage.getItem(VIEWS_KEY) || 0
  );

  localStorage.setItem(
    VIEWS_KEY,
    String(current + 1)
  );
}

function exportJson() {
  const blob = new Blob(
    [
      JSON.stringify(
        state.proposals,
        null,
        2
      )
    ],
    {
      type: "application/json"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `zelim-dugo-selo-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

  link.click();

  URL.revokeObjectURL(url);

  toast("JSON izvoz je pripremljen.");
}

function statusLabel(status) {
  return {
    pending: "Na čekanju",
    approved: "Odobreno",
    rejected: "Odbijeno"
  }[status] || status;
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "hr-HR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(date);
}

async function readJson(response) {
  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    !contentType.includes(
      "application/json"
    )
  ) {
    return {};
  }

  return response.json();
}

function toast(
  message,
  type = "success"
) {
  const item =
    document.createElement("div");

  item.className =
    `toast ${
      type === "error"
        ? "error"
        : ""
    }`;

  item.textContent = message;

  el.toastWrap.append(item);

  setTimeout(
    () => item.remove(),
    3200
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}