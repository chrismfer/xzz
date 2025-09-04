// =================================================================================
// VARIÁVEIS GLOBAIS
// =================================================================================

let cart = [];
let verificacaoStatusInterval = null;
let activeCheckoutButtonId = null;

// =================================================================================
// FUNÇÕES AUXILIARES
// =================================================================================

function _appendMobileMenuFooter(container) {
    const mobileMenuFooter = document.querySelector('.mobile-menu-footer');
    if (mobileMenuFooter && container) {
        const clonedFooter = mobileMenuFooter.cloneNode(true);
        clonedFooter.className = 'cart-injected-footer';
        container.appendChild(clonedFooter);
    }
}

function copyPixKey() {
    const pixKeyInput = document.getElementById('pix-key-input');
    const copyBtn = document.getElementById('copy-pix-btn');
    if (!pixKeyInput || !copyBtn) return;

    pixKeyInput.select();
    pixKeyInput.setSelectionRange(0, 99999);

    try {
        navigator.clipboard.writeText(pixKeyInput.value).then(() => {
            const originalContent = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            copyBtn.classList.add('copied');
            
            setTimeout(() => {
                copyBtn.innerHTML = originalContent;
                copyBtn.classList.remove('copied');
            }, 2500);
        });
    } catch (err) {
        console.error('Falha ao copiar a chave PIX:', err);
        try {
            document.execCommand('copy');
            const originalContent = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            copyBtn.classList.add('copied');
            
            setTimeout(() => {
                copyBtn.innerHTML = originalContent;
                copyBtn.classList.remove('copied');
            }, 2500);
        } catch (execErr) {
            alert('Não foi possível copiar o código. Por favor, copie manualmente.');
        }
    }
}

// ==========================================
// OPERAÇÕES DO CARRINHO
// ==========================================

function adicionarAoCarrinho(code) {
    const produto = produtos.find(p => p.code === code);
    if (!produto) {
        console.error("Produto não encontrado:", code);
        return;
    }

    const itemNoCarrinho = cart.find(item => item.code === code);
    if (itemNoCarrinho) {
        mostrarNotificacao('Este produto já está no seu carrinho!', 'erro');
        return;
    }

    let preco = parseFloat(produto.valorAvulso) || 0;
    const valorAssinante = parseFloat(produto.valorAssinante);
    const valorPromocao = parseFloat(produto.valorPromocao);
    const temPromocao = produto.temPromocao && valorPromocao > 0;

    if (isVIP && valorAssinante > 0) {
        preco = valorAssinante;
    } else if (temPromocao) {
        preco = valorPromocao;
    }

    cart.push({
        code: produto.code,
        nome: produto.nome,
        preco: preco,
        imagem: produto.imagem || 'assets/placeholder.jpg'
    });

    animateCartIcon();
    mostrarNotificacao(`${produto.nome} adicionado!`, 'sucesso');
    atualizarContadorCarrinho();
    atualizarCarrinho();
    atualizarBotoesAddCarrinho(code);
}

function removerDoCarrinho(code) {
    const item = cart.find(item => item.code === code);
    if (!item) return;

    cart = cart.filter(item => item.code !== code);
    atualizarCarrinho();
    atualizarContadorCarrinho();
    atualizarBotoesAddCarrinho(code);
}

function limparCarrinho() {
    if (cart.length === 0) return;
    
    if (confirm(`Deseja remover todos os ${cart.length} itens do carrinho?`)) {
        const codigos = cart.map(item => item.code);
        cart = [];
        atualizarCarrinho();
        atualizarContadorCarrinho();
        codigos.forEach(code => atualizarBotoesAddCarrinho(code));
        mostrarNotificacao('Carrinho limpo com sucesso!', 'sucesso');
    }
}

// ==========================================
// ATUALIZAÇÃO DA INTERFACE
// ==========================================

function atualizarContadorCarrinho() {
    const quantidade = cart.length;
    
    const contadorHeader = document.getElementById('cart-count-header-desktop');
    if (contadorHeader) contadorHeader.textContent = quantidade;
    
    const contador = document.querySelector('.tab[data-tab="carrinho"] .cart-count');
    if (contador) {
        contador.textContent = quantidade;
        contador.classList.toggle('has-items', quantidade > 0);
    }
    
    const bottomCartCount = document.getElementById('bottom-cart-count');
    if (bottomCartCount) {
        bottomCartCount.textContent = quantidade;
        bottomCartCount.classList.toggle('show', quantidade > 0);
    }
}

function atualizarCarrinho() {
    const cartItems = document.getElementById('cart-items');
    const cartSummary = document.getElementById('cart-summary');
    
    if (!cartItems || !cartSummary) return;

    const obsoleteElements = document.querySelectorAll('.cart-item-badge, .item-number, .cart-header-professional');
    obsoleteElements.forEach(el => el.remove());

    cartItems.innerHTML = '';

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart-professional">
                <div class="empty-cart-icon"><i class="fas fa-shopping-cart"></i></div>
                <h3 class="empty-cart-title">Seu carrinho está vazio</h3>
                <p class="empty-cart-description">Adicione produtos incríveis à sua coleção</p>
                <div class="empty-cart-animation"><div class="floating-dots"><span></span><span></span><span></span></div></div>
            </div>`;
        _appendMobileMenuFooter(cartItems);
        cartSummary.innerHTML = '';
        cartSummary.style.display = 'none';
        return;
    }

    cartSummary.style.display = 'block';

    const cartItemsContainer = document.createElement('div');
    cartItemsContainer.className = 'cart-items-container';

    cart.forEach((item) => {
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item-professional';
        cartItem.innerHTML = `
            <div class="cart-item-image-container"><img src="${item.imagem}" alt="${item.nome}" class="cart-item-img-professional" onerror="this.src='assets/placeholder.jpg'"></div>
            <div class="cart-item-details">
                <div class="cart-item-info-professional">
                    <h4 class="cart-item-title-professional">${item.nome}</h4>
                    <span class="cart-item-price-professional">${formatarMoeda(item.preco)}</span>
                </div>
                <div class="cart-item-actions-professional"><button class="remove-item-professional" onclick="removerDoCarrinho('${item.code}')" title="Remover item"><i class="fas fa-times"></i></button></div>
            </div>`;
        cartItemsContainer.appendChild(cartItem);
    });

    cartItems.appendChild(cartItemsContainer);
    _appendMobileMenuFooter(cartItems);
    atualizarResumoCarrinho();
}

function atualizarResumoCarrinho() {
    const cartSummary = document.getElementById('cart-summary');
    if (!cartSummary) return;

    const total = cart.reduce((total, item) => total + item.preco, 0);
    const originalTotal = cart.reduce((total, item) => {
        const produtoOriginal = produtos.find(p => p.code === item.code);
        const precoOriginal = parseFloat(produtoOriginal?.valorAvulso) || item.preco;
        return total + precoOriginal;
    }, 0);
    const savings = originalTotal - total;

    cartSummary.innerHTML = '';
    cartSummary.className = '';

    const fixedSummary = document.createElement('div');
    fixedSummary.className = 'cart-summary-fixed';

    fixedSummary.innerHTML = `
        <div class="persuasion-bar">
            ${savings > 0 ? `<span id="savings-indicator"><i class="fas fa-tags"></i> Você economiza: <strong>${formatarMoeda(savings)}</strong></span>` : ''}
        </div>
        <div class="summary-content">
            <button id="checkout-btn" onclick="checkout()" class="checkout-btn-fixed">
                <div class="btn-content"><i class="fab fa-pix"></i><span>Finalizar ${formatarMoeda(total)}</span></div>
                <div class="spinner"></div>
            </button>
        </div>
        <div class="reassurance-bar"><i class="fas fa-shield-alt"></i><span>Pagamento Seguro e Acesso Imediato</span></div>`;

    cartSummary.appendChild(fixedSummary);
}

function atualizarBotoesAddCarrinho(code) {
    document.querySelectorAll(`.add-to-cart[data-id="${code}"]`).forEach(botao => {
        const inCart = cart.some(item => item.code === code);
        botao.classList.toggle('in-cart', inCart);
        botao.innerHTML = inCart ? '<i class="fas fa-check"></i> No Carrinho' : '<i class="fas fa-cart-plus"></i> Adicionar';
        botao.disabled = inCart;
    });
}

// ==========================================
// ANIMAÇÕES
// ==========================================

function animateCartIcon() {
    const cartTab = document.querySelector('.tab[data-tab="carrinho"]');
    const cartCount = document.querySelector('.tab[data-tab="carrinho"] .cart-count');
    if (cartTab && cartCount) {
        cartTab.classList.add("animated");
        cartCount.classList.add("animated");
        setTimeout(() => {
            cartTab.classList.remove("animated");
            cartCount.classList.remove("animated");
        }, 700);
    }
    const bottomNavCart = document.querySelector('.bottom-nav-item[data-tab="carrinho"]');
    const bottomCartBadge = document.getElementById("bottom-cart-count");
    if (bottomNavCart && bottomCartBadge) {
        bottomNavCart.style.transform = "scale(1.1)";
        bottomCartBadge.classList.add("animated");
        setTimeout(() => {
            bottomNavCart.style.transform = "";
            bottomCartBadge.classList.remove("animated");
        }, 700);
    }
}

// ==========================================
// CHECKOUT E PAGAMENTO
// ==========================================

function calcularTotal() {
    return cart.reduce((total, item) => total + item.preco, 0);
}

// MODIFICAÇÃO: A função agora é 'async' para usar 'await' e 'try/catch'.
async function checkout() {
    if (cart.length === 0) {
        mostrarNotificacao("Seu carrinho está vazio", "erro");
        return;
    }
    showLoading("checkout-btn");

    const total = calcularTotal();
    const itensCarrinho = cart.map(item => item.nome).join(", ");
    
    try {
        // CORREÇÃO: Utiliza o wrapper seguro fetchAPI ao invés do fetch direto.
        const res = await fetchAPI(`${scriptURL}?action=criarPagamentoPix&email=${encodeURIComponent(currentUser)}&nome=${encodeURIComponent(currentUserName)}&valor=${total}&produto=${encodeURIComponent(itensCarrinho)}`);

        if (res.sucesso) {
            sessionStorage.setItem("pagamentoAtual", res.idPagamento);
            const pixModal = document.getElementById("pix-modal");
            const qrCodeImg = document.getElementById("qr-code-img");
            const pixKeyInput = document.getElementById("pix-key-input");
            if (!pixModal || !qrCodeImg || !pixKeyInput) {
                console.error("Elementos do modal PIX não encontrados.");
                mostrarNotificacao("Erro ao exibir modal de pagamento.", "erro");
                return;
            }
            qrCodeImg.src = `data:image/png;base64,${res.qrCodeBase64}`;
            pixKeyInput.value = res.qrCode;
            pixModal.style.display = "flex";
            document.body.classList.add("no-scroll");
            const pendingNotification = document.getElementById("pending-payment-notification");
            if (pendingNotification) pendingNotification.style.display = "flex";
            iniciarVerificacaoStatus(res.idPagamento, cart);
        } else {
            mostrarNotificacao("Erro ao gerar pagamento: " + (res.mensagem || "Tente novamente."), "erro");
        }
    } catch (err) {
        mostrarNotificacao("Erro ao processar pagamento. Verifique sua conexão.", "erro");
        console.error(err);
    } finally {
        hideLoading("checkout-btn");
    }
}

// MODIFICAÇÃO: A função agora é 'async' para usar 'await' e 'try/catch'.
async function checkoutDiretoVIP(productCode, buttonId) {
    if (!buttonId) {
        console.error("checkoutDiretoVIP chamado sem um buttonId.");
        mostrarNotificacao("Erro interno. Tente novamente.", "erro");
        return;
    }
    
    const produtoVIP = produtos.find(p => p.code === productCode);
    if (!produtoVIP) {
        mostrarNotificacao("Produto de assinatura não encontrado. Contate o suporte.", "erro");
        return;
    }
    
    const preco = parseFloat(produtoVIP.valorAvulso) || 0;
    if (preco <= 0) {
        mostrarNotificacao("Preço inválido para o produto VIP. Contate o suporte.", "erro");
        return;
    }
    
    showLoading(buttonId);
    activeCheckoutButtonId = buttonId;
    const nomeProduto = produtoVIP.nome;

    try {
        // CORREÇÃO: Utiliza o wrapper seguro fetchAPI ao invés do fetch direto.
        const res = await fetchAPI(`${scriptURL}?action=criarPagamentoPix&email=${encodeURIComponent(currentUser)}&nome=${encodeURIComponent(currentUserName)}&valor=${preco}&produto=${encodeURIComponent(nomeProduto)}`);

        if (res.sucesso) {
            sessionStorage.setItem("pagamentoAtual", res.idPagamento);
            const pixModal = document.getElementById("pix-modal");
            const qrCodeImg = document.getElementById("qr-code-img");
            const pixKeyInput = document.getElementById("pix-key-input");
            
            if (!pixModal || !qrCodeImg || !pixKeyInput) {
                console.error("Elementos do modal PIX não encontrados.");
                mostrarNotificacao("Erro ao exibir modal de pagamento.", "erro");
                return;
            }
            
            qrCodeImg.src = `data:image/png;base64,${res.qrCodeBase64}`;
            pixKeyInput.value = res.qrCode;
            pixModal.style.display = "flex";
            document.body.classList.add("no-scroll");
            
            const pendingNotification = document.getElementById("pending-payment-notification");
            if (pendingNotification) pendingNotification.style.display = "flex";
            
            const carrinhoVIP = [{ code: produtoVIP.code, nome: produtoVIP.nome, preco: preco }];
            iniciarVerificacaoStatus(res.idPagamento, carrinhoVIP);
        } else {
            mostrarNotificacao("Erro ao gerar pagamento: " + (res.mensagem || "Tente novamente."), "erro");
        }
    } catch (err) {
        mostrarNotificacao("Erro ao processar pagamento. Verifique sua conexão.", "erro");
        console.error(err);
    } finally {
        hideLoading(buttonId);
        activeCheckoutButtonId = null;
    }
}


// ==========================================
// VERIFICAÇÃO DE PAGAMENTO
// ==========================================

function iniciarVerificacaoStatus(idPagamento, carrinhoAtual) {
    if (verificacaoStatusInterval) {
        clearInterval(verificacaoStatusInterval);
    }
    const statusVerificacao = document.getElementById("status-verificacao");
    if (statusVerificacao) statusVerificacao.style.display = "flex";
    verificacaoStatusInterval = setInterval(() => {
        // Esta chamada pode continuar usando fetch direto se a rota for PÚBLICA e não sensível,
        // mas por consistência, vamos usar fetchAPI.
        fetchAPI(`${scriptURL}?action=verificarStatusPagamentoManual&idPagamento=${idPagamento}`)
        .then(res => {
            if (res.sucesso && res.statusInterno === "Pago") {
                clearInterval(verificacaoStatusInterval);
                verificacaoStatusInterval = null;
                if (statusVerificacao) statusVerificacao.style.display = "none";
                processarConfirmacaoPagamento(idPagamento, carrinhoAtual);
                mostrarNotificacao("Pagamento confirmado! Redirecionando...", "sucesso");
                sessionStorage.removeItem("pagamentoAtual");
            } else if (!res.sucesso) {
                clearInterval(verificacaoStatusInterval);
                verificacaoStatusInterval = null;
                console.error("Erro ao verificar status:", res.mensagem || "Erro desconhecido");
                if (statusVerificacao) statusVerificacao.style.display = "none";
            }
        }).catch(err => {
            console.error("Erro ao verificar status:", err);
            clearInterval(verificacaoStatusInterval);
            verificacaoStatusInterval = null;
            if (statusVerificacao) statusVerificacao.style.display = "none";
        });
    }, 10000);
}

async function processarConfirmacaoPagamento(idPagamento, carrinhoConfirmacao = null) {
    const carrinhoParaProcessar = carrinhoConfirmacao || cart;
    if (carrinhoParaProcessar.length === 0) return;

    const pedido = {
        data: new Date().toISOString(),
        numero: idPagamento,
        itens: JSON.stringify(carrinhoParaProcessar.map(item => ({ code: item.code, nome: item.nome, preco: item.preco, imagem: item.imagem }))),
        total: carrinhoParaProcessar.reduce((total, item) => total + item.preco, 0),
        status: "Pago"
    };

    const formData = new FormData();
    formData.append("action", "salvarPedido");
    formData.append("email", currentUser);
    formData.append("pedido", JSON.stringify(pedido));

    try {
        // CORREÇÃO: Utiliza fetchAPI para a chamada POST de salvar o pedido.
        const res = await fetchAPI(scriptURL, { method: "POST", body: formData });

        if (res.sucesso) {
            carrinhoParaProcessar.forEach(item => { if (!produtosComprados.includes(item.code)) produtosComprados.push(item.code); });
            produtos = produtos.filter(produto => !produtosComprados.includes(produto.code));
            if (!carrinhoConfirmacao) {
                const codigosCarrinho = cart.map(item => item.code);
                cart = [];
                atualizarCarrinho();
                atualizarContadorCarrinho();
                codigosCarrinho.forEach(code => atualizarBotoesAddCarrinho(code));
            }
            carregarProdutos();
            const pixModal = document.getElementById("pix-modal");
            if (pixModal) {
                pixModal.style.display = "none";
                document.body.classList.remove("no-scroll");
            }
            const pendingNotification = document.getElementById("pending-payment-notification");
            if (pendingNotification) pendingNotification.style.display = "none";
            setTimeout(() => {
                const tabId = "pedidos";
                document.querySelectorAll(".header-nav-btn, .bottom-nav-item").forEach(btn => btn.classList.remove("active"));
                document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
                document.querySelectorAll(`[data-tab="${tabId}"]`).forEach(b => b.classList.add("active"));
                const targetTabContent = document.getElementById(tabId);
                if (targetTabContent) targetTabContent.classList.add("active");
                const filterContainer = document.querySelector(".filter-container");
                if (filterContainer) filterContainer.style.display = "none";
                if (typeof carregarPedidos === "function") carregarPedidos();
                window.scrollTo({ top: 0, behavior: "smooth" });
            }, 1500);
        }
    } catch (err) {
        console.error("Erro ao salvar pedido:", err);
    }
}


// ==========================================
// ESTILOS E INICIALIZAÇÃO
// ==========================================

function injectCartProfessionalStyles() {
    if (document.getElementById('cart-professional-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'cart-professional-styles';
    style.textContent = `
        .cart-item-badge, .item-number, .cart-header-professional, .cart-header-info,
        .cart-header-title, .cart-header-count, .clear-cart-btn { display: none !important; }
        
        body.cart-active .site-footer { display: none !important; }

        .cart-items-container { display: flex; flex-direction: column; gap: 20px; padding: 30px; max-width: 1400px; margin: 0 auto; width: 95%; }
        #carrinho #cart-items { padding-bottom: 180px; }
        .empty-cart-professional { text-align: center; padding: 80px 30px; background: linear-gradient(135deg, var(--dark-bg-lighter) 0%, var(--dark-bg-lightest) 100%); border-radius: var(--border-radius-lg); margin: 30px auto; border: 2px dashed var(--border-color); position: relative; overflow: hidden; max-width: 1200px; width: 90%; }
        .empty-cart-icon { font-size: 4rem; color: var(--accent-color); margin-bottom: 20px; opacity: 0.8; }
        .empty-cart-title { color: var(--text-light); margin-bottom: 10px; font-size: 1.5rem; }
        .empty-cart-description { color: var(--text-light-muted); margin-bottom: 30px; }
        .floating-dots { display: flex; justify-content: center; gap: 10px; }
        .floating-dots span { width: 8px; height: 8px; background: var(--accent-color); border-radius: 50%; animation: pulse 2s ease-in-out infinite; }
        .floating-dots span:nth-child(2) { animation-delay: 0.3s; }
        .floating-dots span:nth-child(3) { animation-delay: 0.6s; }
        @keyframes pulse { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes glow-pulse { 0% { box-shadow: 0 6px 20px rgba(0, 179, 119, 0.3); } 50% { box-shadow: 0 8px 25px rgba(0, 179, 119, 0.5); } 100% { box-shadow: 0 6px 20px rgba(0, 179, 119, 0.3); } }
        .cart-item-professional { display: flex; align-items: center; padding: 25px 30px; background: linear-gradient(135deg, var(--dark-bg-lighter) 0%, var(--dark-bg-lightest) 100%); border-radius: var(--border-radius-lg); border: 1px solid var(--border-color); transition: all 0.2s ease; position: relative; overflow: hidden; width: 100%; margin: 0 auto; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); }
        .cart-item-professional:hover { transform: translateY(-2px); border-color: var(--accent-color); box-shadow: 0 8px 25px rgba(0, 179, 119, 0.15); }
        .cart-item-image-container { margin-right: 25px; flex-shrink: 0; }
        .cart-item-img-professional { width: 100px; height: 75px; object-fit: cover; border-radius: var(--border-radius-md); border: 2px solid var(--border-color); }
        .cart-item-details { flex: 1; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .cart-item-info-professional { flex: 1; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .cart-item-title-professional { color: var(--text-light); margin: 0; font-size: 1.2rem; font-weight: 600; text-align: left; flex: 1; }
        .cart-item-price-professional { color: var(--accent-color); font-weight: 600; font-size: 1.3rem; white-space: nowrap; }
        .remove-item-professional { width: 36px; height: 36px; border: none; background: transparent; color: var(--error-color); border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.6; font-size: 0.85rem; }
        .remove-item-professional:hover { background: rgba(224, 49, 49, 0.15); border: 1px solid rgba(224, 49, 49, 0.3); transform: scale(1.05); opacity: 1; }
        .cart-summary-fixed { position: fixed; bottom: 0; left: 0; right: 0; background: linear-gradient(135deg, var(--dark-bg-lighter) 0%, var(--dark-bg-lightest) 100%); backdrop-filter: blur(10px); border-top: 2px solid var(--accent-color); padding: 15px 30px; z-index: 500; box-shadow: 0 -6px 25px rgba(0, 0, 0, 0.3); }
        .persuasion-bar { display: flex; justify-content: center; align-items: center; gap: 25px; margin-bottom: 15px; font-size: 0.8rem; color: var(--text-light-muted); flex-wrap: wrap; min-height: 20px; }
        .persuasion-bar span { display: flex; align-items: center; gap: 6px; }
        #savings-indicator { color: var(--success-color); font-weight: 600; }
        .summary-content { max-width: 1400px; margin: 0 auto; display: flex; justify-content: center; align-items: center; }
        .checkout-btn-fixed { display: flex; align-items: center; justify-content: center; min-height: 58px; background: linear-gradient(135deg, var(--accent-color) 0%, var(--primary-color) 100%); border: none; padding: 18px 40px; border-radius: 50px; color: var(--text-light); font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; position: relative; overflow: hidden; min-width: 220px; animation: glow-pulse 2.5s infinite; }
        
        .checkout-btn-fixed .btn-content { display: flex; align-items: center; justify-content: center; gap: 10px; }

        .checkout-btn-fixed:hover { transform: translateY(-2px) scale(1.02); animation-play-state: paused; box-shadow: 0 8px 25px rgba(0, 179, 119, 0.5); }
        .checkout-btn-fixed.loading .btn-content { visibility: hidden; opacity: 0; }
        .checkout-btn-fixed .spinner { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; border: 3px solid rgba(255, 255, 255, 0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; opacity: 0; visibility: hidden; transition: opacity 0.2s, visibility 0.2s; }
        .checkout-btn-fixed.loading .spinner { visibility: visible; opacity: 1; }
        .reassurance-bar { text-align: center; margin-top: 10px; color: var(--success-color); font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 500; opacity: 0.9; }
        
        @media (max-width: 768px) {
            .cart-summary-fixed { bottom: var(--bottom-nav-height, 70px); padding: 12px 15px; }
            .cart-items-container { padding: 15px; width: 100%; margin: 0; gap: 15px; }
            #carrinho #cart-items { padding-bottom: 200px; }
            .empty-cart-professional { margin: 30px auto 0; }
            .cart-injected-footer { display: block; max-width: 100%; padding: 30px 15px 0; }
            .cart-item-professional { padding: 18px 20px; }
            .cart-item-img-professional { width: 65px; height: 50px; }
            .cart-item-details { gap: 12px; }
            .cart-item-info-professional { gap: 8px; flex-direction: column; align-items: flex-start; }
            .cart-item-title-professional { font-size: 0.8rem; white-space: normal; }
            .cart-item-price-professional { font-size: 0.95rem; }
            .persuasion-bar { gap: 15px; justify-content: space-around; }
            .checkout-btn-fixed { width: 100%; font-size: 1.15rem; min-height: 56px; }
        }

        @keyframes pix-spinner-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes qr-glow { 0%, 100% { box-shadow: 0 0 15px rgba(0, 179, 119, 0.6); } 50% { box-shadow: 0 0 25px rgba(0, 179, 119, 0.9); } }
        #pix-modal .modal-content { background: linear-gradient(135deg, var(--dark-bg-lighter) 0%, var(--dark-bg-lightest) 100%); border: 1px solid var(--border-color); border-radius: var(--border-radius-lg); box-shadow: 0 8px 30px rgba(0,0,0,0.3); max-width: 400px; width: 90%; padding: 0; overflow: hidden; animation: modalFadeIn 0.3s ease; }
        #pix-modal .close-modal { position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; background: rgba(0,0,0,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-light-muted); cursor: pointer; transition: all 0.2s ease; z-index: 10; border: none; font-size: 1rem; }
        #pix-modal .close-modal:hover { background: var(--error-color); color: var(--text-light); transform: scale(1.1); }
        .pix-header { text-align: center; padding: 20px; border-bottom: 1px solid var(--border-color); }
        .pix-header h3 { font-family: 'Orbitron', sans-serif; margin: 0; font-size: 1.2rem; color: var(--accent-color); display: flex; align-items: center; justify-content: center; gap: 10px; }
        .pix-header h3 i { font-size: 1.5rem; }
        .pix-body { padding: 25px; text-align: center; }
        .pix-qrcode-container { padding: 10px; background: rgba(255,255,255,0.95); border-radius: var(--border-radius-md); margin: 0 auto 15px; display: inline-block; animation: qr-glow 2.5s infinite ease-in-out; }
        .qr-code-image { width: 200px; height: 200px; display: block; border-radius: var(--border-radius-sm); }
        .pix-scan-text { font-size: 0.85rem; color: var(--text-light-muted); margin: 0 0 25px; }
        .pix-separator { display: none; }
        .pix-copy-text { font-size: 0.85rem; color: var(--text-light-muted); margin: 0 0 15px; }
        .pix-key-container { display: flex; margin-bottom: 20px; }
        #pix-key-input { flex-grow: 1; background: var(--dark-bg); border: 1px solid var(--border-color); color: var(--text-light); padding: 12px; border-radius: var(--border-radius-md) 0 0 var(--border-radius-md); font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .copy-btn { border: none; background: var(--accent-color); color: var(--text-light); padding: 0 15px; cursor: pointer; border-radius: 0 var(--border-radius-md) var(--border-radius-md) 0; transition: background-color 0.2s ease; }
        .copy-btn:hover { background: var(--accent-hover); }
        .copy-btn.copied { background: var(--success-color); }
        #status-verificacao { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: var(--border-radius-md); color: var(--text-light); font-size: 0.85rem; }
        
        #status-verificacao .spinner {
            width: 22px;
            height: 22px;
            border: 3px solid rgba(255, 255, 255, 0.2);
            border-top-color: var(--accent-color);
            border-radius: 50%;
            animation: pix-spinner-spin 1.2s linear infinite;
        }
        
        .cart-injected-footer {
            display: none;
            padding: 40px 20px 20px;
            margin-top: 20px;
            text-align: center;
            width: 100%;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
            border-top: 1px solid var(--border-color);
        }
        .cart-injected-footer .footer-heading {
            font-size: 1rem;
            margin-bottom: 15px;
            color: var(--text-light-muted);
        }
        .cart-injected-footer .social-icons {
            justify-content: center;
            margin-bottom: 20px;
        }
        .cart-injected-footer .social-icon {
            width: 38px;
            height: 38px;
            font-size: 1rem;
        }
        .cart-injected-footer .copyright {
            font-size: 0.8rem;
            color: var(--text-light-muted);
        }
    `;
    
    document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', function() {
    injectCartProfessionalStyles();
    
    function hideMainFooter() {
        document.body.classList.add('cart-active');
    }
    
    function showMainFooter() {
        document.body.classList.remove('cart-active');
    }
    
    function checkTabState() {
        const carrinhoContent = document.getElementById('carrinho');
        if (carrinhoContent && carrinhoContent.classList.contains('active')) {
             hideMainFooter();
        } else {
            showMainFooter();
        }
    }
    
    setTimeout(checkTabState, 150);
    const observer = new MutationObserver(checkTabState);
    const carrinhoContent = document.getElementById('carrinho');
    if (carrinhoContent) {
        observer.observe(carrinhoContent, { attributes: true, attributeFilter: ['class'] });
    }
    
    document.querySelectorAll('.header-nav-btn, .bottom-nav-item').forEach(tab => {
        tab.addEventListener('click', function() {
            setTimeout(() => {
                checkTabState();
                if (this.dataset.tab === 'carrinho') {
                    atualizarCarrinho();
                }
            }, 50);
        });
    });
});