// ==========================================
// SISTEMA PDV — FIREBASE + PWA + DASHBOARD BI + ESTORNO/TROCA INTELIGENTE
// ==========================================

let estoque = JSON.parse(localStorage.getItem('estoque')) || [];
let vendas = JSON.parse(localStorage.getItem('vendas')) || [];
let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
let entregas = JSON.parse(localStorage.getItem('entregas')) || [];
let config = JSON.parse(localStorage.getItem('config')) || { chavePix: '', contadorNF: 0 };
let carrinho = JSON.parse(localStorage.getItem('carrinhoPendente')) || [];

let appInicializado = false;
let usuarioLogado = null;
let imgBase64Temp = ''; 
let leitorCameraQr = null; 

let dashFiltroPagamento = null;
let dashFiltroUsuario = null;

let creditoTroca = parseFloat(localStorage.getItem('creditoTroca')) || 0;

let firebaseDatabase = null;
let fbRef = null;
let fbSet = null;
let fbOnValue = null;
let fbChild = null;

let modoPixAtual = 'caixa';
let idEntregaPix = null;
let valorTotalVendaAtual = 0;

// FORMATADOR DE MOEDA OFICIAL PARA CONTABILIDADE (Ex: 13.910,00)
function formatarMoeda(valor) {
  return parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('Erro no SW:', err));
  });
}

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
    if (!appInicializado) {
      carregarDadosLocais();
      inicializarAdminPadrao();
      appInicializado = true;
      restaurarEstadoDoNavegador();
    }
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
      const formatarArray = (obj) => obj ? (Array.isArray(obj) ? obj : Object.values(obj)) : [];

      estoque = formatarArray(data.estoque);
      vendas = formatarArray(data.vendas);
      usuarios = formatarArray(data.usuarios);
      entregas = formatarArray(data.entregas);
      config = data.config || { chavePix: '', contadorNF: 0 };
      
      salvarDadosLocaisSilencioso();
      
      if (!appInicializado) {
        appInicializado = true;
        restaurarEstadoDoNavegador();
      } else {
        atualizarTelasEmTempoReal();
      }
    } else {
      inicializarAdminPadrao();
      salvarNoFirebaseSilencioso('estoque', estoque);
      salvarNoFirebaseSilencioso('vendas', vendas);
      salvarNoFirebaseSilencioso('usuarios', usuarios);
      salvarNoFirebaseSilencioso('entregas', entregas);
      salvarNoFirebaseSilencioso('config', config);
      
      if (!appInicializado) {
        appInicializado = true;
        restaurarEstadoDoNavegador();
      } else {
        atualizarTelasEmTempoReal();
      }
    }
  });

  setTimeout(() => {
    if (!appInicializado) {
      carregarDadosLocais();
      inicializarAdminPadrao();
      appInicializado = true;
      restaurarEstadoDoNavegador();
    }
  }, 2000);
}

function atualizarTelasEmTempoReal() {
  const telaAtual = localStorage.getItem('telaAtual');
  if (telaAtual === 'venda') { renderizarProdutos(); renderizarCarrinho(); }
  if (telaAtual === 'entregador') renderizarTelaEntregador();
  if (telaAtual === 'adm') {
    renderizarDashboard();
    renderizarListaEstoqueAdm();
    renderizarUsuariosAdm();
  }
  
  if (document.getElementById('modal-gestao-entregas').classList.contains('ativa')) renderizarGestaoEntregas();
  if (document.getElementById('modal-historico-vendas').classList.contains('ativa')) renderizarHistoricoVendas();
}

function carregarDadosLocais() {
  estoque = JSON.parse(localStorage.getItem('estoque')) || [];
  vendas = JSON.parse(localStorage.getItem('vendas')) || [];
  usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
  entregas = JSON.parse(localStorage.getItem('entregas')) || [];
  config = JSON.parse(localStorage.getItem('config')) || { chavePix: '', contadorNF: 0 };
}

function salvarDadosLocaisSilencioso() {
  localStorage.setItem('estoque', JSON.stringify(estoque));
  localStorage.setItem('vendas', JSON.stringify(vendas));
  localStorage.setItem('usuarios', JSON.stringify(usuarios));
  localStorage.setItem('entregas', JSON.stringify(entregas));
  localStorage.setItem('config', JSON.stringify(config));
}

function salvarNoFirebaseSilencioso(chave, dados) {
  if (firebaseDatabase) fbSet(fbRef(firebaseDatabase, 'PDV/' + chave), dados).catch(err => {});
  salvarDadosLocaisSilencioso();
}

function inicializarAdminPadrao() {
  const adminMaster = usuarios.find(u => u.user === 'au.costa');
  if (!adminMaster) {
    usuarios.push({ id: Date.now(), user: 'au.costa', senha: '80605276', perfil: 'admin', permissoes: 'ALL' });
    salvarNoFirebaseSilencioso('usuarios', usuarios);
  }
}

function gerarProximaNF() {
  let next = parseInt(config.contadorNF || 0) + 1;
  config.contadorNF = next;
  salvarNoFirebaseSilencioso('config', config);
  return String(next).padStart(4, '0');
}

// ==========================================
// RESTAURAÇÃO DE TELA E NAVEGAÇÃO
// ==========================================
function restaurarEstadoDoNavegador() {
  const salvoUser = localStorage.getItem('usuarioLogado');
  if (salvoUser) {
    const userLocal = JSON.parse(salvoUser);
    usuarioLogado = usuarios.find(u => u.id === userLocal.id) || userLocal;
    carrinho = JSON.parse(localStorage.getItem('carrinhoPendente')) || [];
    
    let telaSalva = localStorage.getItem('telaAtual') || 'venda';
    if (telaSalva === 'login') telaSalva = 'venda'; // Correção vital para não prender no ecrã de login
    
    const abaSalva = localStorage.getItem('abaAtual') || 'dashboard';
    const isMasterAdmin = (usuarioLogado.user === 'au.costa' || usuarioLogado.perfil === 'admin' || usuarioLogado.isAdmin);
    
    if (usuarioLogado.perfil === 'entregador') {
      irPara('entregador');
    } else {
      document.getElementById('nome-operador').textContent = usuarioLogado.user;
      document.getElementById('btn-menu-adm').style.display = isMasterAdmin ? 'inline-block' : 'none';
      const btnUsuarios = document.getElementById('btn-aba-usuarios');
      if (btnUsuarios) btnUsuarios.style.display = (usuarioLogado.user === 'au.costa') ? 'inline-block' : 'none';
      
      const btnGestao = document.getElementById('btn-gestao-delivery');
      if (btnGestao) btnGestao.style.display = (usuarioLogado.perfil === 'atendente_delivery' || isMasterAdmin) ? 'inline-block' : 'none';
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

  if (nomeTela === 'venda') { renderizarProdutos(); renderizarCarrinho(); }
  if (nomeTela === 'adm') { renderizarDashboard(); renderizarListaEstoqueAdm(); renderizarUsuariosAdm(); atualizarCheckboxesPermissoes(); document.getElementById('config-chave-pix').value = config.chavePix || ''; }
  if (nomeTela === 'entregador') { renderizarTelaEntregador(); }
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
  const user = document.getElementById('login-user').value.trim().toLowerCase();
  const pass = document.getElementById('login-senha').value.trim();
  const usuario = usuarios.find(u => u.user.toLowerCase() === user && u.senha === pass);
  if (usuario) iniciarSessao(usuario); else alert('❌ Dados incorretos!');
}

function iniciarSessao(usuario) {
  usuarioLogado = usuario;
  localStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
  document.getElementById('login-user').value = '';
  document.getElementById('login-senha').value = '';
  
  localStorage.setItem('telaAtual', usuario.perfil === 'entregador' ? 'entregador' : 'venda');
  restaurarEstadoDoNavegador();
}

function fazerLogout() {
  usuarioLogado = null; carrinho = []; creditoTroca = 0;
  localStorage.removeItem('usuarioLogado'); localStorage.removeItem('carrinhoPendente'); localStorage.removeItem('creditoTroca');
  localStorage.removeItem('telaAtual'); localStorage.removeItem('abaAtual');
  irPara('login');
}

// ==========================================
// FUNDO DE CAIXA E HISTÓRICO (TROCA/ESTORNO)
// ==========================================
function abrirModalAberturaCaixa() {
  document.getElementById('valor-fundo-caixa').value = '';
  abrirModal('modal-abertura-caixa');
}

function confirmarAberturaCaixa() {
  const valorStr = document.getElementById('valor-fundo-caixa').value.replace(',', '.');
  const valor = parseFloat(valorStr);
  if (isNaN(valor) || valor <= 0) return alert('❌ Insira um valor válido.');

  const numNF = gerarProximaNF();

  vendas.push({
    id: Date.now(),
    nf: numNF,
    data: new Date().toLocaleString('pt-BR'),
    itens: [],
    total: valor,
    formaPagamento: 'Dinheiro',
    usuario: usuarioLogado.user,
    tipo: 'Abertura de Caixa'
  });
  
  salvarNoFirebaseSilencioso('vendas', vendas);
  fecharModal('modal-abertura-caixa');
  
  document.getElementById('titulo-nf-sucesso').textContent = 'Número do Recibo';
  document.getElementById('numero-nf-gerado').textContent = numNF;
  document.getElementById('mensagem-sucesso-universal').textContent = 'Fundo de caixa registrado!';
  abrirModal('modal-sucesso-universal');
}

function abrirModalHistorico() {
  document.getElementById('busca-historico').value = '';
  renderizarHistoricoVendas();
  abrirModal('modal-historico-vendas');
}

function renderizarHistoricoVendas() {
  const termo = document.getElementById('busca-historico').value.toLowerCase();
  const container = document.getElementById('lista-historico-vendas');
  container.innerHTML = '';
  
  const lista = [...vendas].reverse().filter(v => {
    return (v.nf && v.nf.includes(termo)) || (v.total && v.total.toString().includes(termo));
  });

  if (lista.length === 0) {
    container.innerHTML = `<p style='text-align:center; color:#777; padding:20px;'>Nenhuma movimentação encontrada.</p>`;
    return;
  }

  lista.forEach(v => {
    let lblTipo = v.tipo === 'Abertura de Caixa' ? '💵 Fundo de Caixa' : (v.tipo === 'Delivery' ? '🛵 Delivery' : '🛒 Venda Balcão');
    
    container.innerHTML += `
      <div class='linha-lista' style='margin-bottom: 8px;'>
        <div>
          <strong style='font-size:14px; color:#2c3e50;'>NF: #${v.nf}</strong>
          <span style='font-size:12px; color:#7f8c8d; margin-left:10px;'>${v.data}</span>
          <br>
          <span style='font-size:13px; font-weight:bold; color:#27ae60;'>R$ ${formatarMoeda(v.total)}</span>
          <span style='font-size:11px; color:#555; margin-left:10px;'>${lblTipo} (${v.formaPagamento})</span>
        </div>
        <button class='btn-acao btn-del' style='padding: 8px 12px;' onclick='abrirOpcoesEstorno(${v.id})'>🔄 Estornar/Troca</button>
      </div>
    `;
  });
}

function abrirOpcoesEstorno(idVenda) {
  document.getElementById('id-venda-estorno').value = idVenda;
  abrirModal('modal-acao-estorno');
}

function executarEstorno(acao) {
  const idVenda = parseInt(document.getElementById('id-venda-estorno').value);
  const idx = vendas.findIndex(v => v.id === idVenda);
  if (idx === -1) return;
  const venda = vendas[idx];

  if (venda.itens && venda.itens.length > 0) {
    venda.itens.forEach(item => {
      const prod = estoque.find(p => p.id === item.id);
      if (prod) prod.quantidade += parseInt(item.quantidade, 10);
    });
    salvarNoFirebaseSilencioso('estoque', estoque);
  }

  if (venda.tipo === 'Delivery') {
    entregas = entregas.filter(e => e.id !== venda.id);
    salvarNoFirebaseSilencioso('entregas', entregas);
  }

  vendas.splice(idx, 1);
  salvarNoFirebaseSilencioso('vendas', vendas);

  fecharModal('modal-acao-estorno');

  if (acao === 'troca') {
    carrinho = JSON.parse(JSON.stringify(venda.itens || [])); 
    creditoTroca = parseFloat(venda.total);
    localStorage.setItem('creditoTroca', creditoTroca);
    salvarCarrinhoPendente();
    fecharModal('modal-historico-vendas');
    irPara('venda');
    alert('✅ Itens devolvidos para o Caixa. Altere o pedido e finalize para cobrar apenas a diferença.');
  } else {
    renderizarHistoricoVendas();
    alert('✅ Movimentação Cancelada com Sucesso!');
  }
}

// ==========================================
// GESTÃO DE ENTREGAS (ATENDENTE)
// ==========================================
function abrirModalGestaoEntregas() {
  renderizarGestaoEntregas();
  abrirModal('modal-gestao-entregas');
}

function renderizarGestaoEntregas() {
  const container = document.getElementById('lista-gestao-entregas');
  container.innerHTML = '';
  
  const pendentes = entregas.filter(e => e.status !== 'entregue').reverse();

  if (pendentes.length === 0) {
    container.innerHTML = `<p style='text-align:center; color:#777; padding:20px;'>Nenhum pedido na rua!</p>`;
    return;
  }

  const selectEntregadores = usuarios.filter(u => u.perfil === 'entregador').map(u => `<option value='${u.id}'>🏍️ ${u.user}</option>`).join('');

  pendentes.forEach(e => {
    container.innerHTML += `
      <div class='linha-lista' style='flex-direction:column; align-items:flex-start; margin-bottom:10px; border-left-color:#8e44ad;'>
        <div style='width:100%; display:flex; justify-content:space-between; margin-bottom:5px;'>
          <strong>NF/Pedido: #${e.nf || e.id.toString().slice(-4)}</strong>
          <span style='color:#e74c3c; font-weight:bold;'>R$ ${formatarMoeda(e.total)}</span>
        </div>
        <p style='font-size:13px; margin-bottom:8px;'><strong>Endereço:</strong> ${e.endereco}</p>
        
        <div style='display:flex; gap:8px; width:100%; flex-wrap: wrap;'>
          <select id='troca-entregador-${e.id}' class='select-custom' style='flex:1; margin:0; padding:6px; min-width: 150px;'>             <option value='${e.idEntregador}' selected>Atual: ${usuarios.find(u=>u.id === e.idEntregador)?.user}</option>${selectEntregadores}
          </select>
          <button class='btn-principal' style='width:auto; padding:6px 12px; font-size:12px;' onclick='salvarTrocaEntregador(${e.id})'>💾 Trocar</button>
          <button class='btn-perigo' style='width:auto; padding:6px 12px; font-size:12px;' onclick='cancelarEntregaPendente(${e.id})'>🗑️ Cancelar Pedido</button>
        </div>
      </div>
    `;
  });
}

function salvarTrocaEntregador(idEntrega) {
  const novoId = document.getElementById(`troca-entregador-${idEntrega}`).value;
  const e = entregas.find(x => x.id === idEntrega);
  if(e) {
    e.idEntregador = parseInt(novoId);
    salvarNoFirebaseSilencioso('entregas', entregas);
    alert('✅ Entregador alterado!');
    renderizarGestaoEntregas();
  }
}

function cancelarEntregaPendente(idEntrega) {
  if (!confirm('⚠️ Tem certeza que deseja cancelar este pedido? O estoque será devolvido.')) return;
  
  const idxE = entregas.findIndex(x => x.id === idEntrega);
  if (idxE !== -1) {
    entregas[idxE].itens.forEach(item => {
      const prod = estoque.find(p => p.id === item.id);
      if (prod) prod.quantidade += parseInt(item.quantidade, 10);
    });
    salvarNoFirebaseSilencioso('estoque', estoque);
    
    entregas.splice(idxE, 1);
    salvarNoFirebaseSilencioso('entregas', entregas);
    
    const idxV = vendas.findIndex(v => v.id === idEntrega);
    if (idxV !== -1) {
      vendas.splice(idxV, 1);
      salvarNoFirebaseSilencioso('vendas', vendas);
    }

    alert('✅ Pedido cancelado e itens devolvidos ao estoque!');
    renderizarGestaoEntregas();
  }
}

// ==========================================
// TELA DO ENTREGADOR
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
    let statusPag = ''; let btnAcao = '';

    if (e.pagamento === 'pagar_entrega') {
      statusPag = `<span style='color:#e74c3c; font-weight:bold;'>⚠️ Cobrar R$ ${formatarMoeda(e.total)} na Entrega</span>`;
      btnAcao = `<button class='btn-principal' style='margin-top:10px; background:#f39c12;' onclick='abrirCobrancaEntregador(${e.id})'>💰 Receber e Entregar</button>`;
    } else {
      statusPag = `<span style='color:#27ae60; font-weight:bold;'>✅ Já Pago no Caixa (${e.pagamento})</span>`;
      btnAcao = `<button class='btn-principal' style='margin-top:10px;' onclick='concluirEntregaJaPaga(${e.id})'>✅ Marcar como Entregue</button>`;
    }

    container.innerHTML += `
      <div class='user-card' style='margin-bottom:15px; border-top-color:#8e44ad;'>
        <div class='user-card-header'>
          <strong>NF #${e.nf}</strong>
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
  document.getElementById('entregador-total-cobrar').textContent = formatarMoeda(e.total);
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
    
    document.getElementById('modal-pix-total').textContent = formatarMoeda(e.total);
    const payload = gerarPayloadPix(config.chavePix, parseFloat(e.total), 'Loja PDV', 'Cidade');
    document.getElementById('pix-copia-cola').value = payload;
    const canvas = document.getElementById('canvas-qrcode');
    if (typeof QRious !== 'undefined') new QRious({ element: canvas, value: payload, size: 220, level: 'M' });
    abrirModal('modal-pix');
  } 
  else if (forma === 'Cartão') {
    processarCartao(parseFloat(e.total), id);
  } 
  else if (forma === 'Dinheiro') {
    if (confirm(`💵 Confirma o recebimento de R$ ${formatarMoeda(e.total)} em dinheiro?`)) {
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
    id: entregas[idx].id,
    nf: entregas[idx].nf,
    data: new Date().toLocaleString('pt-BR'),
    itens: [...entregas[idx].itens],
    total: parseFloat(entregas[idx].total),
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

function copiarPix(idInput) {
  const input = document.getElementById(idInput);
  if(!input.value || input.value.includes('⚠️')) return alert('❌ Código inválido para copiar.');
  input.select(); input.setSelectionRange(0, 99999); 
  navigator.clipboard.writeText(input.value).then(() => alert('✅ Código Pix copiado!')).catch(err => alert('❌ Erro: ' + err));
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
        <div class='prod-preco'>R$ ${formatarMoeda(prod.preco)}</div>
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
  
  produto.quantidade += parseInt(carrinho[idx].quantidade, 10);
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
  let subtotal = 0;
  
  carrinho.forEach(item => {
    const valorItem = parseFloat(item.preco) * parseInt(item.quantidade, 10);
    subtotal += valorItem;
    container.innerHTML += `
      <div class='item-carrinho'>
        <div style='flex:1;'>
          <div style='font-weight:700; color:#2c3e50;'>${item.nome}</div>
          <div style='font-size:13px; color:#7f8c8d;'>${item.quantidade} × R$ ${formatarMoeda(item.preco)} = R$ ${formatarMoeda(valorItem)}</div>
        </div>
        <button style='color:#e74c3c; border:none; background:transparent; cursor:pointer; font-size:18px; padding:0 10px;' onclick='removerDoCarrinho(${item.id})'>✕</button>
      </div>
    `;
  });

  let totalAPagar = subtotal;

  if (creditoTroca > 0) {
    document.getElementById('linha-credito-troca').style.display = 'block';
    document.getElementById('valor-credito').textContent = formatarMoeda(creditoTroca);
    totalAPagar = Math.max(0, subtotal - creditoTroca);
  } else {
    document.getElementById('linha-credito-troca').style.display = 'none';
  }

  document.getElementById('valor-total').textContent = formatarMoeda(totalAPagar);
}

function limparCarrinho() {
  carrinho.forEach(item => {
    const produto = estoque.find(p => p.id === item.id);
    if (produto) produto.quantidade += parseInt(item.quantidade, 10);
  });
  carrinho = [];
  creditoTroca = 0; localStorage.removeItem('creditoTroca');
  salvarNoFirebaseSilencioso('estoque', estoque);
  salvarCarrinhoPendente();
  renderizarCarrinho();
}

// ==========================================
// FLUXO ATENDENTE DELIVERY
// ==========================================
function abrirModalDelivery() {
  if (carrinho.length === 0) return alert('🛒 O Carrinho está vazio!');
  
  let subtotal = carrinho.reduce((s, i) => s + (parseFloat(i.preco) * parseInt(i.quantidade, 10)), 0);
  let totalAPagar = Math.max(0, subtotal - creditoTroca);
  if (totalAPagar === 0 && subtotal > 0) return alert('⚠️ Trocas exatas não podem ser enviadas por delivery direto. Cancele e lance nova venda normal.');

  const select = document.getElementById('delivery-entregador');
  select.innerHTML = `<option value=''>-- Selecione um Entregador Livre --</option>`;
  usuarios.filter(u => u.perfil === 'entregador' && u.isLivre).forEach(u => {
    select.innerHTML += `<option value='${u.id}'>🏍️ ${u.user}</option>`;
  });
  
  document.getElementById('delivery-endereco').value = '';
  document.getElementById('delivery-pagamento').value = 'Pix';
  mudarPagamentoDelivery();
  
  abrirModal('modal-delivery');
}

function mudarPagamentoDelivery() {
  const forma = document.getElementById('delivery-pagamento').value;
  const areaPix = document.getElementById('area-pix-delivery');
  if (forma === 'Pix') {
    let subtotal = carrinho.reduce((s, i) => s + (parseFloat(i.preco) * parseInt(i.quantidade, 10)), 0);
    const total = Math.max(0, subtotal - creditoTroca);
    
    document.getElementById('valor-pix-delivery').textContent = formatarMoeda(total);
    if (!config.chavePix) { document.getElementById('pix-copia-cola-delivery').value = '⚠️ Chave Pix não configurada'; } 
    else { document.getElementById('pix-copia-cola-delivery').value = gerarPayloadPix(config.chavePix, total, 'Loja PDV', 'Cidade'); }
    areaPix.style.display = 'block';
  } else { areaPix.style.display = 'none'; }
}

function confirmarDelivery() {
  const endereco = document.getElementById('delivery-endereco').value.trim();
  const idEntregador = document.getElementById('delivery-entregador').value;
  const pagamento = document.getElementById('delivery-pagamento').value;

  if (!endereco || !idEntregador) return alert('❌ Preencha endereço e selecione o entregador.');

  let subtotal = carrinho.reduce((s, i) => s + (parseFloat(i.preco) * parseInt(i.quantidade, 10)), 0);
  const totalAPagar = Math.max(0, subtotal - creditoTroca);

  const idPedidoNovo = Date.now();
  const numNF = gerarProximaNF();

  entregas.push({
    id: idPedidoNovo,
    nf: numNF,
    data: new Date().toLocaleString('pt-BR'),
    itens: [...carrinho],
    total: totalAPagar,
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
      id: idPedidoNovo,
      nf: numNF,
      data: new Date().toLocaleString('pt-BR'),
      itens: [...carrinho],
      total: totalAPagar,
      formaPagamento: pagamento,
      usuario: usuarioLogado.user,
      tipo: 'Delivery'
    });
    salvarNoFirebaseSilencioso('vendas', vendas);
  }

  fecharModal('modal-delivery');
  carrinho = []; creditoTroca = 0; localStorage.removeItem('creditoTroca');
  salvarCarrinhoPendente();
  renderizarCarrinho();
  
  document.getElementById('titulo-nf-sucesso').textContent = 'Identificação do Pedido / NF';
  document.getElementById('numero-nf-gerado').innerHTML = `Ped: #${idPedidoNovo.toString().slice(-4)}<br><span style='font-size:26px; color:#e74c3c;'>NF: #${numNF}</span>`;
  document.getElementById('mensagem-sucesso-universal').textContent = 'O pedido foi despachado para o entregador.';
  abrirModal('modal-sucesso-universal');
}

// ==========================================
// FLUXO DE PAGAMENTO FÍSICO
// ==========================================
function iniciarPagamento(forma) {
  if (carrinho.length === 0) return alert('🛒 O Carrinho está vazio!');
  
  let subtotal = carrinho.reduce((s, i) => s + (parseFloat(i.preco) * parseInt(i.quantidade, 10)), 0);
  valorTotalVendaAtual = Math.max(0, subtotal - creditoTroca);

  if (valorTotalVendaAtual === 0 && subtotal > 0) {
    confirmarVendaFeita('Troca (Sem Diferença)');
    return;
  }

  modoPixAtual = 'caixa'; formaPagamentoAtual = forma;

  if (forma === 'Dinheiro') {
    document.getElementById('modal-dinheiro-total').textContent = formatarMoeda(valorTotalVendaAtual);
    document.getElementById('valor-recebido').value = '';
    document.getElementById('area-troco').style.display = 'none';
    document.getElementById('valor-troco').textContent = '0,00';
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
    spanTroco.textContent = '0,00';
    return;
  }

  const troco = recebido - valorTotalVendaAtual;
  spanTroco.textContent = formatarMoeda(troco);
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
  document.getElementById('modal-pix-total').textContent = formatarMoeda(valor);
  const payload = gerarPayloadPix(config.chavePix, valor, 'Loja PDV', 'Cidade');
  document.getElementById('pix-copia-cola').value = payload;
  
  const canvas = document.getElementById('canvas-qrcode');
  if (typeof QRious !== 'undefined') {
    new QRious({ element: canvas, value: payload, size: 220, level: 'M' });
  }
}

async function processarCartao(valorTotal, idEntregaOpcional = null) {
  const valorEmCentavos = Math.round(valorTotal * 100);
  try {
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.AppLauncher) {
      const { AppLauncher } = Capacitor.Plugins;
      const intentGertec = 'intent://payment#Intent;action=android.intent.action.VIEW;package=br.com.gertec.tef;S.valor=' + valorEmCentavos + ';S.tipoPagamento=DEBITO_CREDITO;end';
      const intentStone = 'stone://pay?amount=' + valorEmCentavos;
      const intentPagBank = 'pagseguro://pay?amount=' + valorEmCentavos;
      let abriuNativo = false;

      for (let urlApp of [intentStone, intentGertec, intentPagBank]) {
        const podeAbrir = await AppLauncher.canOpenUrl({ url: urlApp });
        if (podeAbrir.value) { await AppLauncher.openUrl({ url: urlApp }); abriuNativo = true; break; }
      }

      if (abriuNativo) {
        setTimeout(() => {
          if (confirm('✅ A Maquininha aprovou o pagamento impresso no recibo?')) {
             if(idEntregaOpcional) finalizarCobrancaEntregador(idEntregaOpcional, 'Cartão');
             else confirmarVendaFeita('Cartão');
          }
        }, 3000);
      } else throw new Error('App não encontrado.');
    } else throw new Error('Sem Capacitor.');
  } catch (e) {
    if (confirm(`💳 (Modo Manual) Digite R$ ${formatarMoeda(valorTotal)} na máquina física.\n\nAprovado?`)) {
      if(idEntregaOpcional) { finalizarCobrancaEntregador(idEntregaOpcional, 'Cartão'); fecharModal('modal-entregador-pagamento'); } 
      else confirmarVendaFeita('Cartão');
    }
  }
}

function confirmarVendaFeita(formaPagamento) {
  const numNF = gerarProximaNF();
  
  vendas.push({
    id: Date.now(),
    nf: numNF,
    data: new Date().toLocaleString('pt-BR'),
    itens: [...carrinho],
    total: valorTotalVendaAtual,
    formaPagamento: formaPagamento,
    usuario: usuarioLogado.user,
    tipo: 'Balcão'
  });
  salvarNoFirebaseSilencioso('vendas', vendas);
  
  fecharModal('modal-pix');
  fecharModal('modal-dinheiro');
  carrinho = []; creditoTroca = 0; localStorage.removeItem('creditoTroca');
  salvarCarrinhoPendente(); renderizarProdutos(); renderizarCarrinho();
  
  document.getElementById('titulo-nf-sucesso').textContent = 'Número da NF / Recibo';
  document.getElementById('numero-nf-gerado').textContent = numNF;
  document.getElementById('mensagem-sucesso-universal').textContent = 'Venda de Balcão finalizada!';
  abrirModal('modal-sucesso-universal');
}

// ==========================================
// PAINEL ADM - DASHBOARDS INTELIGENTES BI (FILTROS)
// ==========================================
function aplicarFiltroPersonalizado() {
  const inicio = document.getElementById('filtro-data-inicio').value;
  const fim = document.getElementById('filtro-data-fim').value;
  if (!inicio && !fim) return alert('⚠️ Preencha a data de "De" ou "Até" para filtrar.');
  const objSelect = document.getElementById('filtro-periodo'); if (objSelect) objSelect.value = 'personalizado';
  renderizarDashboard();
}

function limparFiltrosDash() { dashFiltroPagamento = null; dashFiltroUsuario = null; document.getElementById('btn-limpar-filtro').style.display = 'none'; renderizarDashboard(); }
function filtrarDashPorPagamento(forma) { if (dashFiltroPagamento === forma) dashFiltroPagamento = null; else dashFiltroPagamento = forma; atualizarBotaoFiltro(); renderizarDashboard(); }
function filtrarDashPorUsuario(usuario) { if (dashFiltroUsuario === usuario) dashFiltroUsuario = null; else dashFiltroUsuario = usuario; atualizarBotaoFiltro(); renderizarDashboard(); }

function atualizarBotaoFiltro() {
  const btn = document.getElementById('btn-limpar-filtro'); let textos = [];
  if (dashFiltroPagamento) textos.push(dashFiltroPagamento); if (dashFiltroUsuario) textos.push(dashFiltroUsuario);
  if (textos.length > 0) { btn.style.display = 'inline-block'; btn.innerHTML = `❌ Limpar Filtro (${textos.join(' + ')})`; } else btn.style.display = 'none';
}

function renderizarDashboard() {
  const objSelect = document.getElementById('filtro-periodo');
  const periodo = objSelect ? objSelect.value : 'hoje';
  
  if (periodo !== 'personalizado') {
    const dtIni = document.getElementById('filtro-data-inicio'); const dtFim = document.getElementById('filtro-data-fim');
    if(dtIni) dtIni.value = ''; if(dtFim) dtFim.value = '';
  }

  const dataInicioStr = document.getElementById('filtro-data-inicio') ? document.getElementById('filtro-data-inicio').value : '';
  const dataFimStr = document.getElementById('filtro-data-fim') ? document.getElementById('filtro-data-fim').value : '';

  const parseDataBR = (str) => {
    const p = str.split('/');
    if (p.length !== 3) return 0;
    return parseInt(p[2] + p[1].padStart(2, '0') + p[0].padStart(2, '0'), 10);
  };
  const parseDataInput = (str) => {
    const p = str.split('-');
    if (p.length !== 3) return 0;
    return parseInt(p[0] + p[1] + p[2], 10);
  };

  const dataHojeObj = new Date();
  const hojeYYYYMMDD = parseInt(dataHojeObj.getFullYear().toString() + (dataHojeObj.getMonth() + 1).toString().padStart(2, '0') + dataHojeObj.getDate().toString().padStart(2, '0'), 10);
  const hojeYYYYMM = Math.floor(hojeYYYYMMDD / 100);

  let fundoCaixaGeral = 0;
  
  let vendasPorData = vendas.filter(v => {
    if (!v.data) return false;
    const dataVendaStr = v.data.split(' ')[0].replace(',', '');
    const dataVInt = parseDataBR(dataVendaStr);
    const dataVMes = Math.floor(dataVInt / 100);
    
    let passaFiltro = true;
    
    if (periodo === 'hoje') passaFiltro = (dataVInt === hojeYYYYMMDD);
    else if (periodo === 'mes') passaFiltro = (dataVMes === hojeYYYYMM);
    else if (periodo === 'personalizado') {
      const dataI = dataInicioStr ? parseDataInput(dataInicioStr) : 0;
      const dataF = dataFimStr ? parseDataInput(dataFimStr) : 99999999;
      passaFiltro = (dataVInt >= dataI && dataVInt <= dataF);
    }
    
    if (passaFiltro && v.tipo === 'Abertura de Caixa') {
      fundoCaixaGeral += parseFloat(v.total || 0);
      return false; 
    }
    return passaFiltro; 
  });

  document.getElementById('dash-fundo-caixa').textContent = 'R$ ' + formatarMoeda(fundoCaixaGeral);

  let basePagamentos = dashFiltroUsuario ? vendasPorData.filter(v => v.usuario === dashFiltroUsuario) : vendasPorData;
  let porPagamento = { 'Pix': 0, 'Cartão': 0, 'Dinheiro': 0, 'Delivery': 0 };
  basePagamentos.forEach(v => {
    let forma = v.formaPagamento || 'Outros';
    if(forma.includes('Troca')) forma = 'Troca (Diferença)';
    porPagamento[forma] = (porPagamento[forma] || 0) + parseFloat(v.total || 0);
  });

  let baseUsuarios = dashFiltroPagamento ? vendasPorData.filter(v => v.formaPagamento === dashFiltroPagamento) : vendasPorData;
  let porUsuario = {};
  baseUsuarios.forEach(v => {
    const user = v.usuario || 'Desconhecido';
    porUsuario[user] = (porUsuario[user] || 0) + parseFloat(v.total || 0);
  });

  let baseGeral = vendasPorData;
  if (dashFiltroPagamento) baseGeral = baseGeral.filter(v => v.formaPagamento === dashFiltroPagamento);
  if (dashFiltroUsuario) baseGeral = baseGeral.filter(v => v.usuario === dashFiltroUsuario);

  let totalGeral = 0; let porProduto = {};
  baseGeral.forEach(v => {
    totalGeral += parseFloat(v.total || 0);
    if(v.itens) v.itens.forEach(item => { 
      const nomeProd = (item.nome || 'Produto').trim();
      porProduto[nomeProd] = (porProduto[nomeProd] || 0) + parseInt(item.quantidade || 0, 10); 
    });
  });

  document.getElementById('dash-total-geral').textContent = 'R$ ' + formatarMoeda(totalGeral);
  document.getElementById('dash-qtd-vendas').textContent = baseGeral.length;

  const renderGrafico = (divId, dataObj, color, prefix = '', suffix = '', filtroTipo = null) => {
    const div = document.getElementById(divId); div.innerHTML = '';
    let maxV = Math.max(...Object.values(dataObj), 1);
    if (Object.keys(dataObj).length === 0) { div.innerHTML = `<p style='width:100%; text-align:center; padding-top:20px; color:#7f8c8d; font-size:14px;'>Sem dados no período.</p>`; return; }
    for (let k in dataObj) {
      let val = dataObj[k]; let perc = (val / maxV) * 100;
      let isClickable = filtroTipo !== null; let cssClass = isClickable ? 'barra-container clickable' : 'barra-container';
      let clickAction = ''; let opacity = '1';
      if (filtroTipo === 'pagamento') { clickAction = `onclick="filtrarDashPorPagamento('${k}')"`; if (dashFiltroPagamento && dashFiltroPagamento !== k) opacity = '0.4'; } 
      else if (filtroTipo === 'usuario') { clickAction = `onclick="filtrarDashPorUsuario('${k}')"`; if (dashFiltroUsuario && dashFiltroUsuario !== k) opacity = '0.4'; }
      
      let valDisplay = (prefix === 'R$') ? formatarMoeda(val) : Math.round(val);
      div.innerHTML += `<div class='${cssClass}' ${clickAction} style='opacity:${opacity}'><div class='barra' style='height:${perc}%; background:${color};'>${prefix} ${valDisplay}${suffix}</div><span title='${k}'>${k}</span></div>`;
    }
  };
  
  renderGrafico('grafico-pagamentos', porPagamento, '#f39c12', 'R$', '', 'pagamento');
  renderGrafico('grafico-usuarios', porUsuario, '#3498db', 'R$', '', 'usuario');
  renderGrafico('grafico-produtos', porProduto, '#2ecc71', '', ' un');

  let entregasFiltradas = entregas.filter(e => {
    if (!e.data) return false;
    const dataEStr = e.data.split(' ')[0].replace(',', '');
    const dataEInt = parseDataBR(dataEStr);
    const dataEMes = Math.floor(dataEInt / 100);
    
    if (periodo === 'hoje') return dataEInt === hojeYYYYMMDD;
    if (periodo === 'mes') return dataEMes === hojeYYYYMM;
    if (periodo === 'personalizado') {
      const dataI = dataInicioStr ? parseDataInput(dataInicioStr) : 0;
      const dataF = dataFimStr ? parseDataInput(dataFimStr) : 99999999;
      return dataEInt >= dataI && dataEInt <= dataF;
    }
    return true;
  });

  if (dashFiltroPagamento) entregasFiltradas = entregasFiltradas.filter(e => e.pagamento === dashFiltroPagamento || e.pagamentoFormaReal === dashFiltroPagamento);
  if (dashFiltroUsuario) entregasFiltradas = entregasFiltradas.filter(e => e.atendente === dashFiltroUsuario);

  let entregasPorPessoa = {}; let tempoMedioEntregador = {}; let somaTempo = {};
  entregasFiltradas.forEach(e => {
    if (e.status === 'entregue') {
      const nomeEnt = usuarios.find(u => u.id === e.idEntregador)?.user || 'Desconhecido';
      entregasPorPessoa[nomeEnt] = (entregasPorPessoa[nomeEnt] || 0) + 1;
      const minGastos = (e.tempoEntrega - e.tempoCriacao) / 60000;
      somaTempo[nomeEnt] = (somaTempo[nomeEnt] || 0) + minGastos;
    }
  });

  for (let nome in entregasPorPessoa) { tempoMedioEntregador[nome] = somaTempo[nome] / entregasPorPessoa[nome]; }
  renderGrafico('grafico-entregadores', entregasPorPessoa, '#8e44ad', '', ' ent');
  renderGrafico('grafico-tempo-entrega', tempoMedioEntregador, '#e67e22', '', ' min');
}

// ==========================================
// ESTOQUE CRUD
// ==========================================
function converterImagemBase64(event, imgPreviewId) {
  const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
  reader.onload = function(e) { imgBase64Temp = e.target.result; document.getElementById(imgPreviewId).src = imgBase64Temp; const idInputUrl = imgPreviewId === 'preview-img-cadastro' ? 'prod-imagem-url' : 'edit-prod-url'; document.getElementById(idInputUrl).value = ''; };
  reader.readAsDataURL(file);
}
function carregarImagemUrl(url, imgPreviewId) { if (!url) { imgBase64Temp = ''; document.getElementById(imgPreviewId).src = ''; return; } imgBase64Temp = url; document.getElementById(imgPreviewId).src = url; const idInputFile = imgPreviewId === 'preview-img-cadastro' ? 'prod-imagem-file' : 'edit-prod-file'; document.getElementById(idInputFile).value = ''; }

function cadastrarProduto() {
  const nome = document.getElementById('prod-nome').value.trim();
  const preco = parseFloat(document.getElementById('prod-preco').value.replace(',', '.'));
  const qtd = parseInt(document.getElementById('prod-qtd').value, 10);
  if (!nome || isNaN(preco) || isNaN(qtd)) return alert('❌ Preencha Nome, Preço e Quantidade corretamente.');
  estoque.push({ id: Date.now(), nome, preco, quantidade: qtd, imagem: imgBase64Temp });
  salvarNoFirebaseSilencioso('estoque', estoque);
  document.getElementById('prod-nome').value = ''; document.getElementById('prod-preco').value = ''; document.getElementById('prod-qtd').value = ''; document.getElementById('prod-imagem-file').value = ''; document.getElementById('prod-imagem-url').value = ''; document.getElementById('preview-img-cadastro').src = ''; imgBase64Temp = '';
  renderizarListaEstoqueAdm(); alert('✅ Produto cadastrado!');
}

function renderizarListaEstoqueAdm() {
  const painel = document.getElementById('tabela-estoque-adm'); painel.innerHTML = '';
  estoque.forEach(prod => {
    painel.innerHTML += `
      <div class='linha-lista'>
        <div><strong style='font-size:15px; color:#2c3e50;'>${prod.nome}</strong> <span style='color:#27ae60; font-weight:bold; margin-left:10px;'>R$ ${formatarMoeda(prod.preco)}</span></div>
        <div class='acoes-lista'><span style='color:#7f8c8d; font-size:13px; margin-right:15px;'>Estoque: <strong>${prod.quantidade}</strong></span><button class='btn-acao btn-edit' onclick='abrirEdicaoProduto(${prod.id})'>✏️ Editar</button><button class='btn-acao btn-del' onclick='excluirProduto(${prod.id})'>🗑️</button></div>
      </div>
    `;
  });
  atualizarCheckboxesPermissoes();
}

function abrirEdicaoProduto(id) {
  const p = estoque.find(e => e.id === id); if (!p) return;
  document.getElementById('edit-prod-id').value = p.id; document.getElementById('edit-prod-nome').value = p.nome; document.getElementById('edit-prod-preco').value = p.preco; document.getElementById('edit-prod-qtd').value = p.quantidade;
  imgBase64Temp = p.imagem || ''; document.getElementById('preview-img-edit').src = imgBase64Temp;
  abrirModal('modal-editar-produto');
}

function salvarEdicaoProduto() {
  const p = estoque.find(e => e.id === parseInt(document.getElementById('edit-prod-id').value, 10)); if (!p) return;
  p.nome = document.getElementById('edit-prod-nome').value; p.preco = parseFloat(document.getElementById('edit-prod-preco').value); p.quantidade = parseInt(document.getElementById('edit-prod-qtd').value, 10); p.imagem = imgBase64Temp;
  salvarNoFirebaseSilencioso('estoque', estoque); fecharModal('modal-editar-produto'); renderizarListaEstoqueAdm(); carrinho = []; salvarCarrinhoPendente();
}

function excluirProduto(id) { if (confirm('⚠️ Excluir?')) { estoque = estoque.filter(e => e.id !== id); salvarNoFirebaseSilencioso('estoque', estoque); renderizarListaEstoqueAdm(); carrinho = []; salvarCarrinhoPendente(); } }

function importarExcel(event) {
  const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result); const json = XLSX.utils.sheet_to_json(XLSX.read(data, { type: 'array' }).Sheets[XLSX.read(data, { type: 'array' }).SheetNames[0]]);
      let imp = 0; let bId = Date.now();
      json.forEach((r, i) => {
        const n = r['Nome do Produto'] || r['Nome'] || r['nome']; const p = parseFloat((r['Preço (R$)'] || r['Preço'] || r['Preco'] || r['preco']).toString().replace(',', '.')); const q = parseInt(r['Qtd Inicial'] || r['Quantidade'] || r['Qtd'] || r['quantidade']);
        if (n && !isNaN(p) && !isNaN(q)) { estoque.push({ id: bId + i, nome: n.toString().trim(), preco: p, quantidade: q, imagem: '' }); imp++; }
      });
      if (imp > 0) { salvarNoFirebaseSilencioso('estoque', estoque); renderizarListaEstoqueAdm(); alert(`✅ ${imp} importados!`); }
    } catch (err) { alert('❌ Erro no Excel.'); } event.target.value = '';
  }; reader.readAsArrayBuffer(file);
}

// ==========================================
// USUÁRIOS E CONFIGURAÇÕES CRUD
// ==========================================
function atualizarCheckboxesPermissoes() {
  const rend = (id, cls) => { const div = document.getElementById(id); if(!div) return; div.innerHTML = ''; estoque.forEach(p => { div.innerHTML += `<label class='perm-item'><input type='checkbox' class='${cls}' value='${p.id}'> ${p.nome}</label>`; }); };
  rend('permissoes-produtos', 'chk-perm-cad'); rend('bloco-permissoes-edit', 'chk-perm-edit');
}
function marcarPermissoes(m) { document.querySelectorAll('.chk-perm-cad').forEach(c => c.checked = m); }
function togglePermissoesUI() { const p = document.getElementById('novo-perfil').value; const b = document.getElementById('bloco-permissoes-container'); b.style.opacity = (p === 'admin' || p === 'entregador') ? '0.4' : '1'; b.style.pointerEvents = (p === 'admin' || p === 'entregador') ? 'none' : 'auto'; }
function togglePermissoesUIEdit() { const p = document.getElementById('edit-user-perfil').value; const b = document.getElementById('bloco-permissoes-edit'); b.style.opacity = (p === 'admin' || p === 'entregador') ? '0.4' : '1'; b.style.pointerEvents = (p === 'admin' || p === 'entregador') ? 'none' : 'auto'; }

function cadastrarUsuario() {
  const u = document.getElementById('novo-user').value.trim(); const s = document.getElementById('novo-senha').value.trim(); const p = document.getElementById('novo-perfil').value; const adm = (p === 'admin');
  if (!u || !s) return alert('❌ Preencha os dados!'); if (usuarios.find(x => x.user === u)) return alert('❌ Usuário existe!');
  let perm = 'ALL';
  if (p === 'caixa' || p === 'atendente_delivery') { const m = Array.from(document.querySelectorAll('.chk-perm-cad:checked')).map(c => c.value); if (m.length === 0) return alert('❌ Escolha produtos!'); perm = m; }
  usuarios.push({ id: Date.now(), user: u, senha: s, isAdmin: adm, perfil: p, permissoes: perm, isLivre: false });
  salvarNoFirebaseSilencioso('usuarios', usuarios); document.getElementById('novo-user').value = ''; document.getElementById('novo-senha').value = ''; marcarPermissoes(false); togglePermissoesUI(); renderizarUsuariosAdm(); alert('✅ Cadastrado!');
}

function renderizarUsuariosAdm() {
  const t = document.getElementById('busca-usuario').value.toLowerCase(); const p = document.getElementById('lista-usuarios-adm'); p.innerHTML = '';
  usuarios.filter(u => u.user.toLowerCase().includes(t)).forEach(u => {
    let lp = '👤 Caixa'; let ct = '#3498db';
    if (u.user === 'au.costa' || u.perfil === 'admin' || u.isAdmin) { lp = '🛡️ Admin'; ct = '#e74c3c'; } else if (u.perfil === 'entregador') { lp = '🏍️ Entregador'; ct = '#8e44ad'; } else if (u.perfil === 'atendente_delivery') { lp = '🎧 Atend. Delivery'; ct = '#2ecc71'; }
    const q = u.permissoes === 'ALL' ? 'Todos' : (u.permissoes ? u.permissoes.length : 0);
    let qr = ''; if (typeof QRious !== 'undefined') qr = new QRious({ value: u.user, size: 100 }).toDataURL();
    let act = u.user !== 'au.costa' ? `<div class='acoes-card-user'><button class='btn-acao btn-edit' style='flex:1;' onclick='abrirEdicaoUsuario(${u.id})'>✏️</button><button class='btn-acao btn-del' style='flex:1;' onclick='excluirUsuario(${u.id})'>🗑️</button></div>` : '';
    p.innerHTML += `<div class='user-card'><div class='user-card-header'><strong style='font-size:16px; color:#2c3e50;'>${u.user}</strong><span style='font-size:12px; font-weight:bold; color:${ct};'>${lp}</span></div><div class='user-info'><p>🔑 Senha: <strong>${u.senha}</strong></p><p>📦 Permissões: <strong>${q}</strong></p></div><div class='qr-container'><p style='font-size:11px; margin-bottom:5px; font-weight:bold; color:#777;'>Crachá QR Code</p><img src='${qr}' alt='QR Offline'></div>${act}</div>`;
  });
}

function abrirEdicaoUsuario(id) {
  const u = usuarios.find(x => x.id === id); if (!u || u.user === 'au.costa') return;
  document.getElementById('edit-user-id').value = u.id; document.getElementById('edit-user-nome').value = u.user; document.getElementById('edit-user-senha').value = u.senha;
  document.getElementById('edit-user-perfil').value = u.perfil || (u.isAdmin ? 'admin' : 'caixa'); togglePermissoesUIEdit();
  document.querySelectorAll('.chk-perm-edit').forEach(c => { c.checked = u.permissoes === 'ALL' ? false : (u.permissoes ? u.permissoes.includes(c.value) : false); }); abrirModal('modal-editar-usuario');
}

function salvarEdicaoUsuario() {
  const u = usuarios.find(x => x.id === parseInt(document.getElementById('edit-user-id').value, 10)); if (!u) return;
  u.user = document.getElementById('edit-user-nome').value; u.senha = document.getElementById('edit-user-senha').value; u.perfil = document.getElementById('edit-user-perfil').value; u.isAdmin = (u.perfil === 'admin');
  if (u.perfil === 'admin' || u.perfil === 'entregador') { u.permissoes = 'ALL'; } else { const m = Array.from(document.querySelectorAll('.chk-perm-edit:checked')).map(c => c.value); if (m.length === 0) return alert('❌ Escolha 1 produto!'); u.permissoes = m; }
  salvarNoFirebaseSilencioso('usuarios', usuarios); fecharModal('modal-editar-usuario'); renderizarUsuariosAdm();
}
function excluirUsuario(id) { if (confirm('⚠️ Excluir funcionário?')) { usuarios = usuarios.filter(u => u.id !== id); salvarNoFirebaseSilencioso('usuarios', usuarios); renderizarUsuariosAdm(); } }
function salvarConfig() { config.chavePix = document.getElementById('config-chave-pix').value.trim(); salvarNoFirebaseSilencioso('config', config); alert('✅ Configurações PIX salvas!'); }

function gerarPayloadPix(c, v, n, cid) {
  let vs = v.toFixed(2); let p = '00020126' + (22 + c.length) + '0014br.gov.bcb.pix01' + (c.length < 10 ? '0' : '') + c.length + c + '520400005303986' + (v > 0 ? '54' + (vs.length < 10 ? '0' : '') + vs.length + vs : '') + '5802BR59' + (n.length < 10 ? '0' : '') + n.length + n + '60' + (cid.length < 10 ? '0' : '') + cid.length + cid + '62070503***6304';
  let crc = 0xFFFF; for (let i = 0; i < p.length; i++) { crc ^= p.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) crc = (crc & 0x8000) > 0 ? (crc << 1) ^ 0x1021 : crc << 1; }
  let h = (crc & 0xFFFF).toString(16).toUpperCase(); while (h.length < 4) h = '0' + h; return p + h;
}