// =================================================================================
// VARIÁVEIS GLOBAIS E CACHE LOCAL
// =================================================================================

let pedidosLocaisCache = [];
let isSyncing = false;

// =================================================================================
// FUNÇÕES DE RENDERIZAÇÃO DA UI
// =================================================================================

function _renderizarListaDePedidos(itensParaExibir) {
    const pedidosList = document.getElementById('pedidos-list');
    if (!pedidosList) return;

    pedidosList.innerHTML = '';
    pedidosList.className = 'product-grid';

    if (!itensParaExibir || itensParaExibir.length === 0) {
        pedidosList.innerHTML = '<div class="placeholder-message">Você ainda não realizou nenhuma compra.</div>';
        return;
    }

    itensParaExibir.forEach(item => {
        let dataFormatada = 'Data indisponível';
        try {
            const data = new Date(item.dataCompra);
            if (!isNaN(data.getTime())) {
                dataFormatada = `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
            }
        } catch (dateError) {
            console.error("Erro ao formatar data do item:", dateError);
        }
        
        const productCard = criarProdutoCompradoCard(item, dataFormatada, item.numeroPedido);
        if (productCard) {
            pedidosList.appendChild(productCard);
        }
    });
    
    reattachEventListeners(pedidosList);
}

// =================================================================================
// LÓGICA PRINCIPAL DE CARREGAMENTO E SINCRONIZAÇÃO
// =================================================================================

async function carregarPedidos() {
    const pedidosList = document.getElementById('pedidos-list');
    if (!pedidosList || isSyncing) {
        if (isSyncing) console.log("Sincronização já em andamento, ignorando nova chamada.");
        return;
    }

    isSyncing = true;
    const syncIndicator = document.getElementById('sync-status-indicator');

    try {
        if (pedidosLocaisCache.length === 0) {
            pedidosList.innerHTML = '<div class="placeholder-message">Sincronizando seus produtos...</div>';
        }
        if (syncIndicator) syncIndicator.classList.add('show');

        await sincronizarStatusDoBackend();

        // OTIMIZAÇÃO: Esta única chamada agora traz TODOS os dados necessários.
        const res = await fetchAPI(`${scriptURL}?action=listarPedidos&email=${encodeURIComponent(currentUser)}`);

        if (!res.sucesso) {
            throw new Error(res.mensagem || 'Erro ao buscar produtos comprados.');
        }

        const todosOsItensNovos = _processarPedidosDaAPI(res.pedidos);

        const cacheAtualString = JSON.stringify(pedidosLocaisCache.map(p => p.code + p.numeroPedido).sort());
        const novosItensString = JSON.stringify(todosOsItensNovos.map(p => p.code + p.numeroPedido).sort());

        if (cacheAtualString !== novosItensString) {
            console.log("Alterações detectadas. Atualizando a lista de produtos comprados.");
            pedidosLocaisCache = todosOsItensNovos;
            _renderizarListaDePedidos(pedidosLocaisCache);
        } else {
            console.log("Nenhuma alteração nos produtos. A UI permanece a mesma.");
            if (pedidosList.querySelector('.placeholder-message')) {
                 _renderizarListaDePedidos(pedidosLocaisCache);
            }
        }

    } catch (err) {
        console.error('Erro ao carregar pedidos:', err);
        mostrarNotificacao('Falha ao carregar seus produtos. Tente novamente.', 'erro');
        pedidosList.innerHTML = '<div class="placeholder-message erro-placeholder">Não foi possível carregar seus produtos.</div>';
    } finally {
        if (syncIndicator) syncIndicator.classList.remove('show');
        isSyncing = false;
    }
}

/**
 * Processa a resposta da API, transformando a lista de pedidos em uma lista plana de itens
 * e pré-populando o cache de detalhes para evitar chamadas futuras.
 */
function _processarPedidosDaAPI(pedidosAPI) {
    if (!pedidosAPI || pedidosAPI.length === 0) {
        return [];
    }
    
    let todosOsItens = [];
    pedidosAPI.forEach(pedido => {
        try {
            const itens = typeof pedido.itens === 'string' ? JSON.parse(pedido.itens) : pedido.itens;
            if (!itens) return;
            
            itens.forEach(item => {
                if (item && item.nome) {
                    const itemCompleto = { ...item, dataCompra: pedido.data, numeroPedido: pedido.numero };
                    todosOsItens.push(itemCompleto);

                    // PONTO CHAVE: Pré-popula o cache global de detalhes com os dados recebidos.
                    // Isso evita que details.js precise fazer novas chamadas à API.
                    if (item.code) {
                        if (!detalhesCache[item.code]) {
                            detalhesCache[item.code] = {};
                        }
                        detalhesCache[item.code].descricao = item.descricao || 'Descrição não disponível.';
                        
                        const allImages = [item.imagem, ...(item.imagensAdicionais || [])].filter(Boolean);
                        detalhesCache[item.code].imagens = allImages;
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao processar um pedido específico:', error, pedido);
        }
    });

    console.log("Cache de detalhes populado com dados de 'Meus Produtos'.");

    const itemVip = todosOsItens.find(item => item.code.toString() === '360');
    const outrosItens = todosOsItens.filter(item => item.code.toString() !== '360');
    outrosItens.sort((a, b) => new Date(b.dataCompra || 0) - new Date(a.dataCompra || 0));
    
    const itensOrdenados = [];
    if (itemVip) itensOrdenados.push(itemVip);
    itensOrdenados.push(...outrosItens);

    return itensOrdenados;
}


// =================================================================================
// FUNÇÃO DE SINCRONIZAÇÃO DE ESTADO DO USUÁRIO
// =================================================================================

function sincronizarStatusDoBackend() {
    return new Promise(async (resolve, reject) => {
        const currentUser = sessionStorage.getItem('currentUser');
        if (!currentUser) {
            return reject('Usuário não logado.');
        }

        try {
            const res = await fetchAPI(`${scriptURL}?action=sincronizarStatusUsuario&email=${encodeURIComponent(currentUser)}`);
            
            if (res.sucesso) {
                const eraVIP = sessionStorage.getItem('isVIP') === 'true';
                if (res.isVIP !== eraVIP) {
                    console.log("Status VIP alterado! Atualizando estado global.");
                    sessionStorage.setItem('isVIP', res.isVIP.toString());
                    if (typeof updateUserInterface === 'function') updateUserInterface();
                    if (typeof carregarProdutosDaPlanilha === 'function') carregarProdutosDaPlanilha();
                }
                resolve();
            } else {
                console.error("Falha na sincronização:", res.mensagem);
                reject(res.mensagem);
            }
        } catch (err) {
            console.error('Erro de rede ao sincronizar status:', err);
            reject(err);
        }
    });
}