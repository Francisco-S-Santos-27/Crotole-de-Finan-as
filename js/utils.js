export const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export function monthKey(date) {
  return date.slice(0, 7);
}

export function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short"
  }).replace(".", "");
}

export function formatMonthLabel(monthValue) {
  const date = new Date(`${monthValue}-15T12:00:00`);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[match]));
}

export function escapeAttr(value) {
  return escapeHTML(value);
}

export function getCategoryInfo(categories, name) {
  return categories.find((category) => category.name === name) || {
    name,
    icon: "circle",
    color: "#94a3b8"
  };
}

export function getTransactionsByMonth(transactions, selectedMonth) {
  return transactions.filter((transaction) => monthKey(transaction.date) === selectedMonth);
}

export function escapeCSV(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function emptyState(icon, message) {
  return `<div class="empty"><i data-lucide="${icon}"></i><br>${message}</div>`;
}
