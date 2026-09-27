const KEY = "financeflow_transactions_v1";
const CAT_KEY = "financeflow_categories_v1";

const defaultCategories = [
  {name:"Alimentação", icon:"utensils", color:"#f4c95d"},
  {name:"Moradia", icon:"house", color:"#5ca8ff"},
  {name:"Transporte", icon:"car-front", color:"#a78bfa"},
  {name:"Saúde", icon:"heart-pulse", color:"#ff6374"},
  {name:"Educação", icon:"graduation-cap", color:"#37d67a"},
  {name:"Lazer", icon:"gamepad-2", color:"#f97316"},
  {name:"Trabalho", icon:"briefcase-business", color:"#22d3ee"},
  {name:"Outros", icon:"ellipsis", color:"#94a3b8"}
];

let transactions = JSON.parse(localStorage.getItem(KEY) || "[]");
let categories = JSON.parse(localStorage.getItem(CAT_KEY) || "null") || defaultCategories;
let flowChart, categoryChart;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const today = new Date();
const monthKey = d => d.slice(0,7);
const fmtDate = d => new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}).replace(".","");
const save = () => { localStorage.setItem(KEY,JSON.stringify(transactions)); localStorage.setItem(CAT_KEY,JSON.stringify(categories)); };

function seed(){
  if(transactions.length) return;
  const y = today.getFullYear(), m = String(today.getMonth()+1).padStart(2,"0");
  transactions = [
    {id:crypto.randomUUID(),type:"income",description:"Salário",amount:3500,date:`${y}-${m}-05`,category:"Trabalho",payment:"Transferência",note:""},
    {id:crypto.randomUUID(),type:"expense",description:"Aluguel",amount:850,date:`${y}-${m}-06`,category:"Moradia",payment:"Pix",note:""},
    {id:crypto.randomUUID(),type:"expense",description:"Supermercado",amount:420,date:`${y}-${m}-08`,category:"Alimentação",payment:"Cartão de crédito",note:""},
    {id:crypto.randomUUID(),type:"expense",description:"Combustível",amount:180,date:`${y}-${m}-12`,category:"Transporte",payment:"Pix",note:""}
  ];
  save();
}
function selectedMonth(){ return $("#monthFilter").value || today.toISOString().slice(0,7); }
function monthTransactions(){ return transactions.filter(t => monthKey(t.date) === selectedMonth()); }
function catInfo(name){ return categories.find(c=>c.name===name) || defaultCategories.find(c=>c.name===name) || {name,icon:"circle",color:"#94a3b8"}; }

function render(){
  const data=monthTransactions();
  const income=data.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense=data.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const balance=income-expense;
  $("#balance").textContent=money(balance);
  $("#income").textContent=money(income);
  $("#expense").textContent=money(expense);
  $("#savingRate").textContent=(income ? Math.max(0,balance/income*100) : 0).toFixed(0)+"%";
  $("#balanceStatus").textContent=balance>=0 ? "Saldo positivo" : "Saldo negativo";
  $("#balanceStatus").style.color=balance>=0 ? "var(--green)" : "var(--red)";
  $("#currentPeriod").textContent=new Date(selectedMonth()+"-15T12:00:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  renderCharts(data); renderTransactions(); renderCategories(); fillCategorySelects();
  lucide.createIcons();
}

function renderCharts(data){
  const days={}; data.forEach(t=>{if(!days[t.date])days[t.date]={income:0,expense:0};days[t.date][t.type]+=t.amount});
  const labels=Object.keys(days).sort();
  const ctx=$("#flowChart").getContext("2d");
  if(flowChart)flowChart.destroy();
  flowChart=new Chart(ctx,{type:"line",data:{labels:labels.map(fmtDate),datasets:[
    {label:"Entradas",data:labels.map(d=>days[d].income),borderColor:"#37d67a",backgroundColor:"rgba(55,214,122,.08)",fill:true,tension:.4,borderWidth:2,pointRadius:2},
    {label:"Saídas",data:labels.map(d=>days[d].expense),borderColor:"#ff6374",backgroundColor:"rgba(255,99,116,.05)",fill:true,tension:.4,borderWidth:2,pointRadius:2}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:"#6f7d89",font:{size:9}}},y:{grid:{color:"rgba(255,255,255,.05)"},ticks:{color:"#6f7d89",font:{size:9},callback:v=>money(v).replace("R$","R$ ")} }}}});

  const totals={};data.filter(t=>t.type==="expense").forEach(t=>totals[t.category]=(totals[t.category]||0)+t.amount);
  const cats=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  const ctx2=$("#categoryChart").getContext("2d"); if(categoryChart)categoryChart.destroy();
  categoryChart=new Chart(ctx2,{type:"doughnut",data:{labels:cats.map(x=>x[0]),datasets:[{data:cats.map(x=>x[1]),backgroundColor:cats.map(x=>catInfo(x[0]).color),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:"72%",plugins:{legend:{display:false}}}});
  $("#categoryLegend").innerHTML=cats.length?cats.slice(0,6).map(x=>`<span>● ${x[0]} ${money(x[1])}</span>`).join(""):"<span>Nenhuma despesa no período</span>";
}

function transactionHTML(t){
  const c=catInfo(t.category);
  return `<div class="transaction">
    <div class="tx-icon ${t.type}" style="background:${c.color}18;color:${c.color}"><i data-lucide="${t.type==="income"?"arrow-down-left":"arrow-up-right"}"></i></div>
    <div class="tx-main"><strong>${escapeHTML(t.description)}</strong><span>${escapeHTML(t.category)} · ${fmtDate(t.date)} · ${escapeHTML(t.payment||"")}</span></div>
    <div class="tx-amount ${t.type}">${t.type==="income"?"+":"−"} ${money(t.amount)}</div>
    <button class="delete-btn" data-delete="${t.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
  </div>`;
}
function renderTransactions(){
  const data=monthTransactions().sort((a,b)=>b.date.localeCompare(a.date));
  $("#recentTransactions").innerHTML=data.slice(0,6).map(transactionHTML).join("") || empty("inbox","Nenhuma movimentação neste período.");
  const search=($("#search")?.value||"").toLowerCase();
  const type=$("#typeFilter")?.value||"all", cat=$("#categoryFilter")?.value||"all";
  const filtered=transactions.filter(t=>(!search||t.description.toLowerCase().includes(search)||t.category.toLowerCase().includes(search))&&(type==="all"||t.type===type)&&(cat==="all"||t.category===cat)).sort((a,b)=>b.date.localeCompare(a.date));
  $("#allTransactions").innerHTML=filtered.map(transactionHTML).join("") || empty("search-x","Nenhum lançamento encontrado.");
  lucide.createIcons();
}
function renderCategories(){
  const sums={};transactions.filter(t=>t.type==="expense").forEach(t=>sums[t.category]=(sums[t.category]||0)+t.amount);
  $("#categoryCards").innerHTML=categories.map(c=>`<div class="category-card"><div class="cat-icon" style="color:${c.color};background:${c.color}18"><i data-lucide="${c.icon}"></i></div><div><strong>${escapeHTML(c.name)}</strong><p>${money(sums[c.name]||0)} em despesas</p></div></div>`).join("");
}
function fillCategorySelects(){
  const opts=categories.map(c=>`<option value="${escapeAttr(c.name)}">${escapeHTML(c.name)}</option>`).join("");
  $("#modalCategory").innerHTML=opts;
  const current=$("#categoryFilter").value||"all";
  $("#categoryFilter").innerHTML=`<option value="all">Todas as categorias</option>${opts}`;
  $("#categoryFilter").value=categories.some(c=>c.name===current)?current:"all";
}
function empty(icon,text){return `<div class="empty"><i data-lucide="${icon}"></i><br>${text}</div>`}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escapeAttr(s){return escapeHTML(s)}

function openModal(){ $("#overlay").classList.add("show");$("#transactionModal").classList.add("show");$("#transactionForm").elements.date.value=new Date().toISOString().slice(0,10); }
function closeModal(){ $("#overlay").classList.remove("show");$("#transactionModal").classList.remove("show");$("#transactionForm").reset();$("#transactionForm").elements.date.value=new Date().toISOString().slice(0,10); }
function toast(msg){const t=$("#toast");t.querySelector("span").textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2300)}

function navigate(section){
  $$(".section").forEach(s=>s.classList.remove("active-section"));
  $(`#${section}`).classList.add("active-section");
  $$(".nav-item[data-section]").forEach(n=>n.classList.toggle("active",n.dataset.section===section));
  $("#sidebar").classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
}

$("#monthFilter").value=today.toISOString().slice(0,7);
seed(); render();

$("#openModal").onclick=openModal; $("#openModal2").onclick=openModal; $("#closeModal").onclick=closeModal; $("#overlay").onclick=closeModal;
$("#mobileMenu").onclick=()=>$("#sidebar").classList.toggle("open");
$$("[data-section]").forEach(b=>b.onclick=()=>navigate(b.dataset.section));
$("#monthFilter").onchange=render;
$("#search").oninput=renderTransactions; $("#typeFilter").onchange=renderTransactions; $("#categoryFilter").onchange=renderTransactions;

$("#transactionForm").onsubmit=e=>{
  e.preventDefault();const f=new FormData(e.target);
  const t={id:crypto.randomUUID(),type:f.get("type"),description:f.get("description").trim(),amount:Number(f.get("amount")),date:f.get("date"),category:f.get("category"),payment:f.get("payment"),note:f.get("note")};
  if(!t.description||!t.amount||!t.date)return;
  transactions.push(t);save();closeModal();$("#monthFilter").value=t.date.slice(0,7);render();toast("Lançamento salvo com sucesso.");
};
document.addEventListener("click",e=>{
  const btn=e.target.closest("[data-delete]");
  if(btn){const id=btn.dataset.delete;if(confirm("Excluir este lançamento?")){transactions=transactions.filter(t=>t.id!==id);save();render();toast("Lançamento excluído.");}}
});
$("#addCategory").onclick=()=>{
  const name=prompt("Nome da nova categoria:");
  if(!name?.trim())return;
  if(categories.some(c=>c.name.toLowerCase()===name.trim().toLowerCase()))return toast("Essa categoria já existe.");
  categories.push({name:name.trim(),icon:"tag",color:"#5ca8ff"});save();render();toast("Categoria criada.");
};
$("#clearData").onclick=()=>{
  if(confirm("Isso apagará todos os lançamentos e categorias personalizadas. Continuar?")){
    localStorage.removeItem(KEY);localStorage.removeItem(CAT_KEY);transactions=[];categories=defaultCategories;seed();render();toast("Dados restaurados.");
  }
};
