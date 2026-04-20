/* ============================================================
   Kelly Barbosa - Painel Administrativo (v2)
   ============================================================ */

const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const EMOJI_BY_CAT = { 'Bolos': '🎂', 'Doces': '🍰', 'Papelaria': '🎁', 'Outros': '🧁' };
const STATUS = ['novo', 'preparando', 'saiu_entrega', 'entregue', 'cancelado'];
const STATUS_LABEL = {
  novo: '🆕 Novo',
  preparando: '👩‍🍳 Preparando',
  saiu_entrega: '🛵 Saiu para entrega',
  entregue: '✅ Entregue',
  cancelado: '❌ Cancelado'
};
const TAB_META = {
  dashboard:  { title: 'Dashboard',  subtitle: 'Visão geral do seu negócio' },
  pedidos:    { title: 'Pedidos',    subtitle: 'Gerencie todos os pedidos recebidos' },
  produtos:   { title: 'Produtos',   subtitle: 'Cadastre e edite o seu catálogo' },
  financeiro: { title: 'Financeiro', subtitle: 'Acompanhe receitas, despesas e lucro' }
};

const $ = (id) => document.getElementById(id);
let produtos = [];
let pedidos = [];
let despesas = [];
let currentTab = 'dashboard';
let ordersFilter = 'todos';

// ---------- Login ----------
async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) showApp();
  else showLogin();
}

function showLogin() {
  $('loginScreen').hidden = false;
  $('adminApp').hidden = true;
}
function showApp() {
  $('loginScreen').hidden = true;
  $('adminApp').hidden = false;
  try { loadPedidos(); } catch (e) { console.warn('[pedidos]', e); }
  try { loadProdutos(); } catch (e) { console.warn('[produtos]', e); }
  try { loadDespesas(); } catch (e) { console.warn('[despesas]', e); }
  try { subscribeRealtime(); } catch (e) { console.warn('[realtime]', e); }
  setTab('dashboard');
}

async function handleLogin(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  if (window.__loginInProgress) return;
  window.__loginInProgress = true;

  const errorEl = $('loginError');
  const submitBtn = document.querySelector('#loginForm button[type="submit"]');
  errorEl.style.color = '#DC2626';
  errorEl.textContent = '[1/4] iniciando...';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Entrando...'; }

  try {
    errorEl.textContent = '[2/4] verificando supabase...';
    if (typeof window.supabase === 'undefined') throw new Error('SDK supabase-js não carregou (CDN bloqueado?).');
    if (typeof supabaseClient === 'undefined') throw new Error('supabaseClient indefinido — verifique supabase.js.');

    errorEl.textContent = '[3/4] enviando credenciais...';
    const email = ($('email').value || '').trim();
    const password = $('password').value || '';
    if (!email || !password) throw new Error('Preencha e-mail e senha.');

    const resp = await supabaseClient.auth.signInWithPassword({ email, password });
    if (resp.error) throw resp.error;
    if (!resp.data?.session) throw new Error('Sem sessão na resposta.');

    errorEl.style.color = '#059669';
    errorEl.textContent = '[4/4] autenticado! abrindo painel...';
    setTimeout(() => showApp(), 150);
  } catch (err) {
    console.error('[login] erro completo:', err);
    errorEl.style.color = '#DC2626';
    errorEl.textContent = '❌ ' + (err.message || err.error_description || JSON.stringify(err));
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Entrar'; }
    window.__loginInProgress = false;
  }
}

$('loginForm').addEventListener('submit', handleLogin);
const loginBtn = document.querySelector('#loginForm button[type="submit"]');
if (loginBtn) loginBtn.addEventListener('click', handleLogin);
$('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(e); });

$('logoutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  showLogin();
});

// ---------- Navegação (sidebar) ----------
function setTab(name) {
  if (!TAB_META[name]) name = 'dashboard';
  currentTab = name;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(t => { t.hidden = t.id !== 'tab-' + name; });

  $('topbarTitle').textContent = TAB_META[name].title;
  $('topbarSubtitle').textContent = TAB_META[name].subtitle;

  closeSidebar();

  if (name === 'dashboard') renderDashboard();
  if (name === 'financeiro') renderFinanceiro();
}

document.querySelectorAll('.nav-item').forEach(n => {
  n.addEventListener('click', () => setTab(n.dataset.tab));
});

// "Ver todos" no dashboard
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-goto]');
  if (t) setTab(t.dataset.goto);
});

// Sidebar mobile
function openSidebar() {
  $('sidebar').classList.add('open');
  $('sidebarBackdrop').classList.add('open');
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebarBackdrop').classList.remove('open');
}
$('menuToggle').addEventListener('click', openSidebar);
$('sidebarBackdrop').addEventListener('click', closeSidebar);

// ---------- Pedidos ----------
async function loadPedidos() {
  const { data, error } = await supabaseClient
    .from('pedidos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    $('ordersList').innerHTML = `<p class="empty">Erro ao carregar pedidos.</p>`;
    console.error(error);
    return;
  }
  pedidos = data || [];
  renderPedidos();
  renderDashboard();
}

function renderPedidos() {
  const novos = pedidos.filter(p => p.status === 'novo').length;
  $('badgePedidos').textContent = novos;

  const filtered = ordersFilter === 'todos' ? pedidos : pedidos.filter(p => p.status === ordersFilter);

  if (!filtered.length) {
    $('ordersList').innerHTML = `<p class="empty">Nenhum pedido ${ordersFilter === 'todos' ? 'ainda' : 'com este filtro'}. 🍰</p>`;
    return;
  }

  $('ordersList').innerHTML = filtered.map(p => {
    const items = (p.itens || []).map(i => `<li>${i.qtd}× ${escapeHtml(i.nome)} — ${brl(i.preco * i.qtd)}</li>`).join('');
    const statusClass = p.status === 'entregue' ? 'status-entregue' : (p.status === 'preparando' ? 'status-preparando' : '');
    const telLink = (p.cliente_telefone || '').replace(/\D/g, '');
    const when = new Date(p.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    return `
      <article class="order-card ${statusClass}" data-id="${p.id}">
        <div class="order-top">
          <strong>${escapeHtml(p.cliente_nome)}</strong>
          <span class="order-time">${when}</span>
        </div>
        <p class="order-info">📱 <a href="https://wa.me/55${telLink}" target="_blank" rel="noopener">${escapeHtml(p.cliente_telefone || '-')}</a></p>
        <p class="order-info">📍 ${escapeHtml(p.cliente_endereco || '-')}</p>
        <p class="order-info">💳 ${escapeHtml(p.forma_pagamento || '-')}</p>
        ${p.observacoes ? `<p class="order-info">📝 ${escapeHtml(p.observacoes)}</p>` : ''}
        <div class="order-items"><ul>${items}</ul></div>
        <p class="order-total">Total: ${brl(p.total)}</p>
        <div class="order-actions">
          <select data-act="status" data-id="${p.id}">
            ${STATUS.map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
          </select>
          <button class="delete-btn" data-act="delete" data-id="${p.id}">Excluir</button>
        </div>
      </article>
    `;
  }).join('');

  $('ordersList').querySelectorAll('[data-act="status"]').forEach(sel => {
    sel.addEventListener('change', async () => {
      await supabaseClient.from('pedidos').update({ status: sel.value }).eq('id', sel.dataset.id);
      loadPedidos();
    });
  });
  $('ordersList').querySelectorAll('[data-act="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este pedido? Esta ação não pode ser desfeita.')) return;
      await supabaseClient.from('pedidos').delete().eq('id', btn.dataset.id);
      loadPedidos();
    });
  });
}

$('ordersFilter').addEventListener('change', (e) => {
  ordersFilter = e.target.value;
  renderPedidos();
});

let realtimeChannel = null;
function subscribeRealtime() {
  try {
    if (realtimeChannel) return;
    realtimeChannel = supabaseClient
      .channel('pedidos-realtime-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        loadPedidos();
        try { new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAA').play(); } catch(e){}
      })
      .subscribe();
  } catch (e) { console.warn('[realtime]', e); }
}

// ---------- Dashboard ----------
function isToday(d) {
  const x = new Date(d);
  const t = new Date();
  return x.getFullYear() === t.getFullYear() && x.getMonth() === t.getMonth() && x.getDate() === t.getDate();
}
function isLastNDays(d, n) {
  const x = new Date(d).getTime();
  return (Date.now() - x) <= n * 24 * 3600 * 1000;
}
function paidPedidos(arr) {
  return (arr || []).filter(p => p.status !== 'cancelado');
}

function renderDashboard() {
  const paid = paidPedidos(pedidos);
  const today = paid.filter(p => isToday(p.created_at));
  const month = paid.filter(p => isLastNDays(p.created_at, 30));
  const preparing = pedidos.filter(p => p.status === 'preparando' || p.status === 'novo').length;

  $('statOrdersToday').textContent = today.length;
  $('statOrdersTodaySub').textContent = today.length ? `${today.length} venda${today.length > 1 ? 's' : ''} hoje` : 'Nenhum pedido ainda';
  $('statRevenueToday').textContent = brl(today.reduce((s, p) => s + Number(p.total || 0), 0));
  $('statPreparing').textContent = preparing;
  $('statRevenueMonth').textContent = brl(month.reduce((s, p) => s + Number(p.total || 0), 0));
  $('statRevenueMonthSub').textContent = `${month.length} pedido${month.length !== 1 ? 's' : ''} nos últimos 30 dias`;

  // Pedidos recentes (últimos 5)
  const recent = pedidos.slice(0, 5);
  $('recentOrders').innerHTML = recent.length ? recent.map(p => `
    <div class="recent-order-item">
      <div>
        <strong>${escapeHtml(p.cliente_nome)}</strong>
        <div class="meta">${new Date(p.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${STATUS_LABEL[p.status] || p.status}</div>
      </div>
      <span class="amount">${brl(p.total)}</span>
    </div>
  `).join('') : `<p class="empty">Ainda não chegou nenhum pedido. 🍰</p>`;

  // Top produtos (baseado em pedidos pagos)
  const tally = {};
  paid.forEach(p => (p.itens || []).forEach(i => {
    tally[i.nome] = (tally[i.nome] || 0) + Number(i.qtd || 0);
  }));
  const top = Object.entries(tally).sort((a,b) => b[1] - a[1]).slice(0, 5);
  $('topProducts').innerHTML = top.length ? top.map(([nome, qtd], i) => `
    <div class="top-product">
      <span class="rank">${i + 1}</span>
      <span class="name">${escapeHtml(nome)}</span>
      <span class="count">${qtd} vendido${qtd > 1 ? 's' : ''}</span>
    </div>
  `).join('') : `<p class="empty">Aparecerá aqui quando houver pedidos.</p>`;
}

// ---------- Produtos ----------
async function loadProdutos() {
  const { data, error } = await supabaseClient
    .from('produtos')
    .select('*')
    .order('categoria')
    .order('nome');
  if (error) { console.error(error); return; }
  produtos = data || [];
  renderProdutos();
}

function renderProdutos() {
  if (!produtos.length) {
    $('productsAdmin').innerHTML = `<p class="empty">Você ainda não cadastrou nenhum produto.<br>Clique em "+ Novo Produto" para começar!</p>`;
    return;
  }
  $('productsAdmin').innerHTML = produtos.map(p => {
    const img = p.foto_url
      ? `<img class="admin-product-img" src="${p.foto_url}" alt="">`
      : `<div class="admin-product-img">${EMOJI_BY_CAT[p.categoria] || '🧁'}</div>`;
    return `
      <div class="admin-product-card ${p.ativo ? '' : 'inactive'}" style="display:flex;gap:12px;align-items:center">
        ${img}
        <div class="admin-product-info">
          <h4>${escapeHtml(p.nome)}</h4>
          <p>${escapeHtml(p.categoria || '')}</p>
          <strong>${brl(p.preco)}</strong>
          ${p.ativo ? '' : '<br><span style="color:#9CA3AF;font-size:12px">inativo</span>'}
        </div>
        <div class="admin-product-actions">
          <button class="icon-btn" data-act="edit" data-id="${p.id}" title="Editar">✏️</button>
          <button class="icon-btn danger" data-act="delete" data-id="${p.id}" title="Excluir">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  $('productsAdmin').querySelectorAll('[data-act="edit"]').forEach(b => {
    b.addEventListener('click', () => openProductForm(b.dataset.id));
  });
  $('productsAdmin').querySelectorAll('[data-act="delete"]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Excluir este produto?')) return;
      await supabaseClient.from('produtos').delete().eq('id', b.dataset.id);
      loadProdutos();
    });
  });
}

$('addProductBtn').addEventListener('click', () => openProductForm(null));
$('closeProduct').addEventListener('click', () => $('productModal').classList.remove('open'));

function openProductForm(id) {
  const p = id ? produtos.find(x => String(x.id) === String(id)) : null;
  $('productModalTitle').textContent = p ? 'Editar Produto' : 'Novo Produto';
  $('productId').value = p?.id || '';
  $('productNome').value = p?.nome || '';
  $('productDescricao').value = p?.descricao || '';
  $('productCategoria').value = p?.categoria || 'Bolos';
  $('productPreco').value = p?.preco ?? '';
  $('productAtivo').checked = p ? p.ativo : true;
  $('productFoto').value = '';
  $('productError').textContent = '';
  const preview = $('productPreview');
  if (p?.foto_url) { preview.src = p.foto_url; preview.hidden = false; } else { preview.hidden = true; }
  $('productModal').classList.add('open');
}

$('productFoto').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => { $('productPreview').src = ev.target.result; $('productPreview').hidden = false; };
  reader.readAsDataURL(f);
});

$('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('saveProductBtn');
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  $('productError').textContent = '';

  try {
    const id = $('productId').value || null;
    const base = {
      nome: $('productNome').value.trim(),
      descricao: $('productDescricao').value.trim(),
      categoria: $('productCategoria').value,
      preco: Number($('productPreco').value),
      ativo: $('productAtivo').checked
    };

    const file = $('productFoto').files?.[0];
    if (file) {
      const path = `produtos/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
      const up = await supabaseClient.storage.from('fotos').upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { data: pub } = supabaseClient.storage.from('fotos').getPublicUrl(path);
      base.foto_url = pub.publicUrl;
    }

    const res = id
      ? await supabaseClient.from('produtos').update(base).eq('id', id)
      : await supabaseClient.from('produtos').insert(base);
    if (res.error) throw res.error;

    $('productModal').classList.remove('open');
    loadProdutos();
  } catch (err) {
    $('productError').textContent = 'Erro ao salvar: ' + (err.message || err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
});

// ---------- Financeiro (placeholder - Task 2 implementa CRUD) ----------
async function loadDespesas() {
  try {
    const { data, error } = await supabaseClient
      .from('despesas')
      .select('*')
      .order('data', { ascending: false });
    if (error) { despesas = []; return; }
    despesas = data || [];
    if (currentTab === 'financeiro') renderFinanceiro();
  } catch (e) { despesas = []; }
}

function renderFinanceiro() {
  const dias = Number($('finPeriodo')?.value || 30);
  const paid = paidPedidos(pedidos).filter(p => isLastNDays(p.created_at, dias));
  const desp = (despesas || []).filter(d => isLastNDays(d.data, dias));

  const receita = paid.reduce((s, p) => s + Number(p.total || 0), 0);
  const totalDesp = desp.reduce((s, d) => s + Number(d.valor || 0), 0);
  const lucro = receita - totalDesp;

  $('finRevenue').textContent = brl(receita);
  $('finRevenueSub').textContent = `${paid.length} pedido${paid.length !== 1 ? 's' : ''}`;
  $('finExpenses').textContent = brl(totalDesp);
  $('finExpensesSub').textContent = `${desp.length} despesa${desp.length !== 1 ? 's' : ''}`;
  $('finProfit').textContent = brl(lucro);
  $('finProfitSub').textContent = lucro >= 0 ? '✅ Positivo' : '⚠️ Negativo';
  $('finOrdersCount').textContent = paid.length;

  const body = $('despesasBody');
  if (!desp.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty">Nenhuma despesa registrada no período. Clique em "+ Nova Despesa".</td></tr>`;
    return;
  }
  body.innerHTML = desp.map(d => `
    <tr>
      <td>${new Date(d.data).toLocaleDateString('pt-BR')}</td>
      <td>${escapeHtml(d.descricao)}${d.observacoes ? `<br><small style="color:#94A3B8">${escapeHtml(d.observacoes)}</small>` : ''}</td>
      <td><span class="category-tag">${escapeHtml(d.categoria || 'Outros')}</span></td>
      <td class="right amount-cell">${brl(d.valor)}</td>
      <td class="right">
        <button class="icon-btn" data-act="edit-desp" data-id="${d.id}" title="Editar">✏️</button>
        <button class="icon-btn danger" data-act="del-desp" data-id="${d.id}" title="Excluir">🗑️</button>
      </td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-act="edit-desp"]').forEach(b => {
    b.addEventListener('click', () => openDespesaForm(b.dataset.id));
  });
  body.querySelectorAll('[data-act="del-desp"]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Excluir esta despesa?')) return;
      await supabaseClient.from('despesas').delete().eq('id', b.dataset.id);
      loadDespesas();
    });
  });
}

$('finPeriodo')?.addEventListener('change', renderFinanceiro);
$('addDespesaBtn')?.addEventListener('click', () => openDespesaForm(null));
$('closeDespesa')?.addEventListener('click', () => $('despesaModal').classList.remove('open'));

function openDespesaForm(id) {
  const d = id ? despesas.find(x => String(x.id) === String(id)) : null;
  $('despesaModalTitle').textContent = d ? 'Editar Despesa' : 'Nova Despesa';
  $('despesaId').value = d?.id || '';
  $('despesaDescricao').value = d?.descricao || '';
  $('despesaCategoria').value = d?.categoria || 'Ingredientes';
  $('despesaValor').value = d?.valor ?? '';
  $('despesaData').value = d?.data || new Date().toISOString().slice(0, 10);
  $('despesaObs').value = d?.observacoes || '';
  $('despesaError').textContent = '';
  $('despesaModal').classList.add('open');
}

$('despesaForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('saveDespesaBtn');
  btn.disabled = true; btn.textContent = 'Salvando...';
  $('despesaError').textContent = '';
  try {
    const id = $('despesaId').value || null;
    const base = {
      descricao: $('despesaDescricao').value.trim(),
      categoria: $('despesaCategoria').value,
      valor: Number($('despesaValor').value),
      data: $('despesaData').value,
      observacoes: $('despesaObs').value.trim() || null
    };
    const res = id
      ? await supabaseClient.from('despesas').update(base).eq('id', id)
      : await supabaseClient.from('despesas').insert(base);
    if (res.error) throw res.error;
    $('despesaModal').classList.remove('open');
    loadDespesas();
  } catch (err) {
    $('despesaError').textContent = 'Erro: ' + (err.message || err);
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar';
  }
});

// ---------- Utils ----------
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// Init
checkSession();
