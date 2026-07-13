/**
 * LocTag - busca, lista (cards/tabela) e marcadores sincronizados.
 * Coordenadas em data/tags.json usam o viewBox 0 0 1000 500.
 */

const MARKER_R_IDLE = 6;
const MARKER_R_ACTIVE = 10;
const MARKER_R_IDLE_MOBILE = 8;
const MARKER_R_ACTIVE_MOBILE = 14;
const MOBILE_MQ = window.matchMedia("(max-width: 900px)");
const FIREBASE_SDK_VERSION = "12.7.0";
const FIREBASE_APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`;
const FIREBASE_AUTH_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`;
const FIREBASE_FIRESTORE_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`;

let allTags = [];
let filteredTags = [];
let activeTagId = null;
let authReady = false;

const searchInput = document.getElementById("search-input");
const clearBtn = document.getElementById("clear-btn");
const tbody = document.getElementById("tags-tbody");
const tagsCards = document.getElementById("tags-cards");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");
const markersPlanta = document.getElementById("markers-planta");
const markersLateral = document.getElementById("markers-lateral");
const selectionDetail = document.getElementById("selection-detail");
const detailTag = document.getElementById("detail-tag");
const detailDesc = document.getElementById("detail-desc");
const detailSistema = document.getElementById("detail-sistema");
const detailDeck = document.getElementById("detail-deck");
const detailArea = document.getElementById("detail-area");
const mapHint = document.querySelector(".map-hint");
const authStatus = document.getElementById("auth-status");
const authUser = document.getElementById("auth-user");
const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");

const mainTabs = document.querySelectorAll(".main-tab");
const panelLista = document.getElementById("panel-lista");
const panelMapa = document.getElementById("panel-mapa");
const viewTabs = document.querySelectorAll(".view-tab");
const viewPanes = document.querySelectorAll(".view-pane");

function isMobile() {
  return MOBILE_MQ.matches;
}

function markerRadius(active) {
  if (isMobile()) {
    return active ? MARKER_R_ACTIVE_MOBILE : MARKER_R_IDLE_MOBILE;
  }
  return active ? MARKER_R_ACTIVE : MARKER_R_IDLE;
}

async function loadLocalTags() {
  const res = await fetch("data/tags.json");
  if (!res.ok) throw new Error(`Falha ao carregar tags: ${res.status}`);
  allTags = await res.json();
  filteredTags = [...allTags];
  render();
}

async function loadFirebaseConfig() {
  try {
    const module = await import("./firebase-config.js");
    return module.firebaseConfig || null;
  } catch (err) {
    return null;
  }
}

async function setupFirebaseData(firebaseConfig) {
  const [
    { initializeApp },
    {
      getAuth,
      GoogleAuthProvider,
      onAuthStateChanged,
      signInWithPopup,
      signOut,
    },
    { collection, getDocs, getFirestore, orderBy, query },
  ] = await Promise.all([
    import(FIREBASE_APP_URL),
    import(FIREBASE_AUTH_URL),
    import(FIREBASE_FIRESTORE_URL),
  ]);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();

  signInBtn.addEventListener("click", () => {
    signInWithPopup(auth, provider).catch((err) => {
      updateAuthUi(null, `Falha no login: ${err.message}`);
    });
  });
  signOutBtn.addEventListener("click", () => signOut(auth));

  onAuthStateChanged(auth, async (user) => {
    authReady = true;

    if (!user) {
      allTags = [];
      filteredTags = [];
      activeTagId = null;
      updateAuthUi(null, "Entre com Google para carregar os dados.");
      render();
      return;
    }

    try {
      updateAuthUi(user, "Carregando dados autorizados...");
      const tagsQuery = query(collection(db, "tags"), orderBy("tag"));
      const snapshot = await getDocs(tagsQuery);
      allTags = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      filteredTags = [...allTags];
      activeTagId = null;
      updateAuthUi(user, `${allTags.length} equipamentos carregados.`);
      render();
    } catch (err) {
      allTags = [];
      filteredTags = [];
      activeTagId = null;
      updateAuthUi(user, `Sem acesso aos dados: ${err.message}`);
      render();
    }
  });
}

function updateAuthUi(user, status) {
  if (authStatus) authStatus.textContent = status;
  if (authUser) authUser.textContent = user?.email || "";
  if (signInBtn) signInBtn.hidden = Boolean(user);
  if (signOutBtn) signOutBtn.hidden = !user;
}

async function loadTags() {
  const firebaseConfig = await loadFirebaseConfig();

  if (!firebaseConfig) {
    updateAuthUi(null, "Modo desenvolvimento: usando data/tags.json local.");
    if (signInBtn) signInBtn.hidden = true;
    if (signOutBtn) signOutBtn.hidden = true;
    await loadLocalTags();
    return;
  }

  await setupFirebaseData(firebaseConfig);
}

function filterTags(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [...allTags];
  return allTags.filter((t) => {
    const haystack = [t.tag, t.descricao, t.sistema, t.deck, t.area]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getTagById(tagId) {
  return allTags.find((t) => t.tag === tagId);
}

function tagLabel(tag) {
  return `${tag.tag}, ${tag.descricao}, ${tag.sistema}, ${tag.deck}, ${tag.area}`;
}

function handleSelectableKeydown(event, tagId, options = {}) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  selectTag(tagId, options);
}

function renderTable(tags) {
  tbody.innerHTML = "";
  const table = document.getElementById("tags-table");

  if (!isMobile()) {
    if (tags.length === 0) {
      emptyState.classList.remove("hidden");
      table.classList.add("hidden");
      return;
    }
    emptyState.classList.add("hidden");
    table.classList.remove("hidden");

    tags.forEach((tag) => {
      const tr = document.createElement("tr");
      tr.dataset.tag = tag.tag;
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-label", `Selecionar ${tagLabel(tag)}`);
      if (tag.tag === activeTagId) tr.classList.add("row-selected");
      tr.innerHTML = `
        <td>${escapeHtml(tag.tag)}</td>
        <td>${escapeHtml(tag.descricao)}</td>
        <td>${escapeHtml(tag.sistema)}</td>
        <td>${escapeHtml(tag.deck)}</td>
        <td>${escapeHtml(tag.area)}</td>
      `;
      tr.addEventListener("click", () => selectTag(tag.tag, { switchToMap: false }));
      tr.addEventListener("keydown", (event) => (
        handleSelectableKeydown(event, tag.tag, { switchToMap: false })
      ));
      tbody.appendChild(tr);
    });
  }
}

function renderCards(tags) {
  tagsCards.innerHTML = "";

  if (tags.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "Nenhuma tag encontrada.";
    tagsCards.appendChild(p);
    return;
  }

  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-card";
    btn.dataset.tag = tag.tag;
    btn.setAttribute("aria-label", `Selecionar ${tagLabel(tag)}`);
    if (tag.tag === activeTagId) btn.classList.add("is-selected");

    btn.innerHTML = `
      <span class="tag-card-tag">${escapeHtml(tag.tag)}</span>
      <span class="tag-card-desc">${escapeHtml(tag.descricao)}</span>
      <span class="tag-card-meta">
        <span>${escapeHtml(tag.sistema)}</span>
        <span>${escapeHtml(tag.deck)}</span>
        <span>${escapeHtml(tag.area)}</span>
      </span>
    `;

    btn.addEventListener("click", () => selectTag(tag.tag, { switchToMap: true }));
    tagsCards.appendChild(btn);
  });
}

function updateSelectionDetail() {
  if (!activeTagId) {
    selectionDetail.classList.add("hidden");
    return;
  }

  const tag = getTagById(activeTagId);
  if (!tag) {
    selectionDetail.classList.add("hidden");
    return;
  }

  selectionDetail.classList.remove("hidden");
  detailTag.textContent = tag.tag;
  detailDesc.textContent = tag.descricao;
  detailSistema.textContent = tag.sistema;
  detailDeck.textContent = tag.deck;
  detailArea.textContent = tag.area;
}

function mapCoords(ponto, vista) {
  const x = ponto.x;
  const y = vista === "planta" ? ponto.y : ponto.z;
  return { x, y };
}

function createMarker(tag, coords, isActive) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.dataset.tag = tag.tag;
  g.setAttribute("role", "button");
  g.setAttribute("tabindex", "0");
  g.setAttribute("focusable", "true");
  g.setAttribute("aria-label", `Selecionar ${tagLabel(tag)}`);

  const r = markerRadius(isActive);
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", coords.x);
  circle.setAttribute("cy", coords.y);
  circle.setAttribute("r", r);
  circle.setAttribute("class", isActive ? "marker-active" : "marker-idle");

  g.appendChild(circle);

  if (isActive) {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", coords.x);
    label.setAttribute("y", coords.y - (r + 4));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "marker-label-active");
    label.textContent = tag.tag;
    g.appendChild(label);
  }

  g.addEventListener("click", (e) => {
    e.stopPropagation();
    selectTag(tag.tag, { switchToMap: isMobile() });
  });
  g.addEventListener("keydown", (event) => {
    handleSelectableKeydown(event, tag.tag, { switchToMap: isMobile() });
  });

  return g;
}

function renderMarkers(tags, activeId) {
  markersPlanta.innerHTML = "";
  markersLateral.innerHTML = "";

  tags.forEach((tag) => {
    const isActive = tag.tag === activeId;
    markersPlanta.appendChild(
      createMarker(tag, mapCoords(tag.planta, "planta"), isActive)
    );
    markersLateral.appendChild(
      createMarker(tag, mapCoords(tag.lateral, "lateral"), isActive)
    );
  });
}

function getMapTags() {
  if (activeTagId) {
    const activeTag = getTagById(activeTagId);
    return activeTag ? [activeTag] : [];
  }

  if (searchInput.value.trim() && filteredTags.length === 1) {
    return filteredTags;
  }

  return [];
}

function updateMapHint() {
  if (!mapHint) return;

  const query = searchInput.value.trim();

  if (filteredTags.length === 0) {
    mapHint.textContent = "Nenhum equipamento encontrado para localizar no mapa.";
    return;
  }

  if (activeTagId || (query && filteredTags.length === 1)) {
    mapHint.textContent = "Ponto exibido para o equipamento selecionado.";
    return;
  }

  if (query) {
    mapHint.textContent = "Refine a busca ou selecione uma tag na lista para exibir o ponto.";
    return;
  }

  mapHint.textContent = "Busque ou selecione uma tag para exibir o ponto no mapa.";
}

function scrollToSelected() {
  if (!activeTagId) return;

  const selector = `[data-tag="${CSS.escape(activeTagId)}"]`;
  const card = tagsCards.querySelector(selector);
  if (card) {
    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return;
  }
  const row = tbody.querySelector(selector);
  if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function setMainPanel(panelName) {
  mainTabs.forEach((tab) => {
    const active = tab.dataset.panel === panelName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });

  const isLista = panelName === "lista";
  panelLista.classList.toggle("is-active", isLista);
  panelMapa.classList.toggle("is-active", !isLista);

  if (isLista) {
    panelLista.removeAttribute("hidden");
    panelMapa.setAttribute("hidden", "");
  } else {
    panelMapa.removeAttribute("hidden");
    panelLista.setAttribute("hidden", "");
  }
}

function setViewPanel(viewName) {
  viewTabs.forEach((tab) => {
    const active = tab.dataset.view === viewName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });

  viewPanes.forEach((pane) => {
    const active = pane.dataset.viewPane === viewName;
    pane.classList.toggle("is-active", active);
    if (active) pane.removeAttribute("hidden");
    else pane.setAttribute("hidden", "");
  });
}

function setupTabs() {
  mainTabs.forEach((tab) => {
    tab.addEventListener("click", () => setMainPanel(tab.dataset.panel));
  });

  viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => setViewPanel(tab.dataset.view));
  });

  MOBILE_MQ.addEventListener("change", () => {
    render();
    if (!isMobile()) {
      panelMapa.removeAttribute("hidden");
      panelLista.removeAttribute("hidden");
      viewPanes.forEach((p) => p.removeAttribute("hidden"));
    } else if (!panelMapa.classList.contains("is-active")) {
      panelMapa.setAttribute("hidden", "");
    }
  });
}

function selectTag(tagId, options = {}) {
  const { switchToMap = false } = options;
  activeTagId = tagId;
  updateSelectionDetail();
  renderTable(filteredTags);
  renderCards(filteredTags);
  renderMarkers(getMapTags(), activeTagId);
  updateMapHint();
  scrollToSelected();

  if (switchToMap && isMobile()) {
    setMainPanel("mapa");
  }
}

function updateResultCount(n) {
  if (!authReady && signInBtn && !signInBtn.hidden) {
    resultCount.textContent = "";
    return;
  }
  const label = n === allTags.length ? `${n}` : `${n}/${allTags.length}`;
  resultCount.textContent = label;
}

function render() {
  renderCards(filteredTags);
  renderTable(filteredTags);
  renderMarkers(getMapTags(), activeTagId);
  updateSelectionDetail();
  updateResultCount(filteredTags.length);
  updateMapHint();

  if (isMobile() && filteredTags.length === 0) {
    emptyState.classList.add("hidden");
  }
}

function onSearchInput() {
  const query = searchInput.value;
  filteredTags = filterTags(query);
  if (filteredTags.length === 1) {
    activeTagId = filteredTags[0].tag;
  } else if (
    activeTagId &&
    !filteredTags.some((t) => t.tag === activeTagId)
  ) {
    activeTagId = null;
  }
  render();
}

function onClear() {
  searchInput.value = "";
  filteredTags = [...allTags];
  activeTagId = null;
  render();
  searchInput.focus();
}

searchInput.addEventListener("input", onSearchInput);
clearBtn.addEventListener("click", onClear);

function setupParallax() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  const hero = document.getElementById("hero");
  const layers = document.querySelectorAll("[data-parallax]");

  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (hero) {
        hero.style.transform = `translate3d(0, ${y * 0.12}px, 0)`;
        hero.style.opacity = String(Math.max(0.4, 1 - y / 400));
      }
      layers.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax) || 0.1;
        el.style.transform = `translate3d(0, ${y * speed}px, 0)`;
      });
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

setupParallax();
setupTabs();

loadTags().catch((err) => {
  console.error(err);
  const msg = "Erro ao carregar dados. Use um servidor local (veja README).";
  emptyState.textContent = msg;
  emptyState.classList.remove("hidden");
  tagsCards.innerHTML = `<p class="empty-state">${msg}</p>`;
});
