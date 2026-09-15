// ==========================================
// SISTEMA PDV — FIREBASE + PWA + DASHBOARD BI + FILTROS CUSTOMIZADOS
// ==========================================

let estoque = [];
let vendas = [];
let usuarios = [];
let entregas = [];
let config = { chavePix: '' };
let carrinho = [];
let usuarioLogado = null;
let imgBase64Temp = ''; 
let leitorCameraQr = null; 

// Filtros do Dashboard
let dashFiltroPagamento = null;
let dashFiltroUsuario = null;

// Variáveis Firebase
let firebaseDatabase = null;
let fbRef = null;
let fbSet = null;
let fbOnValue = null;
let fbChild = null;

let modoPixAtual = 'caixa';
let idEntregaPix = null;

// ==========================================
// REGISTRO DO SERVICE WORKER (APP INSTALÁVEL)
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('Erro no SW:', err));
  });
}

// ==========================================
// INICIALIZAÇÃO FIREBASE (ESTOQUE EM TEMPO REAL)
// ==========================================
async function iniciarSistemaFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
    const { getDatabase, ref, set, onValue, child } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js');

    const firebaseConfig = {
      apiKey: 'AIzaSyCEwDKZonaRqLQtZf4_5xSobNOH-bl6jcE',
      authDomain: 'lojinha-virtual-1c7b0.firebaseapp.com',
      databaseURL: 'https://lojinha-virtual-1c7b0-default-rtdb.firebaseio.com',
      projectId: 'lojinha-virtual-1c7b0',
      storageBucket: 'lojinha-virtual-1c7b0.firebasestorage.app',
      messagingSenderId: '268453804419',
      appId: '1:268453804419:web:ace3444c18e047d9031eb6',
      measurementId: 'G-Z46TR8XM35'
    };

    const app = initializeApp(firebaseConfig);
    firebaseDatabase = getDatabase(app);
    fbRef = ref;
    fbSet = set;
    fbOnValue = onValue;
    fbChild = child;
    
    iniciarEscutaGlobalTempoReal();
  } catch (error) {
    console.error('Sem conexão. Iniciando modo Offline Local.', error);
    carregarDadosLocais();
    inicializarAdminPadrao();
    restaurarEstadoDoNavegador();
  }
}

window.onload = function() {
  iniciarSistemaFirebase();
};

function iniciarEscutaGlobalTempoReal() {
  const dbRoot = fbRef(firebaseDatabase, 'PDV');
  fbOnValue(dbRoot, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      estoque = data.estoque || [];
      vendas = data.vendas || [];
      usuarios = data.usuarios || [];
      entregas = data.entregas || [];
      config = data.config || { chavePix: '' };
      
      salvarDadosLocaisSilencioso();
      atualizarTelasEmTempoReal();
    } else {
      carregarDadosLocais();
      inicializarAdminPadrao();
      salvarNoFirebaseSilencioso('estoque', estoque);
      salvarNoFirebaseSilencioso('vendas', vendas);
      salvarNoFirebaseSilencioso('usuarios', usuarios);
      salvarNoFirebaseSilencioso('entregas', entregas);
      salvarNoFirebaseSilencioso('config', config);
      atualizarTelasEmTempoReal();
    }
  });

  setTimeout(restaurarEstadoDoNavegador, 500);
}

function atualizarTelasEmTempoReal() {
  const telaAtual = localStorage.getItem('telaAtual');
  if (telaAtual === 'venda') renderizarProdutos();
  if (telaAtual === 'entregador') renderizarTelaEntregador();
  if (telaAtual === 'adm') {
    renderizarDashboard();
    renderizarListaEstoqueAdm();
    renderizarUsuariosAdm();
  }
}

function carregarDadosLocais() {
  estoque = JSON.parse(localStorage.getItem('estoque')) || [];
  vendas = JSON.parse(localStorage.getItem('vendas')) || [];
  usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
  entregas = JSON.parse(localStorage.getItem('entregas')) || [];
  config = JSON.parse(localStorage.getItem('config')) || { chavePix: '' };
}

function salvarDadosLocaisSilencioso() {
  localStorage.setItem('estoque', JSON.stringify(estoque));
  localStorage.setItem('vendas', JSON.stringify(vendas));
  localStorage.setItem('usuarios', JSON.stringify(usuarios));
  localStorage.setItem('entregas', JSON.stringify(entregas));
  localStorage.setItem('config', JSON.stringify(config));
}

function salvarNoFirebaseSilencioso(chave, dados) {
  if (firebaseDatabase) {
    fbSet(fbRef(firebaseDatabase, 'PDV/' + chave), dados).catch(err => console.log('Offline.', err));
  }
  salvarDadosLocaisSilencioso();
}

function inicializarAdminPadrao() {
  const adminMaster = usuarios.find(u => u.user === 'au.costa');
  if (!adminMaster) {
    usuarios.push({ id: Date.now(), user: 'au.costa', senha: '80605276', perfil: 'admin', permissoes: 'ALL' });
    salvarNoFirebaseSilencioso('usuarios', usuarios);
  }
}

// ==========================================
// NAVEGAÇÃO E PERSISTÊNCIA DE TELA
// ==========================================
function restaurarEstadoDoNavegador() {
  const salvoUser = localStorage.getItem('usuarioLogado');
  
  if (salvoUser) {
    const userLocal = JSON.parse(salvoUser);
    usuarioLogado = usuarios.find(u => u.id === userLocal.id) || userLocal;
    carrinho = JSON.parse(localStorage.getItem('carrinhoPendente')) || [];
    
    const telaSalva = localStorage.getItem('telaAtual') || 'venda';
    const abaSalva = localStorage.getItem('abaAtual') || 'dashboard';
    
    const isMasterAdmin = (usuarioLogado.user === 'au.costa' || usuarioLogado.perfil === 'admin' || usuarioLogado.isAdmin);
    
    if (usuarioLogado.perfil === 'entregador') {
      irPara('entregador');
    } else {
      document.getElementById('nome-operador').textContent = usuarioLogado.user;
      document.getElementById('btn-menu-adm').style.display = isMasterAdmin ? 'inline-block' : 'none';
      
      const btnUsuarios = document.getElementById('btn-aba-usuarios');
      if (btnUsuarios) btnUsuarios.style.display = (usuarioLogado.user === 'au.costa') ? 'inline-block' : 'none';
      
      const btnDelivery = document.getElementById('btn-delivery-cart');
      if (btnDelivery) btnDelivery.style.display = (usuarioLogado.perfil === 'atendente_delivery' || isMasterAdmin) ? 'block' : 'none';
      
      irPara(telaSalva === 'entregador' ? 'venda' : telaSalva);
      if (telaSalva === 'adm') mudarAbaAdm(abaSalva);
    }
  } else {
    irPara('login');
  }
}

function irPara(nomeTela) {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.getElementById('tela-' + nomeTela).classList.add('ativa');
  localStorage.setItem('telaAtual', nomeTela);

  if (nomeTela === 'venda') {
    renderizarProdutos();
    renderizarCarrinho();
  }
  if (nomeTela === 'adm') {
    renderizarDashboard();
    renderizarListaEstoqueAdm();
    renderizarUsuariosAdm();
    atualizarCheckboxesPermissoes();
    document.getElementById('config-chave-pix').value = config.chavePix;
  }
  if (nomeTela === 'entregador') {
    renderizarTelaEntregador();
  }
}

function mudarAbaAdm(aba) {
  document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('ativa'));
  document.querySelectorAll('.aba-conteudo').forEach(c => c.classList.remove('ativa'));
  const btnClicado = document.querySelector(`.aba-btn[onclick*='${aba}']`);
  if (btnClicado) btnClicado.classList.add('ativa');
  document.getElementById('aba-' + aba).classList.add('ativa');
  localStorage.setItem('abaAtual', aba);
}

function abrirModal(id) { document.getElementById(id).classList.add('ativa'); }
function fecharModal(id) { document.getElementById(id).classList.remove('ativa'); }

// ==========================================
// CÂMERA QR CODE E LOGIN
// ==========================================
function abrirCameraLogin() {
  if (typeof Html5Qrcode === 'undefined') return alert('⚠️ Sem internet para carregar a Câmera.');
  abrirModal('modal-camera');
  leitorCameraQr = new Html5Qrcode('leitor-camera');
  leitorCameraQr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, (textoLido) => {
    fecharCameraQR(); processarLoginCachra(textoLido.trim());
  }, (err) => {}).catch(err => { alert('❌ Erro de Câmera: ' + err); fecharCameraQR(); });
}

function fecharCameraQR() {
  if (leitorCameraQr) leitorCameraQr.stop().then(() => { leitorCameraQr.clear(); }).catch(e => console.log(e));
  fecharModal('modal-camera');
}

function processarLoginCachra(qrText) {
  const usuario = usuarios.find(u => u.user === qrText);
  if (usuario) iniciarSessao(usuario); else alert('❌ Crachá não cadastrado.');
}

function fazerLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-senha').value.trim();
  const usuario = usuarios.find(u => u.user === user && u.senha === pass);
  if (usuario) iniciarSessao(usuario); else alert('❌ Dados incorretos!');
}

function iniciarSessao(usuario) {
  usuarioLogado = usuario;
  localStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
  document.getElementById('login-user').value = '';
  document.getElementById('login-senha').value = '';
  
  const isMasterAdmin = (usuario.user === 'au.costa' || usuario.perfil === 'admin' || usuario.isAdmin);
  
  if (usuario.perfil === 'entregador') {
    irPara('entregador');
  } else {
    document.getElementById('nome-operador').textContent = usuario.user;
    document.getElementById('btn-menu-adm').style.display = isMasterAdmin ? 'inline-block' : 'none';
    
    const btnUsuarios = document.getElementById('btn-aba-usuarios');
    if (btnUsuarios) btnUsuarios.style.display = (usuario.user === 'au.costa') ? 'inline-block' : 'none';
    
    const btnDelivery = document.getElementById('btn-delivery-cart');
    if (btnDelivery) btnDelivery.style.display = (usuario.perfil === 'atendente_delivery' || isMasterAdmin) ? 'block' : 'none';
    
    irPara('venda');
  }
}

function fazerLogout() {
  usuarioLogado = null;
  carrinho = [];
  localStorage.removeItem('usuarioLogado');
  localStorage.removeItem('carrinhoPendente');
  localStorage.removeItem('telaAtual');
  localStorage.removeItem('abaAtual');
  irPara('login');
}

// ==========================================
// TELA DO ENTREGADOR (PAGAMENTOS NA RUA)
// ==========================================
function mudarStatusEntregador() {
  const isLivre = document.getElementById('status-livre').checked;
  const idx = usuarios.findIndex(u => u.id === usuarioLogado.id);
  if (idx !== -1) {
    usuarios[idx].isLivre = isLivre;
    usuarioLogado.isLivre = isLivre;
    localStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
    salvarNoFirebaseSilencioso('usuarios', usuarios);
  }
}

function renderizarTelaEntregador() {
  if (!usuarioLogado || usuarioLogado.perfil !== 'entregador') return;
  document.getElementById('nome-entregador').textContent = usuarioLogado.user;
  document.getElementById('status-livre').checked = usuarioLogado.isLivre || false;

  const container = document.getElementById('lista-entregas-pendentes');
  container.innerHTML = '';

  const minhasEntregas = entregas.filter(e => e.idEntregador === usuarioLogado.id && e.status !== 'entregue');

  if (minhasEntregas.length === 0) {
    container.innerHTML = `<p style='text-align:center; color:#777; margin-top:20px;'>🎉 Nenhuma entrega pendente!</p>`;
    return;
  }

  minhasEntregas.forEach(e => {
    const urlMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.endereco)}`;
    
    let statusPag = '';
    let btnAcao = '';

    if (e.pagamento === 'pagar_entrega') {
      statusPag = `<span style='color:#e74c3c; font-weight:bold;'>⚠️ Cobrar R$ ${e.total.toFixed(2)} na Entrega</span>`;
      btnAcao = `<button class='btn-principal' style='margin-top:10px; background:#f39c12;' onclick='abrirCobrancaEntregador(${e.id})'>💰 Receber e Entregar</button>`;
    } else {
      statusPag = `<span style='color:#27ae60; font-weight:bold;'>✅ Já Pago no Caixa (${e.pagamento})</span>`;
      btnAcao = `<button class='btn-principal' style='margin-top:10px;' onclick='concluirEntregaJaPaga(${e.id})'>✅ Marcar como Entregue</button>`;
    }

    container.innerHTML += `
      <div class='user-card' style='margin-bottom:15px; border-top-color:#8e44ad;'>
        <div class='user-card-header'>
          <strong>Pedido #${e.id.toString().slice(-4)}</strong>
          <span style='color:#e74c3c; font-weight:bold;'>Pendente</span>
        </div>
        <p style='margin-bottom:5px; font-size:14px;'><strong>📍 Endereço:</strong> ${e.endereco}</p>
        <p style='margin-bottom:10px; font-size:14px;'>${statusPag}</p>
        <button class='btn-maps' onclick='window.open("${urlMaps}", "_blank")'>🗺️ Abrir no Google Maps</button>
        ${btnAcao}
      </div>
    `;
  });
}

function concluirEntregaJaPaga(id) {
  if (confirm('✅ Confirmar que o pedido foi entregue ao cliente?')) {
    const idx = entregas.findIndex(e => e.id === id);
    if (idx !== -1) {
      entregas[idx].status = 'entregue';
      entregas[idx].tempoEntrega = Date.now();
      salvarNoFirebaseSilencioso('entregas', entregas);
      alert('🎉 Entrega concluída com sucesso!');
    }
  }
}

function abrirCobrancaEntregador(id) {
  const e = entregas.find(x => x.id === id);
  if (!e) return;
  document.getElementById('entregador-id-entrega').value = e.id;
  document.getElementById('entregador-total-cobrar').textContent = e.total.toFixed(2);
  abrirModal('modal-entregador-pagamento');
}

function entregadorCobrar(forma) {
  const id = parseInt(document.getElementById('entregador-id-entrega').value);
  const e = entregas.find(x => x.id === id);
  if (!e) return;

  if (forma === 'Pix') {
    if (!config.chavePix) return alert('⚠️ A loja não configurou a Chave Pix.');
    fecharModal('modal-entregador-pagamento');
    modoPixAtual = 'entregador';
    idEntregaPix = id;
    
    document.getElementById('modal-pix-total').textContent = e.total.toFixed(2);
    const payload = gerarPayloadPix(config.chavePix, e.total, 'Loja PDV', 'Cidade');
    document.getElementById('pix-copia-cola').value = payload;
    const canvas = document.getElementById('canvas-qrcode');
    if (typeof QRious !== 'undefined') {
      new QRious({ element: canvas, value: payload, size: 220, level: 'M' });
    }
    abrirModal('modal-pix');
  } 
  else if (forma === 'Cartão') {
    if (confirm(`💳 Pagamento de R$ ${e.total.toFixed(2)} aprovado na maquininha?`)) {
      finalizarCobrancaEntregador(id, 'Cartão');
      fecharModal('modal-entregador-pagamento');
    }
  } 
  else if (forma === 'Dinheiro') {
    if (confirm(`💵 Confirma o recebimento de R$ ${e.total.toFixed(2)} em dinheiro?`)) {
      finalizarCobrancaEntregador(id, 'Dinheiro');
      fecharModal('modal-entregador-pagamento');
    }
  }
}

function finalizarCobrancaEntregador(id, forma) {
  const idx = entregas.findIndex(x => x.id === id);
  if (idx === -1) return;
  
  entregas[idx].status = 'entregue';
  entregas[idx].tempoEntrega = Date.now();
  entregas[idx].pagamentoFormaReal = forma;
  salvarNoFirebaseSilencioso('entregas', entregas);

  vendas.push({
    id: Date.now(),
    data: new Date().toLocaleString('pt-BR'),
    itens: [...entregas[idx].itens],
    total: entregas[idx].total,
    formaPagamento: forma,
    usuario: entregas[idx].atendente, 
    tipo: 'Delivery'
  });
  salvarNoFirebaseSilencioso('vendas', vendas);

  alert('🎉 Pagamento recebido e entrega concluída!');
  renderizarTelaEntregador();
}

function confirmarPixGlobal() {
  if (modoPixAtual === 'caixa') {
    confirmarVendaFeita('Pix');
  } else {
    finalizarCobrancaEntregador(idEntregaPix, 'Pix');
    fecharModal('modal-pix');
  }
}

// ==========================================
// CAIXA E CARRINHO (ESTOQUE REAL-TIME)
// ==========================================
function renderizarProdutos(lista) {
  const container = document.getElementById('lista-produtos');
  container.innerHTML = '';
  
  let produtosParaExibir = estoque;

  const isMasterAdmin = (usuarioLogado && (usuarioLogado.user === 'au.costa' || usuarioLogado.perfil === 'admin' || usuarioLogado.isAdmin));

  if (usuarioLogado && !isMasterAdmin && usuarioLogado.permissoes !== 'ALL') {
    produtosParaExibir = estoque.filter(p => usuarioLogado.permissoes.includes(p.id.toString()));
  }

  if (lista) produtosParaExibir = lista;

  produtosParaExibir.forEach(prod => {
    const card = document.createElement('div');
    card.className = 'produto-card ' + (prod.quantidade <= 0 ? 'esgotado' : '');
    
    const imgData = prod.imagem ? prod.imagem : 'data:image/svg+xml;utf8,<svg xmlns=`http://www.w3.org/2000/svg` viewBox=`0 0 100 100`><rect fill=`%23eee` width=`100` height=`100`/><text fill=`%23999` x=`50` y=`50` font-family=`sans-serif` font-size=`14` text-anchor=`middle` alignment-baseline=`middle`>Sem Foto</text></svg>'.replace(/`/g, "'");
    
    card.innerHTML = `
      <div class='prod-img-box'><img src='${imgData}' alt='Img'></div>
      <div class='prod-info'>
        <div class='prod-nome'>${prod.nome}</div>
        <div class='prod-preco'>R$ ${parseFloat(prod.preco).toFixed(2)}</div>
        <div class='prod-qtd'>Estoque: ${prod.quantidade}</div>
      </div>
    `;
    
    if (prod.quantidade > 0) card.onclick = () => adicionarAoCarrinho(prod.id);
    container.appendChild(card);
  });
}

function filtrarProdutos() {
  const termo = document.getElementById('busca').value.toLowerCase();
  let produtosDisponiveis = estoque;
  const isMasterAdmin = (usuarioLogado.user === 'au.costa' || usuarioLogado.perfil === 'admin' || usuarioLogado.isAdmin);
  
  if (!isMasterAdmin && usuarioLogado.permissoes !== 'ALL') {
    produtosDisponiveis = estoque.filter(p => usuarioLogado.permissoes.includes(p.id.toString()));
  }
  const filtrado = produtosDisponiveis.filter(p => p.nome.toLowerCase().includes(termo));
  renderizarProdutos(filtrado);
}

function adicionarAoCarrinho(idProd) {
  const produto = estoque.find(p => p.id === idProd);
  if (!produto || produto.quantidade <= 0) return;
  
  produto.quantidade--;
  salvarNoFirebaseSilencioso('estoque', estoque);

  const itemNoCarrinho = carrinho.find(i => i.id === idProd);
  if (itemNoCarrinho) itemNoCarrinho.quantidade++;
  else carrinho.push({ ...produto, quantidade: 1 });

  salvarCarrinhoPendente();
  renderizarCarrinho();
}

function removerDoCarrinho(idProd) {
  const idx = carrinho.findIndex(i => i.id === idProd);
  if (idx === -1) return;
  const produto = estoque.find(p => p.id === idProd);
  
  produto.quantidade += carrinho[idx].quantidade;
  salvarNoFirebaseSilencioso('estoque', estoque);
  
  carrinho.splice(idx, 1);
  salvarCarrinhoPendente();
  renderizarCarrinho();
}

function salvarCarrinhoPendente() {
  localStorage.setItem('carrinhoPendente', JSON.stringify(carrinho));
}

function renderizarCarrinho() {
  const container = document.getElementById('itens-carrinho');
  container.innerHTML = '';
  let total = 0;

  carrinho.forEach(item => {
    const subtotal = item.preco * item.quantidade;
    total += subtotal;
    container.innerHTML += `
      <div class='item-carrinho'>
        <div style='flex:1;'>
          <div style='font-weight:700; color:#2c3e50;'>${item.nome}</div>
          <div style='font-size:13px; color:#7f8c8d;'>${item.quantidade} × R$ ${parseFloat(item.preco).toFixed(2)} = R$ ${subtotal.toFixed(2)}</div>
        </div>
        <button style='color:#e74c3c; border:none; background:transparent; cursor:pointer; font-size:18px; padding:0 10px;' onclick='removerDoCarrinho(${item.id})'>✕</button>
      </div>
    `;
  });
  document.getElementById('valor-total').textContent = total.toFixed(2);
}

function limparCarrinho() {
  carrinho.forEach(item => {
    const produto = estoque.find(p => p.id === item.id);
    if (produto) produto.quantidade += item.quantidade;
  });
  carrinho = [];
  salvarNoFirebaseSilencioso('estoque', estoque);
  salvarCarrinhoPendente();
  renderizarCarrinho();
}

// ==========================================
// FLUXO ATENDENTE DELIVERY
// ==========================================
function abrirModalDelivery() {
  if (carrinho.length === 0) return alert('🛒 O Carrinho está vazio!');
  
  const select = document.getElementById('delivery-entregador');
  select.innerHTML = `<option value=''>-- Selecione um Entregador Livre --</option>`;
  
  const livres = usuarios.filter(u => u.perfil === 'entregador' && u.isLivre);
  livres.forEach(u => {
    select.innerHTML += `<option value='${u.id}'>🏍️ ${u.user}</option>`;
  });
  
  document.getElementById('delivery-endereco').value = '';
  document.getElementById('delivery-pagamento').value = 'pagar_entrega';
  abrirModal('modal-delivery');
}

function confirmarDelivery() {
  const endereco = document.getElementById('delivery-endereco').value.trim();
  const idEntregador = document.getElementById('delivery-entregador').value;
  const pagamento = document.getElementById('delivery-pagamento').value;

  if (!endereco || !idEntregador) return alert('❌ Preencha endereço e selecione o entregador.');

  const total = carrinho.reduce((s, i) => s + (i.preco * i.quantidade), 0);

  entregas.push({
    id: Date.now(),
    data: new Date().toLocaleString('pt-BR'),
    itens: [...carrinho],
    total: total,
    endereco: endereco,
    idEntregador: parseInt(idEntregador),
    atendente: usuarioLogado.user,
    status: 'pendente',
    pagamento: pagamento,
    tempoCriacao: Date.now(),
    tempoEntrega: null
  });
  salvarNoFirebaseSilencioso('entregas', entregas);

  if (pagamento !== 'pagar_entrega') {
    vendas.push({
      id: Date.now(),
      data: new Date().toLocaleString('pt-BR'),
      itens: [...carrinho],
      total: total,
      formaPagamento: pagamento,
      usuario: usuarioLogado.user,
      tipo: 'Delivery'
    });
    salvarNoFirebaseSilencioso('vendas', vendas);
  }

  fecharModal('modal-delivery');
  carrinho = [];
  salvarCarrinhoPendente();
  renderizarCarrinho();
  alert('🛵 Pedido enviado com sucesso para o Entregador!');
}

// ==========================================
// FLUXO DE PAGAMENTO FÍSICO
// ==========================================
function iniciarPagamento(forma) {
  if (carrinho.length === 0) return alert('🛒 O Carrinho está vazio!');
  
  modoPixAtual = 'caixa';
  formaPagamentoAtual = forma;
  valorTotalVendaAtual = carrinho.reduce((s, i) => s + (i.preco * i.quantidade), 0);

  if (forma === 'Dinheiro') {
    document.getElementById('modal-dinheiro-total').textContent = valorTotalVendaAtual.toFixed(2);
    document.getElementById('valor-recebido').value = '';
    document.getElementById('area-troco').style.display = 'none';
    document.getElementById('valor-troco').textContent = '0.00';
    abrirModal('modal-dinheiro');
  } 
  else if (forma === 'Pix') {
    if (!config.chavePix) return alert('⚠️ Chave Pix não configurada. Configure no Painel ADM.');
    gerarInterfacePix(valorTotalVendaAtual);
    abrirModal('modal-pix');
  } 
  else if (forma === 'Cartão') {
    processarCartao(valorTotalVendaAtual);
  }
}

function calcularTrocoDinamico() {
  const input = document.getElementById('valor-recebido').value;
  const recebido = parseFloat(input.replace(',', '.'));
  const areaTroco = document.getElementById('area-troco');
  const spanTroco = document.getElementById('valor-troco');

  if (isNaN(recebido) || recebido < valorTotalVendaAtual) {
    areaTroco.style.display = 'none';
    spanTroco.textContent = '0.00';
    return;
  }

  const troco = recebido - valorTotalVendaAtual;
  spanTroco.textContent = troco.toFixed(2);
  areaTroco.style.display = 'block';
}

function calcularTrocoEConfirmar() {
  const input = document.getElementById('valor-recebido').value;
  const recebido = parseFloat(input.replace(',', '.'));
  if (isNaN(recebido) || recebido < valorTotalVendaAtual) return alert('❌ Valor inserido inválido.');

  if (confirm('✅ Confirmar entrega do troco e finalizar?')) {
    fecharModal('modal-dinheiro');
    confirmarVendaFeita('Dinheiro');
  }
}

function gerarInterfacePix(valor) {
  document.getElementById('modal-pix-total').textContent = valor.toFixed(2);
  const payload = gerarPayloadPix(config.chavePix, valor, 'Loja PDV', 'Cidade');
  document.getElementById('pix-copia-cola').value = payload;
  
  const canvas = document.getElementById('canvas-qrcode');
  if (typeof QRious !== 'undefined') {
    new QRious({ element: canvas, value: payload, size: 220, level: 'M' });
  }
}

async function processarCartao(valorTotal) {
  const valorEmCentavos = Math.round(valorTotal * 100);
  try {
    const { AppLauncher } = Capacitor.Plugins;
    const urlApp = 'intent://payment#Intent;action=android.intent.action.VIEW;package=br.com.gertec.tef;S.valor=' + valorEmCentavos + ';S.tipoPagamento=DEBITO_CREDITO;end';
    
    const podeAbrir = await AppLauncher.canOpenUrl({ url: urlApp });
    if (podeAbrir.value) {
      await AppLauncher.openUrl({ url: urlApp });
      setTimeout(() => {
        if (confirm('✅ A Maquininha aprovou o pagamento?')) confirmarVendaFeita('Cartão');
      }, 3000);
    } else throw new Error('Sem app maquininha');
  } catch (e) {
    if (confirm(`💳 (Modo Manual) Pagamento de R$ ${valorTotal.toFixed(2)} aprovado na maquininha?`)) {
      confirmarVendaFeita('Cartão');
    }
  }
}

function confirmarVendaFeita(formaPagamento) {
  vendas.push({
    id: Date.now(),
    data: new Date().toLocaleString('pt-BR'),
    itens: [...carrinho],
    total: valorTotalVendaAtual,
    formaPagamento: formaPagamento,
    usuario: usuarioLogado.user
  });
  salvarNoFirebaseSilencioso('vendas', vendas);
  fecharModal('modal-pix');
  fecharModal('modal-dinheiro');
  carrinho = [];
  salvarCarrinhoPendente();
  renderizarProdutos();
  renderizarCarrinho();
  alert('🎉 Venda Finalizada com Sucesso!');
}

// ==========================================
// PAINEL ADM - DASHBOARDS INTELIGENTES BI (FILTROS)
// ==========================================

function aplicarFiltroPersonalizado() {
  const inicio = document.getElementById('filtro-data-inicio').value;
  const fim = document.getElementById('filtro-data-fim').value;
  
  if (!inicio && !fim) return alert('⚠️ Preencha a data de "De" ou "Até" para filtrar.');
  
  const objSelect = document.getElementById('filtro-periodo');
  if (objSelect) objSelect.value = 'personalizado';
  
  renderizarDashboard();
}

function limparFiltrosDash() {
  dashFiltroPagamento = null;
  dashFiltroUsuario = null;
  document.getElementById('btn-limpar-filtro').style.display = 'none';
  renderizarDashboard();
}

function filtrarDashPorPagamento(forma) {
  if (dashFiltroPagamento === forma) dashFiltroPagamento = null;
  else dashFiltroPagamento = forma;
  atualizarBotaoFiltro();
  renderizarDashboard();
}

function filtrarDashPorUsuario(usuario) {
  if (dashFiltroUsuario === usuario) dashFiltroUsuario = null;
  else dashFiltroUsuario = usuario;
  atualizarBotaoFiltro();
  renderizarDashboard();
}

function atualizarBotaoFiltro() {
  const btn = document.getElementById('btn-limpar-filtro');
  let textos = [];
  if (dashFiltroPagamento) textos.push(dashFiltroPagamento);
  if (dashFiltroUsuario) textos.push(dashFiltroUsuario);

  if (textos.length > 0) {
    btn.style.display = 'inline-block';
    btn.innerHTML = `❌ Limpar Filtro (${textos.join(' + ')})`;
  } else {
    btn.style.display = 'none';
  }
}

function renderizarDashboard() {
  const objSelect = document.getElementById('filtro-periodo');
  const periodo = objSelect ? objSelect.value : 'hoje';
  
  // Limpa os inputs se não for personalizado
  if (periodo !== 'personalizado') {
    const dtIni = document.getElementById('filtro-data-inicio');
    const dtFim = document.getElementById('filtro-data-fim');
    if(dtIni) dtIni.value = '';
    if(dtFim) dtFim.value = '';
  }

  const dataInicioStr = document.getElementById('filtro-data-inicio') ? document.getElementById('filtro-data-inicio').value : '';
  const dataFimStr = document.getElementById('filtro-data-fim') ? document.getElementById('filtro-data-fim').value : '';

  const parseDataBR = (str) => {
    const p = str.split('/');
    return parseInt(p[2] + p[1] + p[0]);
  };
  const parseDataInput = (str) => {
    const p = str.split('-');
    return parseInt(p[0] + p[1] + p[2]);
  };

  const hojeStr = new Date().toLocaleDateString('pt-BR');
  const mesStr = hojeStr.substring(3); 

  // 1º FILTRO GLOBAL (DATA)
  let vendasPorData = vendas.filter(v => {
    if (!v.data) return false;
    const dataVenda = v.data.split(' ')[0].replace(',', '');
    
    if (periodo === 'hoje') return dataVenda === hojeStr;
    if (periodo === 'mes') return dataVenda.endsWith(mesStr);
    if (periodo === 'personalizado') {
      const dataV = parseDataBR(dataVenda);
      const dataI = dataInicioStr ? parseDataInput(dataInicioStr) : 0;
      const dataF = dataFimStr ? parseDataInput(dataFimStr) : 99999999;
      return dataV >= dataI && dataV <= dataF;
    }
    return true; 
  });

  // Calculando Pagamentos (Filtra Data + Usuário)
  let basePagamentos = dashFiltroUsuario ? vendasPorData.filter(v => v.usuario === dashFiltroUsuario) : vendasPorData;
  let porPagamento = { 'Pix': 0, 'Cartão': 0, 'Dinheiro': 0, 'Delivery': 0 };
  basePagamentos.forEach(v => {
    let forma = v.formaPagamento || 'Outros';
    porPagamento[forma] = (porPagamento[forma] || 0) + v.total;
  });

  // Calculando Usuários (Filtra Data + Pagamento)
  let baseUsuarios = dashFiltroPagamento ? vendasPorData.filter(v => v.formaPagamento === dashFiltroPagamento) : vendasPorData;
  let porUsuario = {};
  baseUsuarios.forEach(v => {
    const user = v.usuario || 'Desconhecido';
    porUsuario[user] = (porUsuario[user] || 0) + v.total;
  });

  // Calculando Produtos & Totais (Filtra Data + Pagamento + Usuário)
  let baseGeral = vendasPorData;
  if (dashFiltroPagamento) baseGeral = baseGeral.filter(v => v.formaPagamento === dashFiltroPagamento);
  if (dashFiltroUsuario) baseGeral = baseGeral.filter(v => v.usuario === dashFiltroUsuario);

  let totalGeral = 0;
  let porProduto = {};

  baseGeral.forEach(v => {
    totalGeral += v.total;
    v.itens.forEach(item => {
      porProduto[item.nome] = (porProduto[item.nome] || 0) + item.quantidade;
    });
  });

  document.getElementById('dash-total-geral').textContent = 'R$ ' + totalGeral.toFixed(2);
  document.getElementById('dash-qtd-vendas').textContent = baseGeral.length;

  const renderGrafico = (divId, dataObj, color, prefix = '', suffix = '', filtroTipo = null) => {
    const div = document.getElementById(divId); 
    div.innerHTML = '';
    let maxV = Math.max(...Object.values(dataObj), 1);
    
    if (Object.keys(dataObj).length === 0) {
      div.innerHTML = `<p style='width:100%; text-align:center; padding-top:20px; color:#7f8c8d; font-size:14px;'>Sem dados no período.</p>`;
      return;
    }

    for (let k in dataObj) {
      let val = dataObj[k];
      let perc = (val / maxV) * 100;
      
      let isClickable = filtroTipo !== null;
      let cssClass = isClickable ? 'barra-container clickable' : 'barra-container';
      
      let clickAction = '';
      let opacity = '1';

      if (filtroTipo === 'pagamento') {
        clickAction = `onclick="filtrarDashPorPagamento('${k}')"`;
        if (dashFiltroPagamento && dashFiltroPagamento !== k) opacity = '0.4';
      } else if (filtroTipo === 'usuario') {
        clickAction = `onclick="filtrarDashPorUsuario('${k}')"`;
        if (dashFiltroUsuario && dashFiltroUsuario !== k) opacity = '0.4';
      }

      div.innerHTML += `
        <div class='${cssClass}' ${clickAction} style='opacity:${opacity}'>
          <div class='barra' style='height:${perc}%; background:${color};'>${prefix}${Math.round(val)}${suffix}</div>
          <span title='${k}'>${k}</span>
        </div>`;
    }
  };
  
  renderGrafico('grafico-pagamentos', porPagamento, '#f39c12', 'R$', '', 'pagamento');
  renderGrafico('grafico-usuarios', porUsuario, '#3498db', 'R$', '', 'usuario');
  renderGrafico('grafico-produtos', porProduto, '#2ecc71', '', ' un');

  // Relatório de Delivery Específico
  let entregasFiltradas = entregas.filter(e => {
    if (!e.data) return false;
    const dataE = e.data.split(' ')[0].replace(',', '');
    
    if (periodo === 'hoje') return dataE === hojeStr;
    if (periodo === 'mes') return dataE.endsWith(mesStr);
    if (periodo === 'personalizado') {
      const dataV = parseDataBR(dataE);
      const dataI = dataInicioStr ? parseDataInput(dataInicioStr) : 0;
      const dataF = dataFimStr ? parseDataInput(dataFimStr) : 99999999;
      return dataV >= dataI && dataV <= dataF;
    }
    return true;
  });

  if (dashFiltroPagamento) entregasFiltradas = entregasFiltradas.filter(e => e.pagamento === dashFiltroPagamento || e.pagamentoFormaReal === dashFiltroPagamento);
  if (dashFiltroUsuario) entregasFiltradas = entregasFiltradas.filter(e => e.atendente === dashFiltroUsuario);

  let entregasPorPessoa = {};
  let tempoMedioEntregador = {};
  let somaTempo = {};
  
  entregasFiltradas.forEach(e => {
    if (e.status === 'entregue') {
      const nomeEnt = usuarios.find(u => u.id === e.idEntregador)?.user || 'Desconhecido';
      entregasPorPessoa[nomeEnt] = (entregasPorPessoa[nomeEnt] || 0) + 1;
      
      const minGastos = (e.tempoEntrega - e.tempoCriacao) / 60000;
      somaTempo[nomeEnt] = (somaTempo[nomeEnt] || 0) + minGastos;
    }
  });

  for (let nome in entregasPorPessoa) {
    tempoMedioEntregador[nome] = somaTempo[nome] / entregasPorPessoa[nome];
  }

  renderGrafico('grafico-entregadores', entregasPorPessoa, '#8e44ad', '', ' ent');
  renderGrafico('grafico-tempo-entrega', tempoMedioEntregador, '#e67e22', '', ' min');
}

// ==========================================
// ESTOQUE CRUD
// ==========================================
function converterImagemBase64(event, imgPreviewId) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    imgBase64Temp = e.target.result;
    document.getElementById(imgPreviewId).src = imgBase64Temp;
    const idInputUrl = imgPreviewId === 'preview-img-cadastro' ? 'prod-imagem-url' : 'edit-prod-url';
    document.getElementById(idInputUrl).value = '';
  };
  reader.readAsDataURL(file);
}

function carregarImagemUrl(url, imgPreviewId) {
  if (!url) {
    imgBase64Temp = '';
    document.getElementById(imgPreviewId).src = '';
    return;
  }
  imgBase64Temp = url;
  document.getElementById(imgPreviewId).src = url;
  const idInputFile = imgPreviewId === 'preview-img-cadastro' ? 'prod-imagem-file' : 'edit-prod-file';
  document.getElementById(idInputFile).value = '';
}

function cadastrarProduto() {
  const nome = document.getElementById('prod-nome').value.trim();
  const preco = parseFloat(document.getElementById('prod-preco').value.replace(',', '.'));
  const qtd = parseInt(document.getElementById('prod-qtd').value);

  if (!nome || isNaN(preco) || isNaN(qtd)) return alert('❌ Preencha Nome, Preço e Quantidade corretamente.');

  estoque.push({ id: Date.now(), nome, preco, quantidade: qtd, imagem: imgBase64Temp });
  salvarNoFirebaseSilencioso('estoque', estoque);
  
  document.getElementById('prod-nome').value = '';
  document.getElementById('prod-preco').value = '';
  document.getElementById('prod-qtd').value = '';
  document.getElementById('prod-imagem-file').value = '';
  document.getElementById('prod-imagem-url').value = '';
  document.getElementById('preview-img-cadastro').src = '';
  imgBase64Temp = '';
  
  renderizarListaEstoqueAdm();
  alert('✅ Produto cadastrado!');
}

function renderizarListaEstoqueAdm() {
  const painel = document.getElementById('tabela-estoque-adm');
  painel.innerHTML = '';
  
  estoque.forEach(prod => {
    painel.innerHTML += `
      <div class='linha-lista'>
        <div>
          <strong style='font-size:15px; color:#2c3e50;'>${prod.nome}</strong> 
          <span style='color:#27ae60; font-weight:bold; margin-left:10px;'>R$ ${parseFloat(prod.preco).toFixed(2)}</span>
        </div>
        <div class='acoes-lista'>
          <span style='color:#7f8c8d; font-size:13px; margin-right:15px;'>Estoque: <strong>${prod.quantidade}</strong></span>
          <button class='btn-acao btn-edit' onclick='abrirEdicaoProduto(${prod.id})'>✏️ Editar</button>
          <button class='btn-acao btn-del' onclick='excluirProduto(${prod.id})'>🗑️ Excluir</button>
        </div>
      </div>
    `;
  });
  atualizarCheckboxesPermissoes();
}

function abrirEdicaoProduto(id) {
  const p = estoque.find(e => e.id === id);
  if (!p) return;
  document.getElementById('edit-prod-id').value = p.id;
  document.getElementById('edit-prod-nome').value = p.nome;
  document.getElementById('edit-prod-preco').value = p.preco;
  document.getElementById('edit-prod-qtd').value = p.quantidade;
  document.getElementById('edit-prod-file').value = '';
  document.getElementById('edit-prod-url').value = p.imagem && p.imagem.startsWith('http') ? p.imagem : '';
  document.getElementById('preview-img-edit').src = p.imagem || '';
  imgBase64Temp = p.imagem || '';
  abrirModal('modal-editar-produto');
}

function salvarEdicaoProduto() {
  const id = parseInt(document.getElementById('edit-prod-id').value);
  const p = estoque.find(e => e.id === id);
  if (!p) return;
  p.nome = document.getElementById('edit-prod-nome').value;
  p.preco = parseFloat(document.getElementById('edit-prod-preco').value);
  p.quantidade = parseInt(document.getElementById('edit-prod-qtd').value);
  p.imagem = imgBase64Temp;

  salvarNoFirebaseSilencioso('estoque', estoque);
  fecharModal('modal-editar-produto');
  renderizarListaEstoqueAdm();
  carrinho = [];
  salvarCarrinhoPendente();
}

function excluirProduto(id) {
  if (confirm('⚠️ Tem certeza que deseja EXCLUIR este produto?')) {
    estoque = estoque.filter(e => e.id !== id);
    salvarNoFirebaseSilencioso('estoque', estoque);
    renderizarListaEstoqueAdm();
    carrinho = []; 
    salvarCarrinhoPendente();
  }
}

function importarExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet);

      let importados = 0;
      let baseId = Date.now();

      json.forEach((row, index) => {
        const nome = row['Nome do Produto'] || row['Nome'] || row['nome'];
        const precoStr = row['Preço (R$)'] || row['Preço'] || row['Preco'] || row['preco'];
        const qtdStr = row['Qtd Inicial'] || row['Quantidade'] || row['Qtd'] || row['quantidade'];

        if (nome && precoStr !== undefined && qtdStr !== undefined) {
          const preco = parseFloat(precoStr.toString().replace(',', '.'));
          const qtd = parseInt(qtdStr);
          if (!isNaN(preco) && !isNaN(qtd)) {
            estoque.push({ id: baseId + index, nome: nome.toString().trim(), preco: preco, quantidade: qtd, imagem: '' });
            importados++;
          }
        }
      });
      if (importados > 0) {
        salvarNoFirebaseSilencioso('estoque', estoque);
        renderizarListaEstoqueAdm();
        alert(`✅ ${importados} produtos importados!`);
      } else {
        alert('⚠️ Nenhum produto encontrado. Formato incorreto.');
      }
    } catch (error) { alert('❌ Erro ao ler Excel.'); }
    event.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

// ==========================================
// USUÁRIOS E CONFIGURAÇÕES CRUD
// ==========================================
function atualizarCheckboxesPermissoes() {
  const renderCheckboxes = (containerId, cssClass) => {
    const div = document.getElementById(containerId);
    if(!div) return;
    div.innerHTML = '';
    estoque.forEach(p => {
      div.innerHTML += `
        <label class='perm-item'>
          <input type='checkbox' class='${cssClass}' value='${p.id}'> ${p.nome}
        </label>
      `;
    });
  };
  renderCheckboxes('permissoes-produtos', 'chk-perm-cad');
  renderCheckboxes('bloco-permissoes-edit', 'chk-perm-edit');
}

function marcarPermissoes(marcarTudo) { document.querySelectorAll('.chk-perm-cad').forEach(chk => chk.checked = marcarTudo); }

function togglePermissoesUI() {
  const perfil = document.getElementById('novo-perfil').value;
  const bloco = document.getElementById('bloco-permissoes-container');
  bloco.style.opacity = (perfil === 'admin' || perfil === 'entregador') ? '0.4' : '1';
  bloco.style.pointerEvents = (perfil === 'admin' || perfil === 'entregador') ? 'none' : 'auto';
}

function togglePermissoesUIEdit() {
  const perfil = document.getElementById('edit-user-perfil').value;
  const bloco = document.getElementById('bloco-permissoes-edit');
  bloco.style.opacity = (perfil === 'admin' || perfil === 'entregador') ? '0.4' : '1';
  bloco.style.pointerEvents = (perfil === 'admin' || perfil === 'entregador') ? 'none' : 'auto';
}

function cadastrarUsuario() {
  const user = document.getElementById('novo-user').value.trim();
  const senha = document.getElementById('novo-senha').value.trim();
  const perfil = document.getElementById('novo-perfil').value;
  const isAdm = (perfil === 'admin');
  
  if (!user || !senha) return alert('❌ Preencha usuário e senha!');
  if (usuarios.find(u => u.user === user)) return alert('❌ Esse usuário já existe!');

  let permissoes = 'ALL';
  if (perfil === 'caixa' || perfil === 'atendente_delivery') {
    const marcados = Array.from(document.querySelectorAll('.chk-perm-cad:checked')).map(chk => chk.value);
    if (marcados.length === 0) return alert('❌ Escolha produtos permitidos para este funcionário!');
    permissoes = marcados;
  }

  usuarios.push({ id: Date.now(), user, senha, isAdmin: isAdm, perfil: perfil, permissoes: permissoes, isLivre: false });
  salvarNoFirebaseSilencioso('usuarios', usuarios);
  
  document.getElementById('novo-user').value = '';
  document.getElementById('novo-senha').value = '';
  marcarPermissoes(false);
  togglePermissoesUI();
  
  renderizarUsuariosAdm();
  alert('✅ Funcionário cadastrado!');
}

function renderizarUsuariosAdm() {
  const termo = document.getElementById('busca-usuario').value.toLowerCase();
  const painel = document.getElementById('lista-usuarios-adm');
  painel.innerHTML = '';
  const filtrados = usuarios.filter(u => u.user.toLowerCase().includes(termo));

  filtrados.forEach(u => {
    let lblPerfil = '👤 Caixa';
    let corTipo = '#3498db';
    
    if (u.user === 'au.costa' || u.perfil === 'admin' || u.isAdmin) { lblPerfil = '🛡️ Admin'; corTipo = '#e74c3c'; }
    else if (u.perfil === 'entregador') { lblPerfil = '🏍️ Entregador'; corTipo = '#8e44ad'; }
    else if (u.perfil === 'atendente_delivery') { lblPerfil = '🎧 Atend. Delivery'; corTipo = '#2ecc71'; }
    
    const qtR = u.permissoes === 'ALL' ? 'Todos' : (u.permissoes ? u.permissoes.length : 0);
    
    let imgQrUrl = '';
    if (typeof QRious !== 'undefined') {
      const qrGen = new QRious({ value: u.user, size: 100 });
      imgQrUrl = qrGen.toDataURL();
    }
    
    let acoesHtml = '';
    if (u.user !== 'au.costa') {
      acoesHtml = `
        <div class='acoes-card-user'>
          <button class='btn-acao btn-edit' style='flex:1;' onclick='abrirEdicaoUsuario(${u.id})'>✏️ Editar</button>
          <button class='btn-acao btn-del' style='flex:1;' onclick='excluirUsuario(${u.id})'>🗑️ Excluir</button>
        </div>
      `;
    }

    painel.innerHTML += `
      <div class='user-card'>
        <div class='user-card-header'>
          <strong style='font-size:16px; color:#2c3e50;'>${u.user}</strong>
          <span style='font-size:12px; font-weight:bold; color:${corTipo};'>${lblPerfil}</span>
        </div>
        <div class='user-info'>
          <p>🔑 Senha: <strong>${u.senha}</strong></p>
          <p>📦 Permissões: <strong>${qtR}</strong></p>
        </div>
        <div class='qr-container'>
          <p style='font-size:11px; margin-bottom:5px; font-weight:bold; color:#777;'>Crachá QR Code</p>
          <img src='${imgQrUrl}' alt='QR Offline'>
        </div>
        ${acoesHtml}
      </div>
    `;
  });
}

function abrirEdicaoUsuario(id) {
  const u = usuarios.find(x => x.id === id);
  if (!u || u.user === 'au.costa') return;
  document.getElementById('edit-user-id').value = u.id;
  document.getElementById('edit-user-nome').value = u.user;
  document.getElementById('edit-user-senha').value = u.senha;
  
  let p = u.perfil || 'caixa';
  if (u.isAdmin && !u.perfil) p = 'admin';
  document.getElementById('edit-user-perfil').value = p;
  
  togglePermissoesUIEdit();
  document.querySelectorAll('.chk-perm-edit').forEach(chk => {
    chk.checked = u.permissoes === 'ALL' ? false : (u.permissoes ? u.permissoes.includes(chk.value) : false);
  });
  abrirModal('modal-editar-usuario');
}

function salvarEdicaoUsuario() {
  const id = parseInt(document.getElementById('edit-user-id').value);
  const u = usuarios.find(x => x.id === id);
  if (!u) return;
  u.user = document.getElementById('edit-user-nome').value;
  u.senha = document.getElementById('edit-user-senha').value;
  u.perfil = document.getElementById('edit-user-perfil').value;
  u.isAdmin = (u.perfil === 'admin');

  if (u.perfil === 'admin' || u.perfil === 'entregador') {
    u.permissoes = 'ALL';
  } else {
    const marcados = Array.from(document.querySelectorAll('.chk-perm-edit:checked')).map(c => c.value);
    if (marcados.length === 0) return alert('❌ Escolha pelo menos 1 produto!');
    u.permissoes = marcados;
  }

  salvarNoFirebaseSilencioso('usuarios', usuarios);
  fecharModal('modal-editar-usuario');
  renderizarUsuariosAdm();
}

function excluirUsuario(id) {
  if (confirm('⚠️ Excluir este funcionário do sistema?')) {
    usuarios = usuarios.filter(u => u.id !== id);
    salvarNoFirebaseSilencioso('usuarios', usuarios);
    renderizarUsuariosAdm();
  }
}

function salvarConfig() {
  config.chavePix = document.getElementById('config-chave-pix').value.trim();
  salvarNoFirebaseSilencioso('config', config);
  alert('✅ Configurações PIX salvas!');
}

function gerarPayloadPix(chave, valor, nome, cidade) {
  let valStr = valor.toFixed(2);
  let payload = '000201' +
    '26' + (22 + chave.length) + '0014br.gov.bcb.pix01' + (chave.length < 10 ? '0' : '') + chave.length + chave +
    '52040000' +
    '5303986' +
    (valor > 0 ? '54' + (valStr.length < 10 ? '0' : '') + valStr.length + valStr : '') +
    '5802BR' +
    '59' + (nome.length < 10 ? '0' : '') + nome.length + nome +
    '60' + (cidade.length < 10 ? '0' : '') + cidade.length + cidade +
    '62070503***' +
    '6304';
  return payload + calculaCRC16(payload);
}

function calculaCRC16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) > 0) crc = (crc << 1) ^ 0x1021;
      else crc = crc << 1;
    }
  }
  let hex = (crc & 0xFFFF).toString(16).toUpperCase();
  while (hex.length < 4) hex = '0' + hex;
  return hex;
}