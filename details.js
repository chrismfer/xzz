// =================================================================================
// FORMATAÇÃO E CACHE
// =================================================================================

function formatarMoedaSegura(valor) {
    const numero = Number(valor) || 0;
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const detalhesCache = {};
const produtosJaCarregados = new Set();
let carregandoTodosOsProdutos = false;

// =================================================================================
// FUNCIONALIDADE PRINCIPAL DE DETALHES
// =================================================================================

function openProductDetails(code, source = 'loja') {
    let produto;
    let isPurchased = source === 'pedido' || source === 'pedidos';

    if (source === 'loja' || source === 'lojas') {
        produto = window.produtos ? window.produtos.find(p => p.code === code) : null;
        
        if (!produto && typeof produtos !== 'undefined') {
            produto = produtos.find(p => p.code === code);
        }
        
        if (!produto) {
            console.warn(`Produto ${code} não encontrado nos arrays. Tentando extrair do DOM...`);
            const produtoCard = document.querySelector(`#product-grid .product-card[data-id="${code}"]`);
            if (produtoCard) {
                produto = extrairProdutoDoCard(produtoCard, code, false);
                console.log('Produto extraído do DOM:', produto);
            }
        }
    } else {
        isPurchased = true;
        const produtoCard = document.querySelector(`#pedidos-list .product-card[data-id="${code}"]`);
        if (produtoCard) {
            produto = extrairProdutoDoCard(produtoCard, code, true);
        }
    }

    if (!produto) {
        console.error(`❌ Produto ${code} não encontrado em nenhuma fonte disponível`);
        mostrarNotificacao('Produto não encontrado. Atualizando dados...', 'erro');
        
        if (typeof carregarProdutosDaPlanilha === 'function') {
            carregarProdutosDaPlanilha();
        }
        return;
    }

    abrirModalDetalhes(produto, isPurchased, code);
}

function extrairProdutoDoCard(produtoCard, code, isPurchased = false) {
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
        const priceContainer = produtoCard.querySelector('.product-price-container');
        if (priceContainer) {
            const priceElements = priceContainer.querySelectorAll('span');
            if (priceElements.length > 0) {
                produto.precoDisplay = priceElements[priceElements.length - 1].textContent;
            }
        }
        
        if (produtoCard.dataset.valorAvulso) produto.valorAvulso = produtoCard.dataset.valorAvulso;
        if (produtoCard.dataset.valorPromocao) produto.valorPromocao = produtoCard.dataset.valorPromocao;
        if (produtoCard.dataset.valorAssinante) produto.valorAssinante = produtoCard.dataset.valorAssinante;
    }

    return produto;
}

function abrirModalDetalhes(produto, isPurchased, code) {
    const modal = document.getElementById('product-detail-modal');
    const modalTitle = document.getElementById('product-detail-title');
    const modalDescription = document.getElementById('product-detail-description');
    const originalPrice = document.getElementById('product-detail-original-price');
    const currentPrice = document.getElementById('product-detail-current-price');
    const metadata = document.getElementById('product-metadata');
    const addToCartBtn = document.getElementById('add-to-cart-detail');
    const productImage = document.getElementById('product-detail-image');
    const productBackground = document.getElementById('product-detail-background');
    
    if (!modal || !modalTitle || !modalDescription || !addToCartBtn || !productImage || !productBackground) {
        console.error("Elementos do modal de detalhes não encontrados");
        mostrarNotificacao('Erro ao abrir detalhes do produto.', 'erro');
        return;
    }

    modalTitle.textContent = produto.nome;
    
    const imageSrc = produto.imagem || 'assets/placeholder.jpg';
    productImage.src = imageSrc;
    productImage.alt = produto.nome;
    productBackground.src = imageSrc;
    
    if (!produtosJaCarregados.has(code)) {
        produtosJaCarregados.add(code);
        carregarImagensProduto(code, imageSrc, () => {});
    }
    
    if (isPurchased) {
        originalPrice.style.display = 'none';
        currentPrice.textContent = 'Produto adquirido';
    } else {
        setupProductPricing(produto, originalPrice, currentPrice);
    }
    
    let descricaoInicial = detalhesCache[code]?.descricao || 'Carregando detalhes...';
    formatProductDescription(descricaoInicial, modalDescription);
    
    if (!detalhesCache[code]?.descricao) {
        carregarDetalheProduto(code, (descricao) => {
            formatProductDescription(descricao, modalDescription);
        });
    }
    
    setupProductMetadata(produto, metadata, isPurchased);
    
    if (isPurchased) {
        addToCartBtn.style.display = 'none';
    } else {
        addToCartBtn.style.display = 'flex';
        const itemInCart = window.cart ? window.cart.find(item => item.code === code) : null;
        setupAddToCartButton(produto, addToCartBtn, itemInCart);
    }

    modal.style.display = 'flex';
    document.body.classList.add('no-scroll');
    
    setTimeout(() => document.getElementById('modal-close-btn')?.focus(), 100);
}

// =================================================================================
// CARREGAMENTO DE DADOS DO PRODUTO
// =================================================================================

// MODIFICAÇÃO: A função agora é 'async' e usa 'fetchAPI'.
async function carregarImagensProduto(code, imagemPrincipal, callback) {
    if (detalhesCache[code] && detalhesCache[code].imagens && detalhesCache[code].imagens.length > 0) {
        callback(detalhesCache[code].imagens);
        return;
    }
    
    const imagens = imagemPrincipal ? [imagemPrincipal] : [];
    
    try {
        // CORREÇÃO: Utiliza o wrapper seguro fetchAPI.
        const res = await fetchAPI(`${scriptURL}?action=getProdutoImagens&code=${encodeURIComponent(code)}`);

        if (res.sucesso && res.imagens && res.imagens.length > 0) {
            res.imagens.forEach(img => {
                if (!imagens.includes(img)) {
                    imagens.push(img);
                }
            });
            
            if (!detalhesCache[code]) {
                detalhesCache[code] = {};
            }
            detalhesCache[code].imagens = imagens;
            
            preCarregarImagensArray(imagens, true);
        }
    } catch (err) {
        console.error('Erro ao buscar imagens adicionais:', err);
    } finally {
        callback(imagens);
    }
}

// MODIFICAÇÃO: A função agora é 'async' e usa 'fetchAPI'.
async function carregarDetalheProduto(code, callback) {
    if (detalhesCache[code] && detalhesCache[code].descricao) {
        callback(detalhesCache[code].descricao);
        return;
    }
    
    try {
        // CORREÇÃO: Utiliza o wrapper seguro fetchAPI.
        const res = await fetchAPI(`${scriptURL}?action=getDescricaoProduto&code=${encodeURIComponent(code)}`);

        if (res.sucesso && res.descricao) {
            if (!detalhesCache[code]) {
                detalhesCache[code] = {};
            }
            detalhesCache[code].descricao = res.descricao;
            callback(res.descricao);
        } else {
            callback('Descrição não disponível.');
        }
    } catch (err) {
        console.error('Erro ao buscar descrição do produto:', err);
        callback('Erro ao carregar descrição. Tente novamente.');
    }
}

function preCarregarImagensArray(imagens, altaPrioridade = false) {
    if (window.preCarregarImagens && typeof window.preCarregarImagens === 'function') {
        window.preCarregarImagens(imagens);
        return;
    }
    
    const preloadDiv = document.getElementById('preload-container') || document.createElement('div');
    if (!preloadDiv.id) {
        preloadDiv.id = 'preload-container';
        preloadDiv.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;';
        document.body.appendChild(preloadDiv);
    }
    
    imagens.forEach(url => {
        if (!url) return;
        const img = new Image();
        if (altaPrioridade) {
            img.fetchPriority = "high";
        }
        img.onload = img.onerror = () => {
            if (window.addImageToCache) window.addImageToCache(url, true);
            img.remove();
        };
        img.src = url;
        preloadDiv.appendChild(img);
    });
}

// =================================================================================
// GALERIA DE IMAGENS
// =================================================================================

function abrirGaleriaUnificada(code, imageIndex = 0) {
    window.currentImageIndex = 0;
    
    const imageViewerModal = document.getElementById('image-viewer-modal');
    const mainImage = document.getElementById('viewer-main-image');
    const thumbnailsContainer = document.getElementById('image-thumbnails');
    const imageCounter = document.getElementById('image-counter');
    const prevButton = document.querySelector('.prev-image');
    const nextButton = document.querySelector('.next-image');

    if (!imageViewerModal || !mainImage || !thumbnailsContainer || !imageCounter || !prevButton || !nextButton) {
        console.error("Elementos do visualizador de imagens não encontrados.");
        return;
    }
    
    let imagemPrincipal = null;
    let imagensIniciais = [];
    let nomeDoProduct = "Produto";
    
    if (detalhesCache[code] && detalhesCache[code].imagens && detalhesCache[code].imagens.length > 0) {
        imagensIniciais = detalhesCache[code].imagens;
        imagemPrincipal = imagensIniciais[0];
    } else {
        let produtoElement = document.querySelector(`#product-grid .product-card[data-id="${code}"]`);
        if (!produtoElement) {
            produtoElement = document.querySelector(`#pedidos-list .product-card[data-id="${code}"]`);
        }
        
        if (produtoElement) {
            const imgElement = produtoElement.querySelector('.product-img');
            const nameElement = produtoElement.querySelector('.product-title');
            if (imgElement && imgElement.src) {
                imagemPrincipal = imgElement.src;
                imagensIniciais.push(imagemPrincipal);
            }
            if (nameElement) {
                nomeDoProduct = nameElement.textContent;
            }
        }
    }
    
    if (!imagemPrincipal) {
        imagemPrincipal = 'assets/placeholder.jpg';
        imagensIniciais = [imagemPrincipal];
    }
    
    imageViewerModal.style.display = 'block';
    document.body.classList.add('no-scroll');
    
    mainImage.src = imagemPrincipal;
    mainImage.alt = nomeDoProduct;
    
    window.currentImageIndex = imageIndex >= 0 && imageIndex < imagensIniciais.length ? imageIndex : 0;
    imageCounter.textContent = `${window.currentImageIndex + 1} / ${imagensIniciais.length}`;
    
    prevButton.style.display = imagensIniciais.length > 1 ? 'flex' : 'none';
    nextButton.style.display = imagensIniciais.length > 1 ? 'flex' : 'none';
    
    window.currentProductImages = imagensIniciais;
    
    thumbnailsContainer.innerHTML = '';
    const thumbnailsWrapper = document.createElement('div');
    thumbnailsWrapper.className = 'thumbnails-center-wrapper';
    thumbnailsContainer.appendChild(thumbnailsWrapper);
    
    imagensIniciais.forEach((img, idx) => {
        const thumbnail = document.createElement('img');
        thumbnail.src = img;
        thumbnail.alt = `Miniatura ${idx + 1}`;
        thumbnail.className = `image-thumbnail ${idx === window.currentImageIndex ? 'active' : ''}`;
        thumbnail.dataset.index = idx;
        thumbnail.onclick = function() {
            window.currentImageIndex = parseInt(this.dataset.index);
            atualizarImageViewer();
        };
        thumbnailsWrapper.appendChild(thumbnail);
    });
    
    setTimeout(() => {
        const activeThumb = thumbnailsWrapper.querySelector('.image-thumbnail.active');
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        }
    }, 50);
    
    carregarImagensProduto(code, imagemPrincipal, (imagensCompletas) => {
        if (imagensCompletas.length === imagensIniciais.length) return;
        
        window.currentProductImages = imagensCompletas;
        if (window.currentImageIndex >= imagensCompletas.length) window.currentImageIndex = 0;
        
        imageCounter.textContent = `${window.currentImageIndex + 1} / ${imagensCompletas.length}`;
        prevButton.style.display = imagensCompletas.length > 1 ? 'flex' : 'none';
        nextButton.style.display = imagensCompletas.length > 1 ? 'flex' : 'none';
        
        for (let i = imagensIniciais.length; i < imagensCompletas.length; i++) {
            const thumbnail = document.createElement('img');
            thumbnail.src = imagensCompletas[i];
            thumbnail.alt = `Miniatura ${i + 1}`;
            thumbnail.className = 'image-thumbnail';
            thumbnail.dataset.index = i;
            thumbnail.onclick = function() {
                window.currentImageIndex = parseInt(this.dataset.index);
                atualizarImageViewer();
            };
            thumbnailsWrapper.appendChild(thumbnail);
        }
    });
}

function atualizarImageViewer(direcao = null) {
    const mainImage = document.getElementById('viewer-main-image');
    const imageCounter = document.getElementById('image-counter');
    const thumbnailsWrapper = document.querySelector('.thumbnails-center-wrapper');

    if (!mainImage || !imageCounter || !thumbnailsWrapper) return;

    mainImage.className = direcao === 'next' ? 'slide-left' : direcao === 'prev' ? 'slide-right' : '';

    setTimeout(() => {
        if (window.currentProductImages && window.currentProductImages.length > window.currentImageIndex && window.currentImageIndex >= 0) {
            mainImage.src = window.currentProductImages[window.currentImageIndex];
        }
        if (window.currentProductImages) {
            imageCounter.textContent = `${window.currentImageIndex + 1} / ${window.currentProductImages.length}`;
        }
        
        thumbnailsWrapper.querySelectorAll('.image-thumbnail').forEach(thumb => {
            thumb.classList.toggle('active', parseInt(thumb.dataset.index) === window.currentImageIndex);
            if (thumb.classList.contains('active')) {
                thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        });
    }, direcao ? 100 : 0);
}

function navegarImagens(direcao) {
    if (!window.currentProductImages || window.currentProductImages.length <= 1) return;
    let novoIndice = (window.currentImageIndex + direcao + window.currentProductImages.length) % window.currentProductImages.length;
    window.currentImageIndex = novoIndice;
    atualizarImageViewer(direcao > 0 ? 'next' : 'prev');
}

function closeImageViewer() {
    const imageViewerModal = document.getElementById('image-viewer-modal');
    if (imageViewerModal) imageViewerModal.style.display = 'none';
    document.body.classList.remove('no-scroll');
    window.currentImageIndex = 0;
}

// =================================================================================
// MANIPULADORES DE EVENTOS
// =================================================================================

function handleKeyNavigation(e) {
    const imageViewerModal = document.getElementById('image-viewer-modal');
    if (imageViewerModal && imageViewerModal.style.display === 'block') {
        e.preventDefault();
        if (window.keyNavigationInProgress) return;
        window.keyNavigationInProgress = true;
        
        switch(e.key) {
            case 'ArrowLeft': navegarImagens(-1); break;
            case 'ArrowRight': navegarImagens(1); break;
            case 'Escape': closeImageViewer(); break;
        }
        
        setTimeout(() => { window.keyNavigationInProgress = false; }, 100);
    }
}

function setupTouchListeners() {
    const container = document.querySelector('.image-viewer-container');
    if (!container) return;

    let startX = 0, isDragging = false;
    
    container.addEventListener('touchstart', e => {
        isDragging = true;
        startX = e.touches[0].clientX;
    });

    container.addEventListener('touchend', e => {
        if (!isDragging) return;
        const endX = e.changedTouches[0].clientX;
        const diffX = endX - startX;
        if (Math.abs(diffX) > 50) {
            navegarImagens(diffX > 0 ? -1 : 1);
        }
        isDragging = false;
    });
}

// =================================================================================
// FUNÇÕES DE CONFIGURAÇÃO DA UI DO MODAL
// =================================================================================

function setupProductPricing(produto, originalPriceEl, currentPriceEl) {
    const valorAvulso = parseFloat(produto.valorAvulso) || 0;
    const valorPromocao = parseFloat(produto.valorPromocao) || 0;
    const valorAssinante = parseFloat(produto.valorAssinante) || 0;
    const temPromocao = produto.temPromocao && valorPromocao > 0;
    const isVIP = window.isVIP !== undefined ? window.isVIP : false;

    originalPriceEl.style.display = 'none';
    currentPriceEl.classList.remove('vip-price');

    if (isVIP && valorAssinante > 0) {
        originalPriceEl.textContent = formatarMoedaSegura(valorAvulso);
        originalPriceEl.style.display = 'inline';
        currentPriceEl.textContent = formatarMoedaSegura(valorAssinante);
        currentPriceEl.classList.add('vip-price'); 
    } else if (temPromocao) {
        originalPriceEl.textContent = formatarMoedaSegura(valorAvulso);
        originalPriceEl.style.display = 'inline';
        currentPriceEl.textContent = formatarMoedaSegura(valorPromocao);
    } else {
        if (produto.precoDisplay) {
            currentPriceEl.textContent = produto.precoDisplay;
        } else {
            currentPriceEl.textContent = formatarMoedaSegura(valorAvulso);
        }
    }
}

function formatProductDescription(description, descriptionContainer) {
    if (!description || description.startsWith('Carregando')) {
        descriptionContainer.innerHTML = `<p>${description}</p>`;
        return;
    }
    
    const formattedContainer = document.createElement('div');
    formattedContainer.className = 'formatted-description';
    let formattedText = description.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/==(.+?)==/g, '<span class="highlight">$1</span>')
        .replace(/^(#{1,3}) (.+)$/gm, (match, hashes, content) => `<h${hashes.length + 2}>${content}</h${hashes.length + 2}>`)
        .replace(/^[*-] (.+)$/gm, '<li>$1</li>');

    formattedText = formattedText.replace(/(<li>.+?<\/li>)+/gs, '<ul>$&</ul>');
    formattedContainer.innerHTML = formattedText.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    
    descriptionContainer.innerHTML = '';
    descriptionContainer.appendChild(formattedContainer);
}

function setupProductMetadata(produto, metadataContainer, isPurchased) {
    metadataContainer.innerHTML = '';
    
    if (isPurchased) {
        if (produto.data) metadataContainer.innerHTML += `<div class="metadata-item"><i class="fas fa-calendar-check"></i> Comprado em: ${produto.data}</div>`;
        if (produto.pedido) metadataContainer.innerHTML += `<div class="metadata-item"><i class="fas fa-receipt"></i> Pedido: #${produto.pedido}</div>`;
    } else {
        if (produto.data) metadataContainer.innerHTML += `<div class="metadata-item"><i class="fas fa-calendar-alt"></i> Data: ${produto.data}</div>`;
        if (produto.versao) metadataContainer.innerHTML += `<div class="metadata-item"><i class="fas fa-code-branch"></i> Versão: ${produto.versao}</div>`;
        if (produto.tempo) metadataContainer.innerHTML += `<div class="metadata-item"><i class="fas fa-clock"></i> Duração: ${produto.tempo}</div>`;
    }
    
    if (metadataContainer.children.length === 0) {
        metadataContainer.innerHTML = `<div class="metadata-item"><i class="fas fa-info-circle"></i> ${isPurchased ? 'Produto adquirido' : 'Produto disponível'}</div>`;
    }
}

function setupAddToCartButton(produto, button, itemInCart) {
    const isVipProduct = produto.code.toString() === '360';
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    if (isVipProduct) {
        newButton.innerHTML = '<span><i class="fas fa-crown"></i> Assinar Agora</span><div class="spinner"></div>';
        newButton.classList.remove('in-cart');
        newButton.disabled = false;
        newButton.onclick = function() {
            if (typeof window.checkoutDiretoVIP === 'function') {
                window.checkoutDiretoVIP(produto.code, newButton.id);
            }
        };
    } else {
        if (itemInCart) {
            newButton.innerHTML = '<i class="fas fa-check"></i> No Carrinho';
            newButton.classList.add('in-cart');
            newButton.disabled = true;
        } else {
            newButton.innerHTML = '<i class="fas fa-cart-plus"></i> Adicionar ao Carrinho';
            newButton.classList.remove('in-cart');
            newButton.disabled = false;
            newButton.onclick = function() {
                if (typeof window.adicionarAoCarrinho === 'function') {
                    window.adicionarAoCarrinho(produto.code);
                    closeProductDetails();
                } else if (typeof window.handleAddToCart === 'function') {
                    window.handleAddToCart(produto.code);
                    closeProductDetails();
                }
            };
        }
    }
}

function closeProductDetails() {
    const modal = document.getElementById('product-detail-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('no-scroll');
}

// =================================================================================
// PRÉ-CARREGAMENTO ESTRATÉGICO
// =================================================================================

// MODIFICAÇÃO: A função agora é 'async' e usa 'fetchAPI'.
async function carregarTodosOsProdutos(callback) {
    if (carregandoTodosOsProdutos) {
        if (callback) setTimeout(callback, 100);
        return;
    }
    
    carregandoTodosOsProdutos = true;
    console.log('Iniciando carregamento completo de todos os produtos...');
    
    const codigosProdutos = Array.from(document.querySelectorAll('.product-card[data-id]')).map(card => card.dataset.id);
    const codigosUnicos = [...new Set(codigosProdutos)];
    
    if (codigosUnicos.length === 0) {
        console.log('Nenhum produto encontrado para carregar.');
        carregandoTodosOsProdutos = false;
        if (callback) callback();
        return;
    }
    
    console.log(`Carregando dados completos para ${codigosUnicos.length} produtos...`);
    
    const codigosString = codigosUnicos.join(',');

    try {
        // CORREÇÃO: Utiliza o wrapper seguro fetchAPI.
        const res = await fetchAPI(`${scriptURL}?action=getTodosProdutos&codes=${encodeURIComponent(codigosString)}`);

        if (res.sucesso) {
            console.log(`Recebidos dados para ${res.produtos.length} produtos.`);
            
            res.produtos.forEach(produto => {
                if (!produto || !produto.code) return;
                
                if (!detalhesCache[produto.code]) {
                    detalhesCache[produto.code] = {};
                }
                
                if (produto.descricao) {
                    detalhesCache[produto.code].descricao = produto.descricao;
                }
                
                if (produto.imagens && Array.isArray(produto.imagens) && produto.imagens.length > 0) {
                    detalhesCache[produto.code].imagens = produto.imagens;
                    preCarregarImagensArray(produto.imagens, false);
                }
                
                produtosJaCarregados.add(produto.code);
            });
            
            console.log('Dados de todos os produtos armazenados em cache.');
        } else {
            console.warn('Erro ao carregar dados completos dos produtos:', res.mensagem);
            carregarProdutosVisiveis();
        }
    } catch (err) {
        console.error('Erro ao carregar todos os produtos:', err);
        carregarProdutosVisiveis();
    } finally {
        carregandoTodosOsProdutos = false;
        if (callback) callback();
    }
}

function carregarProdutosVisiveis() {
    console.log('Carregando produtos visíveis...');
    
    const cards = Array.from(document.querySelectorAll('.product-card'));
    
    const isVisivel = (element) => {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= -rect.height && 
            rect.left >= -rect.width && 
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + rect.height &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth) + rect.width
        );
    };
    
    const cardsVisiveis = cards.filter(isVisivel);
    
    cardsVisiveis.forEach(card => {
        const code = card.dataset.id;
        const img = card.querySelector('.product-img')?.src;
        
        if (code && !produtosJaCarregados.has(code) && img) {
            produtosJaCarregados.add(code);
            carregarImagensProduto(code, img, () => {});
            carregarDetalheProduto(code, () => {});
        }
    });
}

// =================================================================================
// INICIALIZAÇÃO DO MÓDULO
// =================================================================================

function inicializarPreCarregamento() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                if (card.dataset.id && !produtosJaCarregados.has(card.dataset.id)) {
                    const code = card.dataset.id;
                    const img = card.querySelector('.product-img')?.src;
                    if (img) {
                        produtosJaCarregados.add(code);
                        setTimeout(() => {
                            carregarImagensProduto(code, img, () => {});
                            carregarDetalheProduto(code, () => {});
                        }, 100);
                    }
                }
                observer.unobserve(card);
            }
        });
    }, { root: null, rootMargin: '100px', threshold: 0.1 });
    
    document.querySelectorAll('.product-card').forEach(card => observer.observe(card));
    
    const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches('.product-card')) {
                        observer.observe(node);
                    } else if (node.nodeType === 1) {
                        node.querySelectorAll('.product-card').forEach(card => observer.observe(card));
                    }
                });
            }
        });
    });
    
    document.querySelectorAll('.tab-content').forEach(tabContent => {
        mutationObserver.observe(tabContent, { childList: true, subtree: true });
    });
}

function carregarDadosCompletos() {
    setTimeout(() => {
        carregarTodosOsProdutos(() => console.log('Carregamento completo finalizado'));
        setInterval(() => {
            if (!carregandoTodosOsProdutos) carregarProdutosVisiveis();
        }, 5000);
    }, 1000);
}

function initializeProductDetails() {
    document.getElementById('modal-close-btn')?.addEventListener('click', closeProductDetails);
    
    const modal = document.getElementById('product-detail-modal');
    if (modal) {
        modal.addEventListener('click', e => { if (e.target === modal) closeProductDetails(); });
    }
    
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (modal?.style.display === 'flex') closeProductDetails();
            const imageViewer = document.getElementById('image-viewer-modal');
            if (imageViewer?.style.display === 'block') closeImageViewer();
        }
    });
    
    document.querySelector('.close-image-viewer')?.addEventListener('click', closeImageViewer);
    document.querySelector('.prev-image')?.addEventListener('click', () => navegarImagens(-1));
    document.querySelector('.next-image')?.addEventListener('click', () => navegarImagens(1));
    
    document.addEventListener('keydown', handleKeyNavigation);
    setupTouchListeners();
    inicializarPreCarregamento();
    carregarDadosCompletos();
    
    window.openProductDetails = openProductDetails;
    window.abrirDetalhesProduto = openProductDetails;
    window.abrirGaleriaUnificada = abrirGaleriaUnificada;
    window.abrirImageViewer = abrirGaleriaUnificada;
    window.navegarImagens = navegarImagens;
    window.closeImageViewer = closeImageViewer;
    window.atualizarImageViewer = atualizarImageViewer;
}

document.addEventListener('DOMContentLoaded', function() {
    initializeProductDetails();
    
    document.body.addEventListener('click', function(e) {
        const card = e.target.closest('.product-card');
        if (card && card.dataset.id && !produtosJaCarregados.has(card.dataset.id)) {
            const code = card.dataset.id;
            const img = card.querySelector('.product-img')?.src;
            if (img) {
                produtosJaCarregados.add(code);
                carregarImagensProduto(code, img, () => {});
                carregarDetalheProduto(code, () => {});
            }
        }
    });
});