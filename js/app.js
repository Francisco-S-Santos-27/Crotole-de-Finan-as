import {
  KEY,
  CAT_KEY,
  defaultCategories,
  loadTransactions,
  loadCategories,
  saveState
} from "./storage.js";
import {
  money,
  formatDate,
  formatMonthLabel,
  escapeHTML,
  escapeAttr,
  getCategoryInfo,
  getTransactionsByMonth,
  escapeCSV,
  monthKey,
  emptyState
} from "./utils.js";

const BUDGET_KEY = "financeflow_budget_v1";
const THEME_KEY = "financeflow_theme_v1";
const today = new Date();
let transactions = loadTransactions();
let categories = loadCategories();
let monthlyBudget = Number(localStorage.getItem(BUDGET_KEY) || "2500");
let flowChart;
let categoryChart;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let installPrompt;
const installButton = $("#installApp");

function selectedMonth() {
  return $("#monthFilter").value || today.toISOString().slice(0, 7);
}

function validateTransaction(data) {
  if (!data.description || !data.date || Number(data.amount) <= 0) {
    throw new Error("Dados do lançamento inválidos.");
  }

  if (!data.category) {
    throw new Error("Selecione uma categoria.");
  }
}

function getPreviousMonth(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentMonthSummary() {
  const data = getTransactionsByMonth(transactions, selectedMonth());
  return {
    data,
    income: data.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0),
    expense: data.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0)
  };
}

function renderInsights() {
  const current = getCurrentMonthSummary();
  const previousMonth = getPreviousMonth(selectedMonth());
  const previousData = transactions.filter((transaction) => monthKey(transaction.date) === previousMonth);
  const previousExpense = previousData.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);

  let variation = 0;
  if (previousExpense > 0) {
    variation = ((current.expense - previousExpense) / previousExpense) * 100;
  } else if (current.expense > 0) {
    variation = 100;
  }

  $("#monthComparison").textContent = `${variation >= 0 ? "+" : ""}${variation.toFixed(0)}%`;
  $("#monthComparison").classList.toggle("negative", variation > 0);
  $("#monthComparison").classList.toggle("positive", variation < 0);
  $("#monthComparisonText").textContent = previousExpense > 0
    ? variation > 0
      ? "Mais gasto que no mês anterior"
      : variation < 0
        ? "Menos gasto que no mês anterior"
        : "No mesmo patamar do mês anterior"
    : current.expense > 0
      ? "Sem comparação anterior, mas com gastos neste mês"
      : "Sem comparação anterior";

  const budgetUsage = monthlyBudget > 0 ? (current.expense / monthlyBudget) * 100 : 0;
  const safeUsage = Math.min(budgetUsage, 100);
  $("#budgetProgress").textContent = `${safeUsage.toFixed(0)}%`;
  $("#budgetProgressText").textContent = `Meta: ${money(monthlyBudget)} · usado ${money(current.expense)}`;
  $("#budgetBar").style.width = `${safeUsage}%`;
  $("#budgetBar").style.background = budgetUsage > 100 ? "var(--red)" : budgetUsage > 80 ? "var(--yellow)" : "var(--green)";
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light-theme", isLight);
  const themeIcon = $("#themeToggle")?.querySelector("i");
  if (themeIcon) {
    themeIcon.setAttribute("data-lucide", isLight ? "moon" : "sun-medium");
    lucide.createIcons();
  }
  localStorage.setItem(THEME_KEY, theme);
}

function renderUpcomingExpenses() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcoming = transactions
    .filter((transaction) => transaction.type === "expense")
    .filter((transaction) => {
      const date = new Date(`${transaction.date}T00:00:00`);
      return date >= now && date <= new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  if (!upcoming.length) {
    $("#upcomingExpenses").innerHTML = emptyState("calendar-days", "Nenhuma despesa nos próximos 30 dias.");
    return;
  }

  $("#upcomingExpenses").innerHTML = upcoming.map((transaction) => {
    const date = new Date(`${transaction.date}T00:00:00`);
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    const category = getCategoryInfo(categories, transaction.category);

    return `
      <div class="upcoming-item">
        <div class="upcoming-main">
          <div class="upcoming-icon" style="background:${category.color}18;color:${category.color}">
            <i data-lucide="${category.icon}"></i>
          </div>
          <div>
            <strong>${escapeHTML(transaction.description)}</strong>
            <span>${escapeHTML(transaction.category)} · ${formatDate(transaction.date)}</span>
          </div>
        </div>
        <div class="upcoming-meta">
          <span class="upcoming-badge">${diffDays === 0 ? "Hoje" : `Em ${diffDays}d`}</span>
          <strong>${money(transaction.amount)}</strong>
        </div>
      </div>
    `;
  }).join("");

  lucide.createIcons();
}

function renderDashboard() {
  const { data, income, expense } = getCurrentMonthSummary();
  const balance = income - expense;

  $("#balance").textContent = money(balance);
  $("#income").textContent = money(income);
  $("#expense").textContent = money(expense);
  $("#savingRate").textContent = `${income ? Math.max(0, (balance / income) * 100).toFixed(0) : 0}%`;
  $("#balanceStatus").textContent = balance >= 0 ? "Saldo positivo" : "Saldo negativo";
  $("#balanceStatus").style.color = balance >= 0 ? "var(--green)" : "var(--red)";
  $("#currentPeriod").textContent = formatMonthLabel(selectedMonth());

  renderInsights();
  renderUpcomingExpenses();
  renderCharts(data);
  renderTransactions();
  renderCategories();
  fillCategorySelects();
  lucide.createIcons();
}

function renderCharts(data) {
  const days = {};

  data.forEach((transaction) => {
    if (!days[transaction.date]) {
      days[transaction.date] = { income: 0, expense: 0 };
    }

    days[transaction.date][transaction.type] += Number(transaction.amount);
  });

  const labels = Object.keys(days).sort();
  const ctx = $("#flowChart").getContext("2d");

  if (flowChart) flowChart.destroy();

  flowChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels.map(formatDate),
      datasets: [
        {
          label: "Entradas",
          data: labels.map((day) => days[day].income),
          borderColor: "#37d67a",
          backgroundColor: "rgba(55,214,122,.08)",
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 2
        },
        {
          label: "Saídas",
          data: labels.map((day) => days[day].expense),
          borderColor: "#ff6374",
          backgroundColor: "rgba(255,99,116,.05)",
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#6f7d89", font: { size: 9 } }
        },
        y: {
          grid: { color: "rgba(255,255,255,.05)" },
          ticks: {
            color: "#6f7d89",
            font: { size: 9 },
            callback: (value) => money(value).replace("R$", "R$ ")
          }
        }
      }
    }
  });

  const totals = {};

  data.filter((t) => t.type === "expense").forEach((transaction) => {
    totals[transaction.category] = (totals[transaction.category] || 0) + Number(transaction.amount);
  });

  const cats = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const ctx2 = $("#categoryChart").getContext("2d");

  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(ctx2, {
    type: "doughnut",
    data: {
      labels: cats.map(([category]) => category),
      datasets: [{
        data: cats.map(([, value]) => value),
        backgroundColor: cats.map(([category]) => getCategoryInfo(categories, category).color),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: { legend: { display: false } }
    }
  });

  $("#categoryLegend").innerHTML = cats.length
    ? cats.slice(0, 6).map(([category, value]) => `<span>● ${category} ${money(value)}</span>`).join("")
    : "<span>Nenhuma despesa no período</span>";
}

function transactionHTML(transaction) {
  const category = getCategoryInfo(categories, transaction.category);

  return `
    <div class="transaction">
      <div class="tx-icon ${transaction.type}" style="background:${category.color}18;color:${category.color}">
        <i data-lucide="${transaction.type === "income" ? "arrow-down-left" : "arrow-up-right"}"></i>
      </div>
      <div class="tx-main">
        <strong>${escapeHTML(transaction.description)}</strong>
        <span>${escapeHTML(transaction.category)} · ${formatDate(transaction.date)} · ${escapeHTML(transaction.payment || "")}</span>
      </div>
      <div class="tx-amount ${transaction.type}">${transaction.type === "income" ? "+" : "−"} ${money(transaction.amount)}</div>
      <div class="tx-actions">
        <button class="action-btn edit-btn" data-edit="${transaction.id}" title="Editar"><i data-lucide="pencil"></i></button>
        <button class="action-btn delete-btn" data-delete="${transaction.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
  `;
}

function renderTransactions() {
  const monthData = getTransactionsByMonth(transactions, selectedMonth()).sort((a, b) => b.date.localeCompare(a.date));
  $("#recentTransactions").innerHTML = monthData.slice(0, 6).map(transactionHTML).join("") || emptyState("inbox", "Nenhuma movimentação neste período.");

  const search = ($("#search")?.value || "").toLowerCase();
  const type = $("#typeFilter")?.value || "all";
  const category = $("#categoryFilter")?.value || "all";

  const filtered = transactions
    .filter((transaction) => (!search || transaction.description.toLowerCase().includes(search) || transaction.category.toLowerCase().includes(search)))
    .filter((transaction) => type === "all" || transaction.type === type)
    .filter((transaction) => category === "all" || transaction.category === category)
    .sort((a, b) => b.date.localeCompare(a.date));

  $("#allTransactions").innerHTML = filtered.map(transactionHTML).join("") || emptyState("search-x", "Nenhum lançamento encontrado.");
  lucide.createIcons();
}

function exportTransactionsToCSV() {
  const rows = [
    ["Data", "Tipo", "Descrição", "Categoria", "Pagamento", "Valor", "Observação"]
  ];

  [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((transaction) => {
      rows.push([
        transaction.date,
        transaction.type === "income" ? "Entrada" : "Saída",
        transaction.description,
        transaction.category,
        transaction.payment || "",
        transaction.amount,
        transaction.note || ""
      ]);
    });

  const csvContent = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `movimentacoes-${selectedMonth()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast("CSV exportado com sucesso.");
}

function drawReportCanvas() {
  const { data, income, expense } = getCurrentMonthSummary();
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1120;
  const context = canvas.getContext("2d");
  const balance = income - expense;
  const monthLabel = formatMonthLabel(selectedMonth());

  context.fillStyle = "#101820";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#37d67a";
  context.fillRect(0, 0, canvas.width, 14);
  context.fillStyle = "#f4f7fa";
  context.font = "700 42px Inter, Arial, sans-serif";
  context.fillText("Relatório financeiro", 80, 92);
  context.fillStyle = "#8e9ba8";
  context.font = "24px Inter, Arial, sans-serif";
  context.fillText(monthLabel, 80, 132);

  const cards = [
    ["Saldo", money(balance), balance >= 0 ? "#37d67a" : "#ff6374"],
    ["Entradas", money(income), "#37d67a"],
    ["Saídas", money(expense), "#ff6374"],
    ["Lançamentos", String(data.length), "#5ca8ff"]
  ];

  cards.forEach(([label, value, color], index) => {
    const x = 80 + index * 365;
    context.fillStyle = "#18232d";
    context.fillRect(x, 180, 330, 125);
    context.fillStyle = "#8e9ba8";
    context.font = "18px Inter, Arial, sans-serif";
    context.fillText(label, x + 22, 220);
    context.fillStyle = color;
    context.font = "700 28px Inter, Arial, sans-serif";
    context.fillText(value, x + 22, 266);
  });

  context.fillStyle = "#f4f7fa";
  context.font = "700 26px Inter, Arial, sans-serif";
  context.fillText("Movimentações do período", 80, 380);

  const sortedData = [...data].sort((a, b) => b.date.localeCompare(a.date));
  sortedData.slice(0, 15).forEach((transaction, index) => {
    const y = 430 + index * 40;
    context.fillStyle = index % 2 ? "#141e27" : "#18232d";
    context.fillRect(80, y - 25, 1440, 36);
    context.fillStyle = "#8e9ba8";
    context.font = "16px Inter, Arial, sans-serif";
    context.fillText(formatDate(transaction.date), 98, y);
    context.fillStyle = "#f4f7fa";
    context.fillText(transaction.description.slice(0, 42), 260, y);
    context.fillStyle = "#8e9ba8";
    context.fillText(transaction.category, 850, y);
    context.fillStyle = transaction.type === "income" ? "#37d67a" : "#ff6374";
    context.textAlign = "right";
    context.fillText(`${transaction.type === "income" ? "+" : "-"} ${money(transaction.amount)}`, 1480, y);
    context.textAlign = "left";
  });

  if (!sortedData.length) {
    context.fillStyle = "#8e9ba8";
    context.font = "18px Inter, Arial, sans-serif";
    context.fillText("Nenhuma movimentação neste período.", 80, 430);
  }

  context.fillStyle = "#657482";
  context.font = "16px Inter, Arial, sans-serif";
  context.fillText("Gerado pelo Controle Financeiro", 80, 1050);
  return canvas;
}

function downloadMonthlyReport(format) {
  const canvas = drawReportCanvas();
  const filename = `relatorio-financeiro-${selectedMonth()}`;

  if (format === "png") {
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `${filename}.png`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast("Relatório PNG baixado.");
    return;
  }

  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    toast("Não foi possível carregar o exportador PDF.");
    return;
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageHeight = pageWidth * canvas.height / canvas.width;
  const image = canvas.toDataURL("image/png");
  pdf.addImage(image, "PNG", 0, 0, pageWidth, Math.min(imageHeight, pageHeight));
  pdf.save(`${filename}.pdf`);
  toast("Relatório PDF baixado.");
}

function renderCategories() {
  const sums = {};

  transactions.filter((t) => t.type === "expense").forEach((transaction) => {
    sums[transaction.category] = (sums[transaction.category] || 0) + Number(transaction.amount);
  });

  $("#categoryCards").innerHTML = categories.map((category) => `
    <div class="category-card">
      <div class="cat-icon" style="color:${category.color};background:${category.color}18">
        <i data-lucide="${category.icon}"></i>
      </div>
      <div class="category-body">
        <strong>${escapeHTML(category.name)}</strong>
        <p>${money(sums[category.name] || 0)} em despesas</p>
      </div>
      <div class="category-actions">
        <button class="action-btn edit-btn" data-edit-category="${encodeURIComponent(category.name)}" title="Editar categoria"><i data-lucide="pencil"></i></button>
        <button class="action-btn delete-btn" data-delete-category="${encodeURIComponent(category.name)}" title="Excluir categoria"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
  `).join("");

  lucide.createIcons();
}

function fillCategorySelects() {
  const options = categories.map((category) => `<option value="${escapeAttr(category.name)}">${escapeHTML(category.name)}</option>`).join("");
  $("#modalCategory").innerHTML = options;

  const currentCategory = $("#categoryFilter").value || "all";
  $("#categoryFilter").innerHTML = `<option value="all">Todas as categorias</option>${options}`;
  $("#categoryFilter").value = categories.some((category) => category.name === currentCategory) ? currentCategory : "all";
}

function openModal(transaction = null) {
  const form = $("#transactionForm");
  $("#overlay").classList.add("show");
  $("#transactionModal").classList.add("show");

  if (transaction) {
    form.elements.id.value = transaction.id;
    form.elements.type.value = transaction.type;
    form.elements.description.value = transaction.description;
    form.elements.amount.value = transaction.amount;
    form.elements.date.value = transaction.date;
    form.elements.category.value = transaction.category;
    form.elements.payment.value = transaction.payment || "Pix";
    form.elements.note.value = transaction.note || "";
    $("#modalTitle").textContent = "Editar lançamento";
    $("#modalSubtitle").textContent = "Atualize os detalhes do lançamento.";
    return;
  }

  form.reset();
  form.elements.id.value = "";
  form.elements.type.value = "income";
  form.elements.date.value = new Date().toISOString().slice(0, 10);
  $("#modalTitle").textContent = "Novo lançamento";
  $("#modalSubtitle").textContent = "Registre uma entrada ou saída.";
}

function closeModal() {
  const form = $("#transactionForm");
  $("#overlay").classList.remove("show");
  $("#transactionModal").classList.remove("show");
  form.reset();
  form.elements.id.value = "";
  form.elements.type.value = "income";
  form.elements.date.value = new Date().toISOString().slice(0, 10);
  $("#modalTitle").textContent = "Novo lançamento";
  $("#modalSubtitle").textContent = "Registre uma entrada ou saída.";
}

function toast(message) {
  const toastElement = $("#toast");
  toastElement.querySelector("span").textContent = message;
  toastElement.classList.add("show");
  setTimeout(() => toastElement.classList.remove("show"), 2300);
}

function navigate(section) {
  $$(".section").forEach((item) => item.classList.remove("active-section"));
  $(`#${section}`).classList.add("active-section");
  $$(".nav-item[data-section]").forEach((button) => button.classList.toggle("active", button.dataset.section === section));
  $("#sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;

    if (outcome === "accepted") toast("Aplicativo instalado com sucesso.");
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Falha ao registrar o service worker:", error);
    });
  });
}

function bindEvents() {
  $("#openModal").onclick = () => openModal();
  $("#openModal2").onclick = () => openModal();
  $("#closeModal").onclick = closeModal;
  $("#overlay").onclick = closeModal;
  $("#mobileMenu").onclick = () => $("#sidebar").classList.toggle("open");

  $$("[data-section]").forEach((button) => {
    button.onclick = () => navigate(button.dataset.section);
  });

  $("#monthFilter").onchange = renderDashboard;
  $("#search").oninput = renderTransactions;
  $("#typeFilter").onchange = renderTransactions;
  $("#categoryFilter").onchange = renderTransactions;
  $("#exportCsv").onclick = exportTransactionsToCSV;
  $("#reportExport").onclick = () => $("#reportExportOptions").classList.toggle("show");
  $$('[data-report-format]').forEach((button) => {
    button.onclick = () => {
      downloadMonthlyReport(button.dataset.reportFormat);
      $("#reportExportOptions").classList.remove("show");
    };
  });
  $("#themeToggle").onclick = () => {
    const nextTheme = document.body.classList.contains("light-theme") ? "dark" : "light";
    applyTheme(nextTheme);
  };

  $("#transactionForm").onsubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const id = form.get("id") || crypto.randomUUID();
    const payload = {
      id,
      type: form.get("type"),
      description: form.get("description").trim(),
      amount: Number(form.get("amount")),
      date: form.get("date"),
      category: form.get("category"),
      payment: form.get("payment"),
      note: form.get("note")
    };

    try {
      validateTransaction(payload);

      const existingIndex = transactions.findIndex((transaction) => transaction.id === id);
      if (existingIndex >= 0) {
        transactions[existingIndex] = payload;
      } else {
        transactions.push(payload);
      }

      saveState(transactions, categories);
      closeModal();
      $("#monthFilter").value = payload.date.slice(0, 7);
      renderDashboard();
      toast(existingIndex >= 0 ? "Lançamento atualizado." : "Lançamento salvo com sucesso.");
    } catch (error) {
      toast(error.message);
    }
  };

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit]");
    if (editButton) {
      const transaction = transactions.find((item) => item.id === editButton.dataset.edit);
      if (transaction) openModal(transaction);
      return;
    }

    const deleteButton = event.target.closest("[data-delete]");
    if (!deleteButton) return;

    const id = deleteButton.dataset.delete;
    if (confirm("Excluir este lançamento?")) {
      transactions = transactions.filter((transaction) => transaction.id !== id);
      saveState(transactions, categories);
      renderDashboard();
      toast("Lançamento excluído.");
    }
  });

  document.addEventListener("click", (event) => {
    const editCategoryButton = event.target.closest("[data-edit-category]");
    if (editCategoryButton) {
      const oldName = decodeURIComponent(editCategoryButton.dataset.editCategory);
      const nextName = prompt("Editar categoria:", oldName);

      if (!nextName || !nextName.trim()) return;

      const normalizedName = nextName.trim();
      if (normalizedName.toLowerCase() === oldName.toLowerCase()) return;
      if (categories.some((category) => category.name.toLowerCase() === normalizedName.toLowerCase())) {
        return toast("Essa categoria já existe.");
      }

      categories = categories.map((category) => category.name === oldName ? { ...category, name: normalizedName } : category);
      transactions = transactions.map((transaction) => transaction.category === oldName ? { ...transaction, category: normalizedName } : transaction);
      saveState(transactions, categories);
      renderDashboard();
      toast("Categoria atualizada.");
      return;
    }

    const deleteCategoryButton = event.target.closest("[data-delete-category]");
    if (!deleteCategoryButton) return;

    const categoryName = decodeURIComponent(deleteCategoryButton.dataset.deleteCategory);
    if (categoryName === "Outros") {
      return toast("A categoria 'Outros' não pode ser removida.");
    }

    if (confirm(`Excluir a categoria "${categoryName}"? As movimentações dela serão movidas para "Outros".`)) {
      categories = categories.filter((category) => category.name !== categoryName);
      transactions = transactions.map((transaction) => transaction.category === categoryName ? { ...transaction, category: "Outros" } : transaction);
      saveState(transactions, categories);
      renderDashboard();
      toast("Categoria removida.");
    }
  });

  $("#addCategory").onclick = () => {
    const name = prompt("Nome da nova categoria:");
    if (!name?.trim()) return;

    const normalizedName = name.trim();
    if (categories.some((category) => category.name.toLowerCase() === normalizedName.toLowerCase())) {
      return toast("Essa categoria já existe.");
    }

    categories.push({ name: normalizedName, icon: "tag", color: "#5ca8ff" });
    saveState(transactions, categories);
    renderDashboard();
    toast("Categoria criada.");
  };

  $("#setBudget").onclick = () => {
    const value = prompt("Defina a meta de gastos do mês (R$):", String(monthlyBudget));
    if (value === null) return;

    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return toast("Informe um valor maior que zero.");
    }

    monthlyBudget = parsed;
    localStorage.setItem(BUDGET_KEY, String(monthlyBudget));
    renderDashboard();
    toast("Meta atualizada.");
  };

  $("#clearData").onclick = () => {
    if (confirm("Isso apagará todos os lançamentos e categorias personalizadas. Continuar?")) {
      localStorage.removeItem(KEY);
      localStorage.removeItem(CAT_KEY);
      localStorage.removeItem(BUDGET_KEY);
      transactions = [];
      categories = [...defaultCategories];
      monthlyBudget = 2500;
      saveState(transactions, categories);
      renderDashboard();
      toast("Dados limpos. Saldo zerado.");
    }
  };
}

function initialize() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(savedTheme);
  $("#monthFilter").value = today.toISOString().slice(0, 7);
  renderDashboard();
  bindEvents();
  bindInstallPrompt();
  registerServiceWorker();

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}

initialize();
