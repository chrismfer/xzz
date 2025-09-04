// =================================================================================
// VARIÁVEIS GLOBAIS E CONFIGURAÇÕES DE CACHE
// =================================================================================

const PRODUCT_CACHE_KEY = 'skullstore_products_cache';
const PRODUCT_CACHE_VERSION = '1.1'; // Mude esta versão para forçar a invalidação do cache de todos os usuários

let produtos = [];
let produtosComprados = [];
let cacheTimestamp = null;
let loadingInProgress = false;
let downloadStatusCache = {};

// =================================================================================
// LÓGICA DE DETALHES DE PRODUTO
// =================================================================================

function abrirDetalhesProdutoUnificado(code, source = 'loja') {
    let produto = null;
    let isPurchased = source === 'pedido' || source === 'pedidos';

    if (source === 'loja' || source === 'lojas') {
        produto = window.produtos ? window.produtos.find(p => p.code === code) : null;
        
        if (!produto) {
            console.warn(`Produto ${code} não encontrado no array global. Buscando no DOM...`);
            const produtoCard = document.querySelector(`#product-grid .product-card[data-id="${code}"]`);
            if (produtoCard) {
                produto = extrairProdutoDoDOM(produtoCard, code);
            }
        }
    } else {
        const produtoCard = document.querySelector(`#pedidos-list .product-card[data-id="${code}"]`);
        if (produtoCard) {
            produto = extrairProdutoDoDOM(produtoCard, code, true);
            isPurchased = true;
        }
    }

    if (!produto) {
        console.error(`Produto não encontrado em nenhuma fonte: ${code}`);
        mostrarNotificacao('Produto não encontrado. Atualize a página e tente novamente.', 'erro');
        return;
    }

    if (typeof window.openProductDetails === 'function') {
        window.openProductDetails(code, source);
    } else {
        console.error("Função openProductDetails não encontrada em details.js");
        mostrarNotificacao('Erro ao abrir detalhes do produto.', 'erro');
    }
}

function extrairProdutoDoDOM(produtoCard, code, isPurchased = false) {
    if (!produtoCard) return null;

    const titleElement = produtoCard.querySelector('.product-title');
    const versionElement = produtoCard.querySelector('.product-version');
    const imgElement = produtoCard.querySelector('.product-img');
    const purchaseDateElement = produtoCard.querySelector('.purchase-date');
    const pedidoNumberElement = produtoCard.querySelector('.product-pedido-number');

    const produto = {
        code: code,
        nome: titleElement ? titleElement.textContent.trim() : 'Produto',
        versao: versionElement ? versionElement.textContent.trim() : '',
        imagem: imgElement ? imgElement.src : 'assets/placeholder.jpg',
        comprado: isPurchased
    };

    if (isPurchased) {
        produto.data = purchaseDateElement ? purchaseDateElement.textContent.trim() : '';
        const pedidoMatch = pedidoNumberElement ? pedidoNumberElement.textContent.match(/#(.+)/) : null;
        produto.pedido = pedidoMatch ? pedidoMatch[1] : '';
    } else {
        const priceElements = produtoCard.querySelectorAll('.product-price-container span');
        if (priceElements.length > 0) {
            const precoTexto = priceElements[priceElements.length - 1].textContent;
            produto.precoDisplay = precoTexto;
        }
    }

    return produto;
}

// =================================================================================
// AÇÕES DO USUÁRIO NOS CARDS
// =================================================================================

function handleResgatarProduto(code) {
    if (!currentUser) {
        redirectToLogin();
        return;
    }

    const rescueButton = document.querySelector(`.rescue-btn[data-id="${code}"]`);
    const productCard = rescueButton ? rescueButton.closest('.product-card') : null;

    if (!productCard) {
        console.error("Não foi possível encontrar o card do produto para resgate.");
        return;
    }

    mostrarNotificacao('Produto resgatado! Verifique em "Meus Produtos".', 'sucesso');

    productCard.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
    productCard.style.opacity = '0';
    productCard.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        productCard.remove();
    }, 300);

    setTimeout(() => {
        const pedidosTabDesktop = document.querySelector('.header-nav-btn[data-tab="pedidos"]');
        const pedidosTabMobile = document.querySelector('.bottom-nav-item[data-tab="pedidos"]');
        
        if (pedidosTabDesktop && window.getComputedStyle(pedidosTabDesktop).display !== 'none') {
            pedidosTabDesktop.click();
        } else if (pedidosTabMobile) {
            pedidosTabMobile.click();
        }
    }, 400);

    const formData = new FormData();
    formData.append('action', 'resgatarProdutoGratuito');
    formData.append('email', currentUser);
    formData.append('code', code);
    
    fetchAPI(scriptURL, { method: 'POST', body: formData })
        .then(res => {
            if (res.sucesso) {
                console.log(`Resgate do produto ${code} confirmado pelo servidor.`);
            } else {
                console.error("Falha ao confirmar o resgate no servidor:", res.mensagem);
                mostrarNotificacao(res.mensagem || 'Falha ao confirmar o resgate. O produto foi restaurado.', 'erro');
                carregarProdutosDaPlanilha();
            }
        })
        .catch(err => {
            console.error('Erro de rede ao resgatar produto:', err);
            mostrarNotificacao('Erro de conexão ao resgatar. O produto foi restaurado.', 'erro');
            carregarProdutosDaPlanilha();
        });
}

function reattachEventListeners(container) {
    const isPedidos = container.closest('#pedidos-list');
    
    container.querySelectorAll('.details-label').forEach(button => {
        const code = button.getAttribute('data-code');
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', function(e) {
            e.stopPropagation();
            abrirDetalhesProdutoUnificado(code, isPedidos ? 'pedido' : 'loja');
        });
    });

    if (isPedidos) {
        container.querySelectorAll('.download-btn').forEach(button => {
            const code = button.getAttribute('data-code');
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', function(e) {
                e.stopPropagation();
                
                if (downloadStatusCache[code] === 'expired') {
                    console.log(`Cache hit: Download para ${code} já expirado.`);
                    mostrarModalErroDownload('Seu acesso de 24 horas expirou. Apenas membros VIP têm acesso ilimitado aos downloads.');
                    return;
                }
                
                const originalText = this.innerHTML;
                this.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> Verificando...</span>';
                this.disabled = true;

                fetchAPI(`${scriptURL}?action=getDownloadLink&email=${encodeURIComponent(currentUser)}&code=${code}`)
                    .then(res => {
                        if (res.sucesso && res.link) {
                            mostrarNotificacao('Acesso liberado! Abrindo link...', 'sucesso');
                            window.open(res.link, '_blank');
                        } else {
                            downloadStatusCache[code] = 'expired';
                            if (typeof mostrarModalErroDownload === 'function') {
                                mostrarModalErroDownload(res.mensagem || 'Não foi possível obter o link.');
                            } else {
                                mostrarNotificacao(res.mensagem || 'Não foi possível obter o link.', 'erro');
                            }
                        }
                    })
                    .catch(err => {
                        console.error('Erro ao buscar link de download:', err);
                        mostrarNotificacao('Erro de rede. Tente novamente.', 'erro');
                    })
                    .finally(() => {
                        this.innerHTML = originalText;
                        this.disabled = false;
                    });
            });
        });
    } else {
        container.querySelectorAll('.add-to-cart').forEach(button => {
            const code = button.getAttribute('data-id');
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', function(e) {
                e.stopPropagation();
                handleAddToCart(this.getAttribute('data-id'));
            });
        });

        container.querySelectorAll('.rescue-btn').forEach(button => {
            const code = button.getAttribute('data-id');
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', function(e) {
                e.stopPropagation();
                handleResgatarProduto(this.getAttribute('data-id'));
            });
        });

        container.querySelectorAll('.subscribe-vip').forEach(button => {
            const code = button.getAttribute('data-id');
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', function(e) {
                e.stopPropagation();
                if (typeof checkoutDiretoVIP === 'function') {
                    if (!currentUser) {
                        redirectToLogin();
                        return;
                    }
                    checkoutDiretoVIP(this.getAttribute('data-id'), this.id);
                } else {
                    console.error("Função checkoutDiretoVIP não encontrada.");
                    mostrarNotificacao("Erro ao processar assinatura.", "erro");
                }
            });
        });
    }

    container.querySelectorAll('.product-img, .gallery-icon').forEach(element => {
        const card = element.closest('.product-card');
        if(card) {
            const code = card.dataset.id;
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
            newElement.addEventListener('click', function(e) {
                e.stopPropagation();
                if (typeof window.abrirImageViewer === 'function') {
                    window.abrirImageViewer(code);
                } else if (typeof window.abrirGaleriaUnificada === 'function') {
                    window.abrirGaleriaUnificada(code);
                }
            });
        }
    });
}

// =================================================================================
// REGISTRO DE FUNÇÕES GLOBAIS
// =================================================================================

function registrarFuncoesGlobais() {
    window.abrirDetalhesProduto = abrirDetalhesProdutoUnificado;
    window.abrirDetalhesProdutoUnificado = abrirDetalhesProdutoUnificado;
    
    if (!window.openProductDetails && typeof openProductDetails !== 'undefined') {
        window.openProductDetails = openProductDetails;
    }
}

// =================================================================================
// MANIPULAÇÃO DO CARRINHO
// =================================================================================

function handleAddToCart(code) {
    if (!currentUser) {
        redirectToLogin();
        return;
    }

    if (typeof window.adicionarAoCarrinho === 'function') {
        window.adicionarAoCarrinho(code);
    } else {
        console.log('Usando implementação local de adicionarAoCarrinho para:', code);
        
        const produto = produtos.find(p => p.code === code);
        if (!produto) {
            mostrarNotificacao('Produto não encontrado', 'erro');
            return;
        }
        
        if (typeof window.cart === 'undefined') {
            window.cart = [];
            try {
                const savedCart = localStorage.getItem('flash_store_cart');
                if (savedCart) {
                    window.cart = JSON.parse(savedCart);
                }
            } catch(e) {
                console.warn('Erro ao carregar carrinho do localStorage:', e);
            }
        }
        
        const itemExistente = window.cart.find(item => item.code === code);
        if (itemExistente) {
            mostrarNotificacao('Este produto já está no seu carrinho!', 'erro');
            return;
        }
        
        let preco = parseFloat(produto.valorAvulso) || 0;
        const valorAssinante = parseFloat(produto.valorAssinante) || 0;
        const valorPromocao = parseFloat(produto.valorPromocao) || 0;
        const temPromocao = produto.temPromocao && valorPromocao > 0;

        if (isVIP && valorAssinante > 0) {
            preco = valorAssinante;
        } else if (temPromocao) {
            preco = valorPromocao;
        }
        
        window.cart.push({
            code: produto.code,
            nome: produto.nome,
            preco: preco,
            imagem: produto.imagem || 'assets/placeholder.jpg',
            quantidade: 1
        });
        
        try {
            localStorage.setItem('flash_store_cart', JSON.stringify(window.cart));
        } catch(e) {
            console.warn('Erro ao salvar carrinho no localStorage:', e);
        }
        
        atualizarContadorCarrinho();
        
        if (typeof window.atualizarCarrinho === 'function') {
            window.atualizarCarrinho();
        }
        
        atualizarBotoesAddCarrinho(code);
        
        mostrarNotificacao(`${produto.nome} adicionado ao carrinho!`, 'sucesso');
    }
}

function atualizarContadorCarrinho() {
    if (typeof window.cart === 'undefined') return;
    
    const contador = document.querySelector('.tab[data-tab="carrinho"] .cart-count');
    if (!contador) return;

    const quantidade = window.cart.reduce((total, item) => total + (item.quantidade || 1), 0);
    contador.textContent = quantidade;

    if (quantidade > 0) {
        contador.classList.add('has-items');
    } else {
        contador.classList.remove('has-items');
    }
}

function atualizarBotoesAddCarrinho(code) {
    if (typeof window.cart === 'undefined' || !currentUser) return;
    
    const botoes = document.querySelectorAll(`.add-to-cart[data-id="${code}"]`);
    const inCart = window.cart.some(item => item.code === code);
    
    botoes.forEach(botao => {
        if (inCart) {
            botao.classList.add('in-cart');
            botao.innerHTML = '<i class="fas fa-check"></i> No Carrinho';
            botao.disabled = true;
        } else {
            botao.classList.remove('in-cart');
            botao.innerHTML = '<i class="fas fa-cart-plus"></i> Adicionar';
            botao.disabled = false;
        }
    });

    const modalButton = document.querySelector(`#product-detail-content .add-to-cart[data-id="${code}"]`);
    if (modalButton) {
        if (inCart) {
            modalButton.classList.add('in-cart');
            modalButton.innerHTML = '<i class="fas fa-check"></i> No Carrinho';
            modalButton.disabled = true;
            modalButton.replaceWith(modalButton.cloneNode(true));
        } else {
            modalButton.classList.remove('in-cart');
            modalButton.innerHTML = '<i class="fas fa-cart-plus"></i> Adicionar ao Carrinho';
            modalButton.disabled = false;
            const newButton = modalButton.cloneNode(true);
            modalButton.parentNode.replaceChild(newButton, modalButton);
            newButton.addEventListener('click', function() {
                handleAddToCart(this.getAttribute('data-id'));
            });
        }
    }
}

// =================================================================================
// CARREGAMENTO E RENDERIZAÇÃO DE PRODUTOS
// =================================================================================

async function carregarProdutosDaPlanilha() {
    if (loadingInProgress) {
        console.log("Carregamento de produtos já em andamento.");
        return;
    }
    loadingInProgress = true;
    
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) {
        loadingInProgress = false;
        return;
    }
    
    productGrid.innerHTML = '<div class="placeholder-message">Carregando produtos...</div>';

    const emailParam = currentUser ? `&email=${encodeURIComponent(currentUser)}` : '';
    
    try {
        // AQUI ESTÁ A MUDANÇA: Usamos a nova função e o wrapper seguro
        const res = await fetchAPI(`${scriptURL}?action=getInitialStoreData${emailParam}`);

        if (res.sucesso && res.produtos) {
            // A resposta agora contém TUDO que precisamos
            _processarDadosDeProdutos(res); // Processa produtos, VIP, comprados, etc.

            // BÔNUS: Pré-popula o cache de detalhes com os dados recebidos
            res.produtos.forEach(produto => {
                if (!detalhesCache[produto.code]) {
                    detalhesCache[produto.code] = {};
                }
                detalhesCache[produto.code].descricao = produto.descricao;
                detalhesCache[produto.code].imagens = [produto.imagem, ...produto.imagensAdicionais].filter(Boolean);
            });
            console.log("Cache de detalhes pré-populado com sucesso.");

        } else {
            console.error('Erro ao carregar dados da loja:', res.mensagem);
            productGrid.innerHTML = '<div class="placeholder-message">Nenhum produto disponível no momento.</div>';
        }
    } catch (err) {
        console.error('Erro na requisição de dados da loja:', err);
        productGrid.innerHTML = `<div class="placeholder-message erro-placeholder">Erro de conexão. Tente novamente.</div>`;
    } finally {
        loadingInProgress = false;
        registrarFuncoesGlobais();
    }
}

function _processarDadosDeProdutos(dadosAPI) {
    cacheTimestamp = dadosAPI.timestamp || new Date().getTime();
    isVIP = dadosAPI.isVIP || false;
    produtosComprados = dadosAPI.produtosComprados || [];
    
    if(currentUser) {
        sessionStorage.setItem('isVIP', isVIP.toString());
        atualizarBadgeVIP();
    }

    produtos = dadosAPI.produtos || [];
    window.produtos = produtos;
    
    produtos.forEach(produto => {
        const nomeLower = produto.nome.toLowerCase();
        if (nomeLower.includes('windows 10')) produto.categoria = 'win10';
        else if (nomeLower.includes('windows 11')) produto.categoria = 'win11';
        else produto.categoria = 'outros';
    });

    const productGrid = document.getElementById('product-grid');
    if (productGrid) {
       carregarProdutos();
    }
}

function criarProductCard(produto) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    
    if (isVIP) {
        productCard.classList.add('vip-product');
    }
    
    if (produto.code.toString() === '360') {
        productCard.classList.add('vip-subscription-card');
    }

    productCard.dataset.id = produto.code;
    productCard.dataset.categoria = produto.categoria;

    const imagemCapa = produto.imagem || 'assets/placeholder.jpg';
    const qtdImagens = (produto.imagensAdicionais?.length || 0) + (produto.imagem ? 1 : 0);

    let nomeProduto = produto.nome;
    let versaoProduto = produto.versao || '';
    
    const valorAvulsoNum = parseFloat(produto.valorAvulso) || 0;
    const valorPromocaoNum = parseFloat(produto.valorPromocao) || 0;
    const valorAssinanteNum = parseFloat(produto.valorAssinante) || 0;
    const isGratuito = valorAvulsoNum <= 0 && valorPromocaoNum <= 0 && valorAssinanteNum <= 0;
    
    const displayPreco = getPrecoDisplay(produto, isGratuito);
    const isPromocao = produto.temPromocao && parseFloat(produto.valorPromocao) > 0;
    let promocaoBadge = '';

    if (isVIP) {
        promocaoBadge = `<div class="vip-discount-badge"><div class="vip-discount-badge-content"><span class="vip-discount-text">DESCONTO VIP</span></div></div>`;
    } else if (!isVIP && isPromocao) {
        const valorPromocaoNum = parseFloat(produto.valorPromocao);
        let porcentagemDesconto = 0;

        if (valorAvulsoNum > 0 && valorPromocaoNum > 0) {
            porcentagemDesconto = calcularPorcentagemDesconto(valorAvulsoNum, valorPromocaoNum);
        }
        if (porcentagemDesconto > 0) {
            promocaoBadge = `<div class="promocao-badge"><div class="promocao-badge-content"><span class="promocao-text">PROMOÇÃO</span><span class="promocao-percent">-${porcentagemDesconto}%</span></div></div>`;
        } else {
            promocaoBadge = `<div class="promocao-badge"><div class="promocao-badge-content"><span class="promocao-text">PROMOÇÃO</span></div></div>`;
        }
    }

    let botoesHTML = '';
    
    if (currentUser) {
        if (isGratuito) {
            botoesHTML = `
                <button class="details-label" data-code="${produto.code}">
                    <i class="fas fa-info-circle"></i> Detalhes
                </button>
                <button class="rescue-btn" data-id="${produto.code}" id="rescue-btn-${produto.code}">
                    <span><i class="fas fa-gift"></i> Resgatar</span>
                    <div class="spinner"></div>
                </button>
            `;
        } else if (produto.code.toString() === '360') {
            botoesHTML = `
                <button class="details-label" data-code="${produto.code}">
                    <i class="fas fa-info-circle"></i> Detalhes
                </button>
                <button class="subscribe-vip" data-id="${produto.code}" id="subscribe-btn-${produto.code}">
                    <span><i class="fas fa-crown"></i> Assinar</span>
                    <div class="spinner"></div>
                </button>
            `;
        } else {
            botoesHTML = `
                <button class="details-label" data-code="${produto.code}">
                    <i class="fas fa-info-circle"></i> Detalhes
                </button>
                <button class="add-to-cart" data-id="${produto.code}">
                    <i class="fas fa-cart-plus"></i> Adicionar
                </button>
            `;
        }
    } else {
        botoesHTML = `
            <button class="details-label" data-code="${produto.code}">
                <i class="fas fa-info-circle"></i> Detalhes
            </button>
            <button class="add-to-cart" onclick="redirectToLogin()">
                <i class="fas fa-sign-in-alt"></i> Login
            </button>
        `;
    }

    productCard.innerHTML = `
        <div class="product-img-container">
            <img src="${imagemCapa}" alt="${produto.nome}" class="product-img">
            ${promocaoBadge}
            ${qtdImagens > 1 ? `<div class="gallery-icon" title="${qtdImagens} imagens disponíveis"><i class="fas fa-images"></i> Ver galeria</div>` : ''}
        </div>
        <div class="product-info">
            <h3 class="product-title">${nomeProduto}</h3>
            ${versaoProduto ? `<div class="product-version">${versaoProduto}</div>` : ''}
            <div class="product-price-container">
                ${displayPreco}
            </div>
            <div class="product-buttons">
                ${botoesHTML}
            </div>
        </div>
    `;

    return productCard;
}

function calcularPorcentagemDesconto(valorOriginal, valorPromocional) {
    if (!valorOriginal || !valorPromocional || valorOriginal <= 0) return 0;
    const desconto = ((valorOriginal - valorPromocional) / valorOriginal) * 100;
    return Math.round(desconto);
}

function getPrecoDisplay(produto, isGratuito = false) {
    if (!currentUser) {
        if(isGratuito) {
             return '<span class="product-price-highlight">Grátis</span>';
        }
        return '<span class="product-price-login-prompt">Faça login para ver preços</span>';
    }

    const valorAvulso = parseFloat(produto.valorAvulso) || 0;
    const valorPromocao = parseFloat(produto.valorPromocao) || 0;
    const valorAssinante = parseFloat(produto.valorAssinante) || 0;
    const temPromocao = produto.temPromocao || (valorPromocao > 0);
    let htmlPreco = '';

    if (isGratuito) {
        const precoAntigoHTML = valorAvulso > 0 ? `<span class="product-price-old">${formatarMoeda(valorAvulso)}</span>` : '';
        htmlPreco = `${precoAntigoHTML}<span class="product-price-highlight">Grátis</span>`;
    } else if (isVIP && valorAssinante > 0) {
        htmlPreco = `<span class="product-price-old">${formatarMoeda(valorAvulso)}</span><span class="product-price-highlight vip-price">${formatarMoeda(valorAssinante)}</span>`;
    } else if (temPromocao) {
        htmlPreco = `<span class="product-price-old">${formatarMoeda(valorAvulso)}</span><span class="product-price-highlight">${formatarMoeda(valorPromocao)}</span>`;
    } else {
        htmlPreco = `<span class="product-price">${formatarMoeda(valorAvulso)}</span>`;
    }
    return htmlPreco;
}

function carregarProdutos() {
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) return;
    productGrid.innerHTML = '';
    if (produtos.length === 0) {
        productGrid.innerHTML = '<div class="placeholder-message">Nenhum produto disponível no momento.</div>';
        return;
    }
    produtos.forEach(produto => {
        const productCard = criarProductCard(produto);
        productGrid.appendChild(productCard);
    });
    reattachEventListeners(productGrid);
    if (currentUser && typeof window.cart !== 'undefined') {
        window.cart.forEach(item => {
            atualizarBotoesAddCarrinho(item.code);
        });
    }
}

// =================================================================================
// FILTRAGEM E PESQUISA
// =================================================================================

function filtrarProdutos(categoria) {
    const searchInput = document.getElementById('product-search');
    const productGrid = document.getElementById('product-grid');

    if (!searchInput || !productGrid) return;

    if (searchInput.value.trim()) {
        searchInput.value = '';
    }

    productGrid.innerHTML = '';
    let produtosExibidos = 0;

    produtos.forEach(produto => {
        if (categoria === 'todos' || produto.categoria === categoria) {
            const card = criarProductCard(produto);
            productGrid.appendChild(card);
            produtosExibidos++;
        }
    });

    if (produtosExibidos === 0) {
        productGrid.innerHTML = '<div class="placeholder-message">Nenhum produto nesta categoria.</div>';
    } else {
        reattachEventListeners(productGrid);
        if (currentUser && typeof window.cart !== 'undefined') {
            window.cart.forEach(item => {
                atualizarBotoesAddCarrinho(item.code);
            });
        }
    }
}

function pesquisarProdutos() {
    const searchInput = document.getElementById('product-search');
    const productGrid = document.getElementById('product-grid');
    const productFilterSelect = document.getElementById('product-filter');

    if (!searchInput || !productGrid || !productFilterSelect) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        const currentFilter = productFilterSelect.value;
        filtrarProdutos(currentFilter);
        return;
    }

    productGrid.innerHTML = '';

    const produtosFiltrados = produtos.filter(produto =>
        produto.nome.toLowerCase().includes(searchTerm) ||
        (produto.descricao && produto.descricao.toLowerCase().includes(searchTerm))
    );

    if (produtosFiltrados.length === 0) {
        productGrid.innerHTML = '<div class="placeholder-message">Nenhum produto encontrado para sua pesquisa.</div>';
        return;
    }

    produtosFiltrados.forEach(produto => {
        const newCard = criarProductCard(produto);
        productGrid.appendChild(newCard);
    });

    reattachEventListeners(productGrid);
}

// =================================================================================
// CRIAÇÃO DE CARDS DE PRODUTOS COMPRADOS
// =================================================================================

function criarProdutoCompradoCard(produto, dataCompra, numeroPedido) {
    const productCard = document.createElement('div');
    productCard.className = 'product-card purchased-product';
    productCard.dataset.id = produto.code;
    productCard.dataset.categoria = produto.categoria || 'comprado';
    
    if (produto.code.toString() === '360') {
        productCard.classList.add('vip-subscription-card');
    }

    const imagemCapa = produto.imagem || 'assets/placeholder.jpg';
    
    let nomeProduto = produto.nome;
    let versaoProduto = produto.versao || ''; 

    if (produto.code.toString() === '360') {
        if (versaoProduto) {
            nomeProduto = versaoProduto; 
            versaoProduto = ''; 
        }
    } else {
        if (!versaoProduto) {
            const matchVersions = produto.nome.match(/(Windows|Office)\s+(\d+)(\s|\w|\d)+/i);
            if (matchVersions) {
                const indexSeparacao = produto.nome.indexOf(matchVersions[2]) + matchVersions[2].length;
                nomeProduto = produto.nome.substring(0, indexSeparacao).trim();
                versaoProduto = produto.nome.substring(indexSeparacao).trim();
            }
        }
    }

    productCard.innerHTML = `
        <div class="product-img-container">
            <img src="${imagemCapa}" alt="${produto.nome}" class="product-img">
            <div class="purchase-date-badge">
                <div class="purchase-date-content">
                    <span class="purchase-date-text">COMPRADO EM</span>
                    <span class="purchase-date">${dataCompra}</span>
                </div>
            </div>
            <div class="gallery-icon" title="Ver imagem ampliada">
                <i class="fas fa-images"></i> Ver galeria
            </div>
        </div>
        <div class="product-info">
            <h3 class="product-title">${nomeProduto}</h3>
            ${versaoProduto ? `<div class="product-version">${versaoProduto}</div>` : ''}
            <div class="product-price-container">
                <span class="product-pedido-number">Pedido: #${numeroPedido}</span>
            </div>
            <div class="product-buttons">
                <button class="details-label" data-code="${produto.code}">
                    <i class="fas fa-info-circle"></i> Detalhes
                </button>
                <button class="download-btn" data-code="${produto.code}">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
        </div>
    `;

    return productCard;
}

// =================================================================================
// INICIALIZAÇÃO DO MÓDULO
// =================================================================================

document.addEventListener('DOMContentLoaded', function() {
    const carrinhoTab = document.querySelector('.tab[data-tab="carrinho"]');
    
    if (carrinhoTab) {
        carrinhoTab.addEventListener('click', function() {
            if (typeof window.atualizarCarrinho === 'function') {
                setTimeout(() => {
                    if(currentUser) {
                        window.atualizarCarrinho();
                    }
                }, 100);
            }
        });
    }

    registrarFuncoesGlobais();
    
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('test')) {
        window.debugProdutos = debugProdutos;
    }
});

window.handleAddToCart = handleAddToCart;
window.atualizarBotoesAddCarrinho = atualizarBotoesAddCarrinho;
window.abrirDetalhesProduto = abrirDetalhesProdutoUnificado;