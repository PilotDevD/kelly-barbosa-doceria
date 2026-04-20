/* ============================================================
   Kelly Barbosa - Painel Administrativo
   ============================================================ */

const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const EMOJI_BY_CAT = { 'Bolos': '🎂', 'Doces': '🍰', 'Papelaria': '🎁', 'Outros': '🧁' };
const STATUS = ['novo', 'preparando', 'saiu_entrega', 'entregue', 'cancelado'];
const STATUS_LABEL = {
  novo: '🆕 Novo',
  preparando: '👩‍🍳 Preparando',
  saiu_entrega: '🛵 Saiu para entrega',
  entregue: '✅ Entregue',
  cancelado: '❌ Cancelado'
};

const $ = (id) => document.getElementById(id);
let produtos = [];
let pedidos = [];

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
  try { subscribeRealtime(); } catch (e) { console.warn('[realtime]', e); }
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

// Triplo gatilho: submit do form + click no botão + Enter no campo de senha
$('loginForm').addEventListener('submit', handleLogin);
const loginBtn = document.querySelector('#loginForm button[type="submit"]');
if (loginBtn) loginBtn.addEventListener('click', handleLogin);
$('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(e); });

$('logoutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  showLogin();
});

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const name = tab.dataset.tab;
    $('tab-pedidos').hidden = name !== 'pedidos';
    $('tab-produtos').hidden = name !== 'produtos';
  });
});

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
}

function renderPedidos() {
  const novos = pedidos.filter(p => p.status === 'novo').length;
  $('badgePedidos').textContent = novos;

  if (!pedidos.length) {
    $('ordersList').innerHTML = `<p class="empty">Ainda não chegou nenhum pedido. 🍰</p>`;
    return;
  }

  $('ordersList').innerHTML = pedidos.map(p => {
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
        <div class="order-items">
          <ul>${items}</ul>
        </div>
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

let realtimeChannel = null;
function subscribeRealtime() {
  try {
    if (realtimeChannel) return; // já inscrito nesta sessão
    realtimeChannel = supabaseClient
      .channel('pedidos-realtime-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        loadPedidos();
        try { new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAA').play(); } catch(e){}
      })
      .subscribe();
  } catch (e) {
    console.warn('[realtime] não foi possível inscrever:', e);
  }
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
      <div class="admin-product-card ${p.ativo ? '' : 'inactive'}">
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

// ---------- Utils ----------
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// Init
checkSession();
