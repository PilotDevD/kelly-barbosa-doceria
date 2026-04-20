/* ============================================================
   Kelly Barbosa - Lógica do cardápio e do carrinho (cliente)
   ============================================================ */

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const EMOJI_BY_CAT = { 'Bolos': '🎂', 'Doces': '🍰', 'Papelaria': '🎁', 'Outros': '🧁' };

const state = {
  produtos: [],
  categoria: 'Todos',
  cart: JSON.parse(localStorage.getItem('kb_cart') || '[]')
};

const $ = (id) => document.getElementById(id);

// ---------- Produtos de demonstração (só aparecem se o Supabase não estiver configurado) ----------
const DEMO_PRODUTOS = [
  { id: 'd1', nome: 'Bolo de Chocolate', descricao: 'Massa fofinha com recheio de brigadeiro e cobertura cremosa', categoria: 'Bolos', preco: 85.00, ativo: true },
  { id: 'd2', nome: 'Bolo Red Velvet', descricao: 'Com cream cheese e decoração exclusiva para festas', categoria: 'Bolos', preco: 120.00, ativo: true },
  { id: 'd3', nome: 'Bolo Naked de Morango', descricao: 'Bolo descoberto com morangos frescos e chantilly', categoria: 'Bolos', preco: 140.00, ativo: true },
  { id: 'd4', nome: 'Brigadeiro Gourmet', descricao: 'Caixa com 20 unidades, sabores variados', categoria: 'Doces', preco: 45.00, ativo: true },
  { id: 'd5', nome: 'Beijinho de Coco', descricao: 'Caixa com 20 unidades, coco fresco ralado', categoria: 'Doces', preco: 42.00, ativo: true },
  { id: 'd6', nome: 'Cake Pop Personalizado', descricao: 'Pirulitos de bolo decorados — 10 unidades', categoria: 'Doces', preco: 55.00, ativo: true },
  { id: 'd7', nome: 'Convite Aniversário', descricao: 'Papelaria personalizada com tema da festa', categoria: 'Papelaria', preco: 4.50, ativo: true },
  { id: 'd8', nome: 'Topo de Bolo', descricao: 'Topo personalizado em papel especial', categoria: 'Papelaria', preco: 25.00, ativo: true }
];

function supabaseConfigurado() {
  return typeof SUPABASE_URL === 'string'
    && SUPABASE_URL.startsWith('https://')
    && !SUPABASE_URL.includes('COLE_AQUI');
}

// ---------- Carregar produtos ----------
async function loadProducts() {
  // Modo demonstração: Supabase ainda não foi configurado
  if (!supabaseConfigurado()) {
    state.produtos = DEMO_PRODUTOS;
    $('loading').hidden = true;
    mostrarAvisoDemo();
    renderCategories();
    renderProducts();
    return;
  }

  const { data, error } = await supabaseClient
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .order('categoria', { ascending: true })
    .order('nome', { ascending: true });

  $('loading').hidden = true;

  if (error) {
    $('empty').hidden = false;
    $('empty').innerHTML = '😕 Não foi possível carregar o cardápio.<br><small>' + escapeHtml(error.message) + '</small>';
    console.error(error);
    return;
  }

  state.produtos = data || [];
  if (state.produtos.length === 0) {
    $('empty').hidden = false;
    $('empty').textContent = 'Nenhum produto cadastrado ainda. A Kelly já vai adicionar os docinhos! 🍰';
    return;
  }
  renderCategories();
  renderProducts();
}

function mostrarAvisoDemo() {
  const aviso = document.createElement('div');
  aviso.style.cssText = 'background:#FEF3C7;border:1px solid #FCD34D;color:#92400E;padding:12px 16px;margin:0 20px 10px;border-radius:12px;font-size:13px;text-align:center;max-width:1200px;margin-left:auto;margin-right:auto;';
  aviso.innerHTML = '⚠️ <strong>Modo de demonstração</strong>';
  document.querySelector('.categories').before(aviso);
}

function renderCategories() {
  const cats = ['Todos', ...new Set(state.produtos.map(p => p.categoria || 'Outros'))];
  $('categories').innerHTML = cats.map(c => `
    <button class="category-chip ${c === state.categoria ? 'active' : ''}" data-cat="${c}">${c}</button>
  `).join('');
  $('categories').querySelectorAll('.category-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.categoria = btn.dataset.cat;
      renderCategories();
      renderProducts();
    });
  });
}

function renderProducts() {
  const filtered = state.categoria === 'Todos'
    ? state.produtos
    : state.produtos.filter(p => (p.categoria || 'Outros') === state.categoria);

  $('productsGrid').innerHTML = filtered.map(p => {
    const img = p.foto_url
      ? `<img class="product-image" src="${p.foto_url}" alt="${escapeHtml(p.nome)}" loading="lazy">`
      : `<div class="product-image">${EMOJI_BY_CAT[p.categoria] || '🧁'}</div>`;
    return `
      <article class="product-card">
        ${img}
        <div class="product-body">
          <span class="product-category">${escapeHtml(p.categoria || 'Outros')}</span>
          <h3 class="product-name">${escapeHtml(p.nome)}</h3>
          <p class="product-desc">${escapeHtml(p.descricao || '')}</p>
          <div class="product-footer">
            <span class="product-price">${brl(Number(p.preco))}</span>
            <button class="add-btn" data-id="${p.id}" aria-label="Adicionar ${escapeHtml(p.nome)}">+</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  $('productsGrid').querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
  });
}

// ---------- Carrinho ----------
function saveCart() {
  localStorage.setItem('kb_cart', JSON.stringify(state.cart));
  renderCart();
}

function addToCart(id) {
  const p = state.produtos.find(x => String(x.id) === String(id));
  if (!p) return;
  const existing = state.cart.find(i => String(i.id) === String(id));
  if (existing) existing.qtd += 1;
  else state.cart.push({ id: p.id, nome: p.nome, preco: Number(p.preco), foto_url: p.foto_url, categoria: p.categoria, qtd: 1 });
  saveCart();
  bumpCart();
}

function removeFromCart(id) {
  state.cart = state.cart.filter(i => String(i.id) !== String(id));
  saveCart();
}

function changeQty(id, delta) {
  const item = state.cart.find(i => String(i.id) === String(id));
  if (!item) return;
  item.qtd += delta;
  if (item.qtd <= 0) return removeFromCart(id);
  saveCart();
}

function cartTotal() {
  return state.cart.reduce((s, i) => s + i.preco * i.qtd, 0);
}

function renderCart() {
  const count = state.cart.reduce((s, i) => s + i.qtd, 0);
  $('cartCount').textContent = count;
  $('checkoutBtn').disabled = count === 0;

  if (!state.cart.length) {
    $('cartItems').innerHTML = `<p class="cart-empty">Seu carrinho está vazio.<br>Adicione alguns docinhos! 🍰</p>`;
  } else {
    $('cartItems').innerHTML = state.cart.map(i => {
      const img = i.foto_url
        ? `<img class="cart-item-image" src="${i.foto_url}" alt="">`
        : `<div class="cart-item-image">${EMOJI_BY_CAT[i.categoria] || '🧁'}</div>`;
      return `
        <div class="cart-item">
          ${img}
          <div class="cart-item-info">
            <p class="cart-item-name">${escapeHtml(i.nome)}</p>
            <p class="cart-item-price">${brl(i.preco)} cada</p>
            <div class="qty">
              <button data-act="minus" data-id="${i.id}">−</button>
              <span>${i.qtd}</span>
              <button data-act="plus" data-id="${i.id}">+</button>
              <button class="remove-btn" data-act="remove" data-id="${i.id}">remover</button>
            </div>
          </div>
          <strong>${brl(i.preco * i.qtd)}</strong>
        </div>
      `;
    }).join('');

    $('cartItems').querySelectorAll('button[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.id;
        if (b.dataset.act === 'plus') changeQty(id, 1);
        if (b.dataset.act === 'minus') changeQty(id, -1);
        if (b.dataset.act === 'remove') removeFromCart(id);
      });
    });
  }
  $('cartTotal').textContent = brl(cartTotal());
}

function bumpCart() {
  const el = $('cartBtn');
  el.style.transform = 'scale(1.15)';
  setTimeout(() => el.style.transform = '', 180);
}

// ---------- Drawer + modais ----------
function openCart() {
  $('cartDrawer').classList.add('open');
  $('overlay').classList.add('open');
  $('cartDrawer').setAttribute('aria-hidden', 'false');
}
function closeCart() {
  $('cartDrawer').classList.remove('open');
  $('overlay').classList.remove('open');
  $('cartDrawer').setAttribute('aria-hidden', 'true');
}
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

$('cartBtn').addEventListener('click', openCart);
$('closeCart').addEventListener('click', closeCart);
$('overlay').addEventListener('click', closeCart);

$('checkoutBtn').addEventListener('click', () => {
  closeCart();
  renderSummary();
  openModal('checkoutModal');
});
$('closeCheckout').addEventListener('click', () => closeModal('checkoutModal'));
$('closeSuccess').addEventListener('click', () => closeModal('successModal'));

function renderSummary() {
  const rows = state.cart.map(i => `
    <div class="summary-row"><span>${i.qtd}× ${escapeHtml(i.nome)}</span><span>${brl(i.preco * i.qtd)}</span></div>
  `).join('');
  $('orderSummary').innerHTML = rows + `
    <div class="summary-row summary-total"><span>Total</span><span>${brl(cartTotal())}</span></div>
  `;
}

// ---------- Envio do pedido ----------
$('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('submitOrder');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const pedido = {
    cliente_nome: $('nome').value.trim(),
    cliente_telefone: $('telefone').value.trim(),
    cliente_endereco: $('endereco').value.trim(),
    forma_pagamento: $('pagamento').value,
    observacoes: $('observacoes').value.trim(),
    itens: state.cart.map(i => ({ id: i.id, nome: i.nome, preco: i.preco, qtd: i.qtd })),
    total: cartTotal(),
    status: 'novo'
  };

  const { error } = await supabaseClient.from('pedidos').insert(pedido);

  btn.disabled = false;
  btn.textContent = 'Confirmar Pedido';

  if (error) {
    alert('Ops! Não foi possível enviar seu pedido. Tente novamente em instantes.\n\n' + error.message);
    return;
  }

  state.cart = [];
  saveCart();
  closeModal('checkoutModal');
  $('checkoutForm').reset();
  openModal('successModal');
});

// ---------- Utils ----------
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ---------- Init ----------
renderCart();
loadProducts();
