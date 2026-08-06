"use strict";

    const STORAGE_KEY = "zds.proposals.v1";
    const SUPPORT_KEY = "zds.supported.v1";
    const VIEWS_KEY = "zds.pageViews.v1";
    const ADMIN_CODE = "DS2026";

    const categoryIcons = {
      "Promet": "🚌",
      "Okoliš": "🌳",
      "Djeca i mladi": "🛝",
      "Sport i rekreacija": "🏊",
      "Kultura": "🎭",
      "Komunalna infrastruktura": "🛠️",
      "Sigurnost": "🛡️",
      "Ostalo": "💬"
    };

    const demoProposals = [
      {
        id: crypto.randomUUID(),
        text: "dobije gradski bazen",
        category: "Sport i rekreacija",
        description: "Moderan gradski bazen bio bi koristan za rekreaciju, školu plivanja i sportske klubove.",
        status: "approved",
        support: 128,
        createdAt: "2026-07-20T09:00:00.000Z"
      },
      {
        id: crypto.randomUUID(),
        text: "uredi više dječjih igrališta",
        category: "Djeca i mladi",
        description: "Više sigurnih i modernih igrališta u svim naseljima poboljšalo bi kvalitetu života obitelji.",
        status: "approved",
        support: 94,
        createdAt: "2026-07-22T12:00:00.000Z"
      },
      {
        id: crypto.randomUUID(),
        text: "poboljša autobusne linije",
        category: "Promet",
        description: "Češće linije, bolja povezanost naselja i usklađeniji vozni redovi olakšali bi svakodnevni život.",
        status: "approved",
        support: 73,
        createdAt: "2026-07-24T16:00:00.000Z"
      },
      {
        id: crypto.randomUUID(),
        text: "ima više stabala i hlada u centru",
        category: "Okoliš",
        description: "Više zelenila i hlada učinilo bi centar ugodnijim tijekom ljetnih mjeseci.",
        status: "approved",
        support: 56,
        createdAt: "2026-07-26T10:30:00.000Z"
      }
    ];

    const state = {
      proposals: loadProposals(),
      search: "",
      category: "all",
      sort: "newest",
      adminStatus: "all"
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

    function initialise() {
      incrementViews();
      populateCategoryFilter();
      bindEvents();
      renderAll();
      document.querySelector("#currentYear").textContent = new Date().getFullYear();
    }

    function bindEvents() {
      el.proposalText.addEventListener("input", () => {
        el.charCount.textContent = el.proposalText.value.length;
      });

      el.proposalForm.addEventListener("submit", handleProposalSubmit);

      el.searchInput.addEventListener("input", event => {
        state.search = event.target.value.trim().toLocaleLowerCase("hr");
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

      document.querySelector("#openAdminButton").addEventListener("click", () => {
        el.adminLoginDialog.showModal();
        el.navLinks.classList.remove("open");
      });

      el.adminLoginForm.addEventListener("submit", event => {
        event.preventDefault();

        if (el.adminCode.value !== ADMIN_CODE) {
          toast("Pogrešan demo pristupni kod.", "error");
          return;
        }

        el.adminLoginDialog.close();
        el.adminCode.value = "";
        renderAdmin();
        el.adminPanelDialog.showModal();
      });

      el.adminStatusFilter.addEventListener("change", event => {
        state.adminStatus = event.target.value;
        renderAdmin();
      });

      document.querySelector("#exportButton").addEventListener("click", exportJson);
      document.querySelector("#resetButton").addEventListener("click", resetDemo);

      document.querySelectorAll("[data-close]").forEach(button => {
        button.addEventListener("click", () => {
          document.querySelector("#" + button.dataset.close).close();
        });
      });

      el.menuButton.addEventListener("click", () => {
        el.navLinks.classList.toggle("open");
      });

      el.navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => el.navLinks.classList.remove("open"));
      });
    }

    async function handleProposalSubmit(event) {
  event.preventDefault();

  const text = el.proposalText.value.trim();
  const category = el.proposalCategory.value;
  const description = el.proposalDescription.value.trim();

  if (el.website.value) {
    toast("Slanje nije uspjelo.", "error");
    return;
  }

  if (text.length < 12) {
    toast("Prijedlog treba imati najmanje 12 znakova.", "error");
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

  try {
    const response = await fetch("/api/proposals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        category,
        description
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Slanje prijedloga nije uspjelo.");
    }

    el.proposalForm.reset();
    el.charCount.textContent = "0";

    toast("Prijedlog je zaprimljen i čeka pregled administratora.");
  } catch (error) {
    console.error(error);
    toast(error.message || "Dogodila se pogreška pri slanju.", "error");
  }
}

    function renderAll() {
      renderStats();
      renderPublicProposals();
      renderAdmin();
    }

    function renderStats() {
      const approved = state.proposals.filter(p => p.status === "approved");
      const supports = approved.reduce((sum, p) => sum + p.support, 0);
      const categories = new Set(approved.map(p => p.category));

      el.approvedCount.textContent = approved.length.toLocaleString("hr-HR");
      el.supportCount.textContent = supports.toLocaleString("hr-HR");
      el.categoryCount.textContent = categories.size.toLocaleString("hr-HR");
    }

    function renderPublicProposals() {
      const visible = state.proposals
        .filter(p => p.status === "approved")
        .filter(p => {
          const text = (p.text + " " + p.description).toLocaleLowerCase("hr");
          const searchMatch = !state.search || text.includes(state.search);
          const categoryMatch = state.category === "all" || p.category === state.category;
          return searchMatch && categoryMatch;
        });

      visible.sort((a, b) => {
        if (state.sort === "support") return b.support - a.support;
        if (state.sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      if (!visible.length) {
        el.proposalList.innerHTML = '<div class="empty">Nema prijedloga koji odgovaraju odabranim kriterijima.</div>';
        return;
      }

      const supported = loadSupported();

      el.proposalList.innerHTML = visible.map(p => {
        const alreadySupported = supported.includes(p.id);

        return `
          <article class="proposal-card">
            <div class="proposal-top">
              <div class="proposal-icon" aria-hidden="true">${escapeHtml(categoryIcons[p.category] || "💬")}</div>
              <div>
                <h3>…${escapeHtml(p.text)}</h3>
                <div class="meta">
                  <span class="chip">${escapeHtml(p.category)}</span>
                  <span>${formatDate(p.createdAt)}</span>
                </div>
              </div>
            </div>

            <p class="proposal-description">${escapeHtml(p.description)}</p>

            <div class="proposal-actions">
              <span class="support-count">🤝 ${p.support.toLocaleString("hr-HR")} podrški</span>
              <button
                class="button button-outline"
                type="button"
                data-support-id="${p.id}"
                ${alreadySupported ? "disabled" : ""}
              >
                ${alreadySupported ? "Podržano ✓" : "Podrži"}
              </button>
            </div>
          </article>
        `;
      }).join("");

      el.proposalList.querySelectorAll("[data-support-id]").forEach(button => {
        button.addEventListener("click", () => supportProposal(button.dataset.supportId));
      });
    }

    function supportProposal(id) {
      const supported = loadSupported();

      if (supported.includes(id)) {
        toast("Ovaj prijedlog već si podržao u ovom pregledniku.", "error");
        return;
      }

      const proposal = state.proposals.find(p => p.id === id);

      if (!proposal || proposal.status !== "approved") {
        toast("Prijedlog nije dostupan.", "error");
        return;
      }

      proposal.support += 1;
      supported.push(id);
      localStorage.setItem(SUPPORT_KEY, JSON.stringify(supported));
      saveProposals();
      renderAll();
      toast("Hvala na podršci!");
    }

    function renderAdmin() {
      const list = state.proposals.filter(p => {
        return state.adminStatus === "all" || p.status === state.adminStatus;
      });

      el.adminTotal.textContent = state.proposals.length;
      el.adminPending.textContent = state.proposals.filter(p => p.status === "pending").length;
      el.adminApproved.textContent = state.proposals.filter(p => p.status === "approved").length;
      el.adminViews.textContent = Number(localStorage.getItem(VIEWS_KEY) || 0);

      if (!list.length) {
        el.adminList.innerHTML = '<div class="empty">Nema prijedloga u ovom statusu.</div>';
        return;
      }

      el.adminList.innerHTML = list.map(p => `
        <article class="admin-item">
          <div>
            <h4>…${escapeHtml(p.text)}</h4>
            <p>${escapeHtml(p.description)}</p>
            <p style="margin-top:8px"><strong>${escapeHtml(p.category)}</strong> · ${formatDate(p.createdAt)} · ${p.support} podrški</p>
            <span class="status ${p.status}">${statusLabel(p.status)}</span>
          </div>

          <div class="admin-actions">
            ${p.status !== "approved" ? `<button class="button button-soft" data-action="approve" data-id="${p.id}">Odobri</button>` : ""}
            ${p.status !== "rejected" ? `<button class="button button-outline" data-action="reject" data-id="${p.id}">Odbij</button>` : ""}
            <button class="button button-danger" data-action="delete" data-id="${p.id}">Izbriši</button>
          </div>
        </article>
      `).join("");

      el.adminList.querySelectorAll("[data-action]").forEach(button => {
        button.addEventListener("click", () => {
          adminAction(button.dataset.action, button.dataset.id);
        });
      });
    }

    function adminAction(action, id) {
      const proposal = state.proposals.find(p => p.id === id);
      if (!proposal) return;

      if (action === "approve") {
        proposal.status = "approved";
        toast("Prijedlog je odobren.");
      }

      if (action === "reject") {
        proposal.status = "rejected";
        toast("Prijedlog je odbijen.");
      }

      if (action === "delete") {
        if (!confirm("Trajno izbrisati ovaj prijedlog iz demo podataka?")) return;
        state.proposals = state.proposals.filter(p => p.id !== id);
        toast("Prijedlog je izbrisan.");
      }

      saveProposals();
      renderAll();
    }

    function populateCategoryFilter() {
      el.categoryFilter.innerHTML =
        '<option value="all">Sve kategorije</option>' +
        Object.keys(categoryIcons)
          .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
          .join("");
    }

    function loadProposals() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (!stored) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(demoProposals));
          return structuredClone(demoProposals);
        }

        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : structuredClone(demoProposals);
      } catch (error) {
        console.error(error);
        return structuredClone(demoProposals);
      }
    }

    function saveProposals() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.proposals));
    }

    function loadSupported() {
      try {
        const stored = localStorage.getItem(SUPPORT_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function incrementViews() {
      const current = Number(localStorage.getItem(VIEWS_KEY) || 0);
      localStorage.setItem(VIEWS_KEY, String(current + 1));
    }

    function exportJson() {
      const blob = new Blob([JSON.stringify(state.proposals, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `zelim-dugo-selo-${new Date().toISOString().slice(0,10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast("JSON izvoz je pripremljen.");
    }

    function resetDemo() {
      if (!confirm("Vratiti početne demo prijedloge i ukloniti lokalne izmjene?")) return;

      state.proposals = structuredClone(demoProposals);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.proposals));
      localStorage.removeItem(SUPPORT_KEY);
      renderAll();
      toast("Demo podaci su vraćeni.");
    }

    function statusLabel(status) {
      return {
        pending: "Na čekanju",
        approved: "Odobreno",
        rejected: "Odbijeno"
      }[status] || status;
    }

    function formatDate(value) {
      return new Intl.DateTimeFormat("hr-HR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(new Date(value));
    }

    function toast(message, type = "success") {
      const item = document.createElement("div");
      item.className = `toast ${type === "error" ? "error" : ""}`;
      item.textContent = message;
      el.toastWrap.append(item);
      setTimeout(() => item.remove(), 3200);
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }