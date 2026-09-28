export const KEY = "financeflow_transactions_v1";
export const CAT_KEY = "financeflow_categories_v1";

export const defaultCategories = [
  { name: "Alimentação", icon: "utensils", color: "#f4c95d" },
  { name: "Moradia", icon: "house", color: "#5ca8ff" },
  { name: "Transporte", icon: "car-front", color: "#a78bfa" },
  { name: "Saúde", icon: "heart-pulse", color: "#ff6374" },
  { name: "Educação", icon: "graduation-cap", color: "#37d67a" },
  { name: "Lazer", icon: "gamepad-2", color: "#f97316" },
  { name: "Trabalho", icon: "briefcase-business", color: "#22d3ee" },
  { name: "Outros", icon: "ellipsis", color: "#94a3b8" }
];

export function loadValue(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function loadTransactions() {
  return loadValue(KEY, []);
}

export function loadCategories() {
  const stored = loadValue(CAT_KEY, null);
  return stored && stored.length ? stored : [...defaultCategories];
}

export function saveState(transactions, categories) {
  localStorage.setItem(KEY, JSON.stringify(transactions));
  localStorage.setItem(CAT_KEY, JSON.stringify(categories));
}

export function createSeedTransactions() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");

  return [
    { id: crypto.randomUUID(), type: "income", description: "Salário", amount: 3500, date: `${year}-${month}-05`, category: "Trabalho", payment: "Transferência", note: "" },
    { id: crypto.randomUUID(), type: "expense", description: "Aluguel", amount: 850, date: `${year}-${month}-06`, category: "Moradia", payment: "Pix", note: "" },
    { id: crypto.randomUUID(), type: "expense", description: "Supermercado", amount: 420, date: `${year}-${month}-08`, category: "Alimentação", payment: "Cartão de crédito", note: "" },
    { id: crypto.randomUUID(), type: "expense", description: "Combustível", amount: 180, date: `${year}-${month}-12`, category: "Transporte", payment: "Pix", note: "" }
  ];
}
