// ==========================================
// SISTEMA PDV — FIREBASE + PWA (OFFLINE & RESTAURAÇÃO F5)
// ==========================================

let estoque = [];
let vendas = [];
let usuarios = [];
let config = { chavePix: '' };
let carrinho = [];
let usuarioLogado = null;
let imgBase64Temp = ''; 
let leitorCameraQr = null; // Variável Global do Leitor da Câmera

// Variáveis Firebase
let firebaseDatabase = null;
let fbRef = null;
let fbSet = null;
let fbGet = null;
let fbChild = null;

// ==========================================
// REGISTRO DO SERVICE WORKER (APP INSTALÁVEL)
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('Erro no Service Worker:', err));
  });
}

// ==========================================
// INICIALIZAÇÃO FIREBASE E RESTAURAÇÃO DE TELA (F5)
// ==========================================
async function iniciarSistemaFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
    const { getDatabase, ref, set, get, child } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js');

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
    fbGet = get;
    fbChild = child;
    
    await carregarDadosDB();
  } catch (error) {
    console.error('Sem conexão com Firebase. Iniciando modo Offline Local.', error);
    carregarDadosLocais();
  }
  
  inicializarAdminPadrao();
  restaurarEstadoDoNavegador();
}

window.onload = function() {
  iniciarSistemaFirebase();
};

// Restaura os dados se o usuário apertar F5
function restaurarEstadoDoNavegador() {
  const salvoUser = localStorage.getItem('usuarioLogado');
  
  if (salvoUser) {
    usuarioLogado = JSON.parse(salvoUser);
    carrinho = JSON.parse(localStorage.getItem('carrinhoPendente')) || [];
    
    const telaSalva = localStorage.getItem('telaAtual') || 'venda';
    const abaSalva = localStorage.getItem('abaAtual') || 'dashboard';
    
    // Recarrega layout header
    document.getElementById('nome-operador').textContent = usuarioLogado.user;
    document.getElementById('btn-menu-adm').style.display = usuarioLogado.isAdmin ? 'inline-block' : 'none';
    const btnUsuarios = document.getElementById('btn-aba-usuarios');
    if (btnUsuarios) btnUsuarios.style.display = (usuarioLogado.user === 'au.costa') ? 'inline-block' : 'none';
    
    irPara(telaSalva);
    if (telaSalva === 'adm') mudarAbaAdm(abaSalva);
  } else {
    irPara('login');
  }
}

// ==========================================
// CONTROLE DE DADOS (ONLINE E OFFLINE)
// ==========================================
async function carregarDadosDB() {
  const dbRoot = fbRef(firebaseDatabase);
  const snapshot = await fbGet(fbChild(dbRoot, 'PDV'));
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    estoque = data.estoque || [];
    vendas = data.vendas || [];
    usuarios = data.usuarios || [];
    config = data.config || { chavePix: '' };
    
    localStorage.setItem('estoque', JSON.stringify(estoque));
    localStorage.setItem('vendas', JSON.stringify(vendas));
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    localStorage.setItem('config', JSON.stringify(config));
  } else {
    carregarDadosLocais();
    salvarNoFirebase('estoque', estoque);
    salvarNoFirebase('vendas', vendas);
    salvarNoFirebase('usuarios', usuarios);
    salvarNoFirebase('config', config);
  }
}

function carregarDadosLocais() {
  estoque = JSON.parse(localStorage.getItem('estoque')) || [];
  vendas = JSON.parse(localStorage.getItem('vendas')) || [];
  usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
  config = JSON.parse(localStorage.getItem('config')) || { chavePix: '' };
}

function salvarDados(chave, dados) {
  localStorage.setItem(chave, JSON.stringify(dados));
  if (firebaseDatabase) salvarNoFirebase(chave, dados);
}

function salvarNoFirebase(chave, dados) {
  fbSet(fbRef(firebaseDatabase, 'PDV/' + chave), dados).catch(err => console.log('Offline.', err));
}

function inicializarAdminPadrao() {
  const adminMaster = usuarios.find(u => u.user === 'au.costa');
  if (!adminMaster) {
    usuarios.push({ id: Date.now(), user: 'au.costa', senha: '80605276', isAdmin: true, permissoes: 'ALL' });
    salvarDados('usuarios', usuarios);
  }
}

// ==========================================
// NAVEGAÇÃO E PERSISTÊNCIA DE TELA
// ==========================================
function irPara(nomeTela) {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.getElementById('tela-' + nomeTela).classList.add('ativa');

  // Salva no navegador caso atualize
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
}

function mudarAbaAdm(aba) {
  document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('ativa'));
  document.querySelectorAll('.aba-conteudo').forEach(c => c.classList.remove('ativa'));
  
  const btnClicado = document.querySelector(`.aba-btn[onclick*='${aba}']`);
  if (btnClicado) btnClicado.classList.add('ativa');
  document.getElementById('aba-' + aba).classList.add('ativa');
  
  // Salva no navegador caso atualize
  localStorage.setItem('abaAtual', aba);
}

function abrirModal(id) { document.getElementById(id).classList.add('ativa'); }
function fecharModal(id) { document.getElementById(id).classList.remove('ativa'); }

// ==========================================
// CÂMERA QR CODE E LOGIN
// ==========================================
function abrirCameraLogin() {
  if (typeof Html5Qrcode === 'undefined') {
    alert('⚠️ Biblioteca de Câmera não carregada. Conecte-se à internet uma vez para baixar.');
    return;
  }
  
  abrirModal('modal-camera');
  
  leitorCameraQr = new Html5Qrcode('leitor-camera');
  const configuracao = { fps: 10, qrbox: { width: 250, height: 250 } };
  
  leitorCameraQr.start({ facingMode: 'environment' }, configuracao, (textoLido) => {
    // Sucesso na leitura
    fecharCameraQR();
    processarLoginCachra(textoLido.trim());
  }, (erro) => {
    // Ignora erros de frame contínuo da câmera
  }).catch((err) => {
    alert('❌ Erro ao acessar a Câmera: ' + err);
    fecharCameraQR();
  });
}

function fecharCameraQR() {
  if (leitorCameraQr) {
    leitorCameraQr.stop().then(() => { leitorCameraQr.clear(); }).catch(e => console.log(e));
  }
  fecharModal('modal-camera');
}

function processarLoginCachra(qrText) {
  const usuario = usuarios.find(u => u.user === qrText);
  if (usuario) iniciarSessao(usuario);
  else alert('❌ Crachá inválido ou não cadastrado.');
}

function fazerLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-senha').value.trim();
  const usuario = usuarios.find(u => u.user === user && u.senha === pass);
  if (usuario) iniciarSessao(usuario);
  else alert('❌ Usuário ou senha incorretos!');
}

function iniciarSessao(usuario) {
  usuarioLogado = usuario;
  localStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
  
  document.getElementById('nome-operador').textContent = usuario.user;
  document.getElementById('login-user').value = '';
  document.getElementById('login-senha').value = '';
  
  document.getElementById('btn-menu-adm').style.display = usuario.isAdmin ? 'inline-block' : 'none';
  const btnUsuarios = document.getElementById('btn-aba-usuarios');
  if (btnUsuarios) btnUsuarios.style.display = (usuario.user === 'au.costa') ? 'inline-block' : 'none';
  
  irPara('venda');
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
// CAIXA E CARRINHO (C/ PERSISTÊNCIA)
// ==========================================
function renderizarProdutos(lista) {
  const container = document.getElementById('lista-produtos');
  container.innerHTML = '';
  
  let produtosParaExibir = estoque;

  if (usuarioLogado && !usuarioLogado.isAdmin && usuarioLogado.permissoes !== 'ALL') {
    produtosParaExibir = estoque.filter(p => usuarioLogado.permissoes.includes(p.id.toString()));
  }

  if (lista) produtosParaExibir = lista;

  produtosParaExibir.forEach(prod => {
    const card = document.createElement('div');
    card.className = 'produto-card ' + (prod.quantidade <= 0 ? 'esgotado' : '');
    
    const imgData = prod.imagem ? prod.imagem : 'data:image/svg+xml;utf8,<svg xmlns=`http://www.w3.org/2000/svg` viewBox=`0 0 100 100`><rect fill=`%23eee` width=`100` height=`100`/><text fill=`%23999` x=`50` y=`50` font-family=`sans-serif` font-size=`14` text-anchor=`middle` alignment-baseline=`middle`>Sem Foto</text></svg>'.replace(/`/g, "'");
    
    card.innerHTML = `
      <div class='prod-img-box'>
        <img src='${imgData}' alt='Img'>
      </div>
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
  if (!usuarioLogado.isAdmin && usuarioLogado.permissoes !== 'ALL') {
    produtosDisponiveis = estoque.filter(p => usuarioLogado.permissoes.includes(p.id.toString()));
  }
  const filtrado = produtosDisponiveis.filter(p => p.nome.toLowerCase().includes(termo));
  renderizarProdutos(filtrado);
}

function adicionarAoCarrinho(idProd) {
  const produto = estoque.find(p => p.id === idProd);
  if (!produto || produto.quantidade <= 0) return;
  produto.quantidade--;
  salvarDados('estoque', estoque);

  const itemNoCarrinho = carrinho.find(i => i.id === idProd);
  if (itemNoCarrinho) itemNoCarrinho.quantidade++;
  else carrinho.push({ ...produto, quantidade: 1 });

  salvarCarrinhoPendente();
  renderizarProdutos();
  renderizarCarrinho();
}

function removerDoCarrinho(idProd) {
  const idx = carrinho.findIndex(i => i.id === idProd);
  if (idx === -1) return;
  const produto = estoque.find(p => p.id === idProd);
  produto.quantidade += carrinho[idx].quantidade;
  carrinho.splice(idx, 1);
  
  salvarDados('estoque', estoque);
  salvarCarrinhoPendente();
  renderizarProdutos();
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
  salvarDados('estoque', estoque);
  salvarCarrinhoPendente();
  renderizarProdutos();
  renderizarCarrinho();
}

// ==========================================
// FLUXO DE PAGAMENTO
// ==========================================
let formaPagamentoAtual = '';
let valorTotalVendaAtual = 0;

function iniciarPagamento(forma) {
  if (carrinho.length === 0) return alert('🛒 O Carrinho está vazio!');
  
  formaPagamentoAtual = forma;
  valorTotalVendaAtual = carrinho.reduce((s, i) => s + (i.preco * i.quantidade), 0);

  if (forma === 'Dinheiro') {
    document.getElementById('modal-dinheiro-total').textContent = valorTotalVendaAtual.toFixed(2);
    document.getElementById('valor-recebido').value = '';
    document.getElementById('area-troco').style.display = 'none';
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

function calcularTrocoEConfirmar() {
  const input = document.getElementById('valor-recebido').value;
  const recebido = parseFloat(input.replace(',', '.'));
  if (isNaN(recebido) || recebido < valorTotalVendaAtual) return alert('❌ Valor inserido é inválido ou menor que o total.');
  
  const troco = recebido - valorTotalVendaAtual;
  document.getElementById('valor-troco').textContent = troco.toFixed(2);
  document.getElementById('area-troco').style.display = 'block';

  setTimeout(() => {
    if (confirm('✅ Você entregou o troco ao cliente? Pressione OK para finalizar a venda.')) {
      fecharModal('modal-dinheiro');
      confirmarVendaFeita('Dinheiro');
    }
  }, 500);
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
        else alert('❌ Pagamento Cancelado.');
      }, 3000);
    } else {
      throw new Error('Sem app maquininha');
    }
  } catch (e) {
    if (confirm(`💳 (Modo Manual) Digite R$ ${valorTotal.toFixed(2)} na máquina de cartão.\n\nO pagamento foi aprovado?`)) {
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
  salvarDados('vendas', vendas);
  fecharModal('modal-pix');
  fecharModal('modal-dinheiro');
  carrinho = [];
  salvarCarrinhoPendente();
  renderizarProdutos();
  renderizarCarrinho();
  alert('🎉 Venda Finalizada com Sucesso!');
}

// ==========================================
// PAINEL ADM - DASHBOARD
// ==========================================
function renderizarDashboard() {
  let totalGeral = 0;
  let porUsuario = {};
  let porProduto = {};

  vendas.forEach(v => {
    totalGeral += v.total;
    const user = v.usuario || 'Desconhecido';
    porUsuario[user] = (porUsuario[user] || 0) + v.total;
    v.itens.forEach(item => {
      porProduto[item.nome] = (porProduto[item.nome] || 0) + item.quantidade;
    });
  });

  document.getElementById('dash-total-geral').textContent = 'R$ ' + totalGeral.toFixed(2);
  document.getElementById('dash-qtd-vendas').textContent = vendas.length;

  const divUsuarios = document.getElementById('grafico-usuarios');
  divUsuarios.innerHTML = '';
  let maxUsr = Math.max(...Object.values(porUsuario), 1);
  for (let u in porUsuario) {
    let perc = (porUsuario[u] / maxUsr) * 100;
    divUsuarios.innerHTML += `
      <div class='barra-container'>
        <div class='barra' style='height: ${perc}%; background:#3498db;' title='R$ ${porUsuario[u].toFixed(2)}'>R$ ${Math.round(porUsuario[u])}</div>
        <span title='${u}'>${u}</span>
      </div>`;
  }

  const divProds = document.getElementById('grafico-produtos');
  divProds.innerHTML = '';
  let maxProd = Math.max(...Object.values(porProduto), 1);
  for (let p in porProduto) {
    let perc = (porProduto[p] / maxProd) * 100;
    divProds.innerHTML += `
      <div class='barra-container'>
        <div class='barra' style='height: ${perc}%; background:#2ecc71;' title='${porProduto[p]} un'>${porProduto[p]}</div>
        <span title='${p}'>${p}</span>
      </div>`;
  }
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
  salvarDados('estoque', estoque);
  
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

  salvarDados('estoque', estoque);
  fecharModal('modal-editar-produto');
  renderizarListaEstoqueAdm();
  carrinho = [];
  salvarCarrinhoPendente();
}

function excluirProduto(id) {
  if (confirm('⚠️ Tem certeza que deseja EXCLUIR este produto?')) {
    estoque = estoque.filter(e => e.id !== id);
    salvarDados('estoque', estoque);
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
        salvarDados('estoque', estoque);
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
// USUÁRIOS CRUD
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
  const isAdm = document.getElementById('novo-isadm').checked;
  const bloco = document.getElementById('bloco-permissoes-container');
  bloco.style.opacity = isAdm ? '0.4' : '1';
  bloco.style.pointerEvents = isAdm ? 'none' : 'auto';
}

function togglePermissoesUIEdit() {
  const isAdm = document.getElementById('edit-user-isadm').checked;
  const bloco = document.getElementById('bloco-permissoes-edit');
  bloco.style.opacity = isAdm ? '0.4' : '1';
  bloco.style.pointerEvents = isAdm ? 'none' : 'auto';
}

function cadastrarUsuario() {
  const user = document.getElementById('novo-user').value.trim();
  const senha = document.getElementById('novo-senha').value.trim();
  const isAdm = document.getElementById('novo-isadm').checked;
  
  if (!user || !senha) return alert('❌ Preencha usuário e senha!');
  if (usuarios.find(u => u.user === user)) return alert('❌ Esse usuário já existe!');

  let permissoes = 'ALL';
  if (!isAdm) {
    const marcados = Array.from(document.querySelectorAll('.chk-perm-cad:checked')).map(chk => chk.value);
    if (marcados.length === 0) return alert('❌ Escolha produtos permitidos!');
    permissoes = marcados;
  }

  usuarios.push({ id: Date.now(), user, senha, isAdmin: isAdm, permissoes });
  salvarDados('usuarios', usuarios);
  
  document.getElementById('novo-user').value = '';
  document.getElementById('novo-senha').value = '';
  document.getElementById('novo-isadm').checked = false;
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
    const tipo = u.user === 'au.costa' ? '👑 Master' : (u.isAdmin ? '🛡️ Admin' : '👤 Caixa');
    const corTipo = u.user === 'au.costa' ? '#f39c12' : (u.isAdmin ? '#e74c3c' : '#3498db');
    const qtR = u.permissoes === 'ALL' ? 'Todos' : u.permissoes.length;
    
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
          <span style='font-size:12px; font-weight:bold; color:${corTipo};'>${tipo}</span>
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
  document.getElementById('edit-user-isadm').checked = u.isAdmin;
  togglePermissoesUIEdit();
  document.querySelectorAll('.chk-perm-edit').forEach(chk => {
    chk.checked = u.permissoes === 'ALL' ? false : u.permissoes.includes(chk.value);
  });
  abrirModal('modal-editar-usuario');
}

function salvarEdicaoUsuario() {
  const id = parseInt(document.getElementById('edit-user-id').value);
  const u = usuarios.find(x => x.id === id);
  if (!u) return;
  u.user = document.getElementById('edit-user-nome').value;
  u.senha = document.getElementById('edit-user-senha').value;
  u.isAdmin = document.getElementById('edit-user-isadm').checked;
  if (u.isAdmin) {
    u.permissoes = 'ALL';
  } else {
    const marcados = Array.from(document.querySelectorAll('.chk-perm-edit:checked')).map(c => c.value);
    if (marcados.length === 0) return alert('❌ Escolha pelo menos 1 produto!');
    u.permissoes = marcados;
  }
  salvarDados('usuarios', usuarios);
  fecharModal('modal-editar-usuario');
  renderizarUsuariosAdm();
}

function excluirUsuario(id) {
  if (confirm('⚠️ Excluir este funcionário do sistema?')) {
    usuarios = usuarios.filter(u => u.id !== id);
    salvarDados('usuarios', usuarios);
    renderizarUsuariosAdm();
  }
}

// ==========================================
// CONFIG E PIX
// ==========================================
function salvarConfig() {
  config.chavePix = document.getElementById('config-chave-pix').value.trim();
  salvarDados('config', config);
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