// =================================================================================
// CONFIGURAÇÃO INICIAL E VARIÁVEIS GLOBAIS
// =================================================================================

const scriptURL = getConfig('api.scriptURL');

let currentUser = null;
let currentUserName = null;
let isVIP = false;
let autocompletouEmail = false;

window.processando = {
    login: false,
    verificarIdentificador: false,
    redefinirSenha: false,
    cadastro: false
};

// =================================================================================
// FUNÇÕES DE ATUALIZAÇÃO DE TEMA DINÂMICO
// =================================================================================

function updateThemeColorCamaleao() {
    const viewportElements = getVisibleElements();
    
    if (viewportElements.length === 0) {
        const backgroundColor = window.getComputedStyle(document.body).backgroundColor;
        updateMetaTags(backgroundColor);
        return;
    }
    
    const dominantElement = findDominantElement(viewportElements);
    const backgroundColor = window.getComputedStyle(dominantElement).backgroundColor;
    
    if (backgroundColor === 'transparent' || backgroundColor === 'rgba(0, 0, 0, 0)') {
        const bodyColor = window.getComputedStyle(document.body).backgroundColor;
        updateMetaTags(bodyColor);
    } else {
        updateMetaTags(backgroundColor);
    }
}

function getVisibleElements() {
    const allElements = document.querySelectorAll('.section-bg-dark, .section-bg-light, .auth-box, .welcome-modal, .section-standard, .auth-section');
    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;
    const viewportBottom = scrollTop + viewportHeight;
    
    return Array.from(allElements).filter(element => {
        const rect = element.getBoundingClientRect();
        const elementTop = scrollTop + rect.top;
        const elementBottom = scrollTop + rect.bottom;
        return (elementBottom > scrollTop && elementTop < viewportBottom);
    });
}

function findDominantElement(elements) {
    if (elements.length === 0) return document.body;
    if (elements.length === 1) return elements[0];
    
    const viewportHeight = window.innerHeight;
    
    const elementsWithArea = elements.map(element => {
        const rect = element.getBoundingClientRect();
        const elementTop = Math.max(0, rect.top);
        const elementBottom = Math.min(viewportHeight, rect.bottom);
        const visibleHeight = Math.max(0, elementBottom - elementTop);
        const visibleWidth = rect.width;
        const visibleArea = visibleHeight * visibleWidth;
        
        return { element, visibleArea };
    });
    
    elementsWithArea.sort((a, b) => b.visibleArea - a.visibleArea);
    
    return elementsWithArea[0].element;
}

function updateMetaTags(backgroundColor) {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.name = 'theme-color';
        document.head.appendChild(metaThemeColor);
    }
    
    metaThemeColor.content = backgroundColor;
    
    let metaAppleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    
    if (!metaAppleStatusBar) {
        metaAppleStatusBar = document.createElement('meta');
        metaAppleStatusBar.name = 'apple-mobile-web-app-status-bar-style';
        document.head.appendChild(metaAppleStatusBar);
    }
    
    const rgb = backgroundColor.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
        const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
        if (brightness < 128) {
            metaAppleStatusBar.content = 'black-translucent';
        } else {
            metaAppleStatusBar.content = 'default';
        }
    }
}

// =================================================================================
// FUNÇÕES UTILITÁRIAS E DE VALIDAÇÃO
// =================================================================================

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function showLoading(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) button.classList.add('loading');
}

function hideLoading(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) button.classList.remove('loading');
}

function capitalizarPalavras(texto) {
    return texto.split(' ').map(palavra => 
        palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase()
    ).join(' ');
}

function validarEmailGmail(email) {
    const emailLower = email.toLowerCase();
    return emailLower.endsWith('@gmail.com') && emailLower.indexOf('@') > 0;
}

function validarNomeCompleto(nome) {
    const palavras = nome.trim().split(/\s+/);
    return palavras.length >= 2;
}

function validarSenha(senha) {
    const senhaTrimmed = senha.trim();
    if (senhaTrimmed === '') {
        return { valido: false, mensagem: 'A senha não pode estar em branco.' };
    }
    if (senhaTrimmed.length < 3) {
        return { valido: false, mensagem: 'A senha deve ter no mínimo 3 caracteres.' };
    }
    return { valido: true, mensagem: '' };
}

function validarCPF(cpf) {
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
        return { valido: false, mensagem: 'Por favor, digite o CPF completo (11 dígitos).' };
    }
    return { valido: true, mensagem: '' };
}

function formatarCPF(value) {
    value = value.replace(/\D/g, '').substring(0, 11);
    
    if (value.length > 9) {
        return value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    } else if (value.length > 6) {
        return value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else if (value.length > 3) {
        return value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    }
    
    return value;
}

function detectarTipoIdentificador(texto) {
    if (texto.includes('@') || (texto.includes('.') && texto.match(/[a-zA-Z]/))) {
        return 'email';
    }
    
    if (texto.replace(/[\d.-]/g, '').length === 0) {
        return 'cpf';
    }
    
    return 'texto';
}

function toggleFormFields(containerId, disabled) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const inputs = container.querySelectorAll('input, button:not(.toggle-password):not(.close-modal)');
    inputs.forEach(input => {
        if (!['login-btn', 'cadastro-btn', 'verificar-identificador-btn', 'redefinir-senha-btn'].includes(input.id)) {
            if (disabled) {
                input.dataset.originalValue = input.value;
                input.addEventListener('input', preventEdit);
            } else {
                input.removeEventListener('input', preventEdit);
            }
            input.disabled = disabled;
        }
    });
}

function preventEdit(event) {
    const input = event.target;
    if (input.dataset.originalValue !== undefined) {
        input.value = input.dataset.originalValue;
    }
}

function verificarCamposLogin() {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-password').value.trim();
    const botao = document.getElementById('login-btn');
    
    botao.classList.remove('desabilitado');
    
    if (email && senha) {
        botao.disabled = false;
    } else {
        botao.disabled = true;
    }
}

// =================================================================================
// FUNCIONALIDADES DE AUTENTICAÇÃO
// =================================================================================

function login() {
    if (window.processando.login) return;
    window.processando.login = true;
    
    const identificador = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-password').value.trim();
    const rememberMe = document.getElementById('remember-me').checked;
    
    if (!identificador || !senha) {
        mostrarNotificacao('Por favor, preencha todos os campos!', 'erro');
        window.processando.login = false;
        return;
    }
    
    toggleFormFields('login-container', true);
    showLoading('login-btn');

    const tipoIdentificador = detectarTipoIdentificador(identificador);
    
    fetch(`${scriptURL}?action=login&identificador=${encodeURIComponent(identificador)}&tipo=${tipoIdentificador}&senha=${encodeURIComponent(senha)}`)
        .then(res => res.json())
        .then(res => {
            if (res.sucesso) {
                if (rememberMe) {
                    localStorage.setItem('savedUserIdentifier', identificador);
                    localStorage.setItem('savedUserPassword', senha);
                } else {
                    localStorage.removeItem('savedUserIdentifier');
                    localStorage.removeItem('savedUserPassword');
                }

                sessionStorage.setItem('currentUser', res.email);
                sessionStorage.setItem('currentUserName', res.nome);
                sessionStorage.setItem('isVIP', res.isVIP || false);
                
                sessionStorage.setItem('justLoggedIn', 'true');
                
                window.location.href = '../index.html';
            } else {
                hideLoading('login-btn');
                mostrarNotificacao(res.mensagem || 'Login inválido! Verifique seu e-mail/CPF e senha.', 'erro');
                
                document.getElementById('login-email').value = '';
                document.getElementById('login-password').value = '';
                
                toggleFormFields('login-container', false);
                
                const loginBtn = document.getElementById('login-btn');
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.classList.remove('desabilitado');
                }
                
                document.getElementById('login-email').focus();
                
                setTimeout(() => { window.processando.login = false; }, 1000);
            }
        })
        .catch(err => {
            hideLoading('login-btn');
            mostrarNotificacao('Erro ao tentar fazer login. Tente novamente.', 'erro');
            console.error(err);
            
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';

            toggleFormFields('login-container', false);
            
            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.classList.remove('desabilitado');
            }

            document.getElementById('login-email').focus();
            
            setTimeout(() => { window.processando.login = false; }, 1000);
        });
}

function verificarIdentificador() {
    if (window.processando.verificarIdentificador) return;
    window.processando.verificarIdentificador = true;
    
    const identificador = document.getElementById('recuperacao-identificador').value.trim();
    
    if (!identificador) {
        mostrarNotificacao('Por favor, preencha o campo com seu e-mail ou CPF.', 'erro');
        window.processando.verificarIdentificador = false;
        return;
    }
    
    toggleFormFields('etapa-verificacao', true);
    showLoading('verificar-identificador-btn');
    
    const isEmail = identificador.includes('@');
    let identificadorProcessado = isEmail ? identificador.toLowerCase() : identificador.replace(/[.-]/g, '');
    
    fetch(`${scriptURL}?action=verificarIdentificador&identificador=${encodeURIComponent(identificadorProcessado)}`)
        .then(res => res.json())
        .then(res => {
            hideLoading('verificar-identificador-btn');
            
            if (res.sucesso) {
                document.getElementById('etapa-verificacao').dataset.identificador = identificadorProcessado;
                document.getElementById('etapa-verificacao').style.display = 'none';
                document.getElementById('etapa-redefinicao').style.display = 'block';
                mostrarNotificacao('Identificador verificado com sucesso.', 'sucesso');
                updateThemeColorCamaleao();
            } else {
                if (isEmail) {
                    verificarEmailAlternativo(identificador);
                } else {
                    mostrarNotificacao('Identificador não encontrado. Verifique seus dados.', 'erro');
                    
                    document.getElementById('recuperacao-identificador').value = '';
                    toggleFormFields('etapa-verificacao', false);
                    
                    const btnVerificar = document.getElementById('verificar-identificador-btn');
                    if (btnVerificar) {
                        btnVerificar.disabled = false;
                        btnVerificar.classList.remove('desabilitado');
                    }
                    
                    document.getElementById('recuperacao-identificador').focus();
                    setTimeout(() => { window.processando.verificarIdentificador = false; }, 1000);
                }
            }
        })
        .catch(err => {
            hideLoading('verificar-identificador-btn');
            mostrarNotificacao('Erro ao conectar com o servidor. Tente novamente.', 'erro');
            console.error('Erro na verificação do identificador:', err);
            
            document.getElementById('recuperacao-identificador').value = '';
            toggleFormFields('etapa-verificacao', false);
            
            const btnVerificar = document.getElementById('verificar-identificador-btn');
            if (btnVerificar) {
                btnVerificar.disabled = false;
                btnVerificar.classList.remove('desabilitado');
            }
            
            document.getElementById('recuperacao-identificador').focus();
            setTimeout(() => { window.processando.verificarIdentificador = false; }, 1000);
        });
}

function verificarEmailAlternativo(email) {
    showLoading('verificar-identificador-btn');
    
    fetch(`${scriptURL}?action=verificarEmailExato&email=${encodeURIComponent(email)}`)
        .then(res => res.json())
        .then(res => {
            hideLoading('verificar-identificador-btn');
            
            if (res.sucesso) {
                document.getElementById('etapa-verificacao').dataset.identificador = email;
                document.getElementById('etapa-verificacao').style.display = 'none';
                document.getElementById('etapa-redefinicao').style.display = 'block';
                mostrarNotificacao('Email verificado com sucesso.', 'sucesso');
                updateThemeColorCamaleao();
            } else {
                mostrarNotificacao('Email não encontrado. Verifique seus dados.', 'erro');
                
                document.getElementById('recuperacao-identificador').value = '';
                toggleFormFields('etapa-verificacao', false);
                
                const btnVerificar = document.getElementById('verificar-identificador-btn');
                if (btnVerificar) {
                    btnVerificar.disabled = false;
                    btnVerificar.classList.remove('desabilitado');
                }
                
                document.getElementById('recuperacao-identificador').focus();
                setTimeout(() => { window.processando.verificarIdentificador = false; }, 1000);
            }
        })
        .catch(err => {
            hideLoading('verificar-identificador-btn');
            mostrarNotificacao('Erro ao conectar com o servidor. Tente novamente.', 'erro');
            console.error('Erro na verificação alternativa de email:', err);
            
            document.getElementById('recuperacao-identificador').value = '';
            toggleFormFields('etapa-verificacao', false);

            const btnVerificar = document.getElementById('verificar-identificador-btn');
            if (btnVerificar) {
                btnVerificar.disabled = false;
                btnVerificar.classList.remove('desabilitado');
            }
            
            document.getElementById('recuperacao-identificador').focus();
            setTimeout(() => { window.processando.verificarIdentificador = false; }, 1000);
        });
}

function redefinirSenha() {
    if (window.processando.redefinirSenha) return;
    window.processando.redefinirSenha = true;
    
    const novaSenha = document.getElementById('nova-senha').value;
    const confirmarSenha = document.getElementById('confirmar-nova-senha').value;
    const identificador = document.getElementById('etapa-verificacao').dataset.identificador;
    
    const validacaoSenha = validarSenha(novaSenha);
    if (!validacaoSenha.valido) {
        mostrarNotificacao(validacaoSenha.mensagem, 'erro');
        window.processando.redefinirSenha = false;
        return;
    }
    
    if (novaSenha !== confirmarSenha) {
        mostrarNotificacao('As senhas não coincidem.', 'erro');
        window.processando.redefinirSenha = false;
        return;
    }
    
    toggleFormFields('etapa-redefinicao', true);
    showLoading('redefinir-senha-btn');
    
    const isEmail = identificador.includes('@');
    
    const formData = new FormData();
    formData.append('action', 'redefinirSenha');
    formData.append('identificador', identificador);
    formData.append('tipoIdentificador', isEmail ? 'email' : 'cpf');
    formData.append('novaSenha', novaSenha);
    
    fetch(scriptURL, { method: 'POST', body: formData })
        .then(res => res.json())
        .then(res => {
            hideLoading('redefinir-senha-btn');
            
            if (res.sucesso) {
                const identificadorOriginal = document.getElementById('recuperacao-identificador').value.trim();
                sessionStorage.setItem('identificadorRecuperado', identificadorOriginal);
                mostrarNotificacao('Senha redefinida com sucesso!', 'sucesso');
                setTimeout(() => {
                    toggleEsqueceuSenha(false);
                    updateThemeColorCamaleao();
                }, 1500);
            } else {
                mostrarNotificacao('Erro ao redefinir senha.', 'erro');
                toggleFormFields('etapa-redefinicao', false);
                const btnRedefinir = document.getElementById('redefinir-senha-btn');
                if (btnRedefinir) {
                    btnRedefinir.disabled = false;
                    btnRedefinir.classList.remove('desabilitado');
                }
                setTimeout(() => { window.processando.redefinirSenha = false; }, 1000);
            }
        })
        .catch(err => {
            hideLoading('redefinir-senha-btn');
            mostrarNotificacao('Erro ao conectar com o servidor.', 'erro');
            console.error('Erro na redefinição de senha:', err);
            toggleFormFields('etapa-redefinicao', false);
            const btnRedefinir = document.getElementById('redefinir-senha-btn');
            if (btnRedefinir) {
                btnRedefinir.disabled = false;
                btnRedefinir.classList.remove('desabilitado');
            }
            setTimeout(() => { window.processando.redefinirSenha = false; }, 1000);
        });
}

function cadastro() {
    if (window.processando.cadastro) return;
    window.processando.cadastro = true;
    
    const nome = document.getElementById('cadastro-nome').value.trim();
    const email = document.getElementById('cadastro-email').value.trim();
    const senha = document.getElementById('cadastro-password').value;
    const cpf = document.getElementById('cadastro-cpf').value.trim();
    
    if (!validarNomeCompleto(nome)) {
        mostrarNotificacao('Digite seu nome completo.', 'erro');
        window.processando.cadastro = false;
        return;
    }
    
    if (!validarEmailGmail(email)) {
        mostrarNotificacao('Utilize um e-mail @gmail.com válido.', 'erro');
        window.processando.cadastro = false;
        return;
    }

    const validacaoSenha = validarSenha(senha);
    if (!validacaoSenha.valido) {
        mostrarNotificacao(validacaoSenha.mensagem, 'erro');
        window.processando.cadastro = false;
        return;
    }
    
    const validacaoCPF = validarCPF(cpf);
    if (!validacaoCPF.valido) {
        mostrarNotificacao(validacaoCPF.mensagem, 'erro');
        window.processando.cadastro = false;
        return;
    }
    
    toggleFormFields('cadastro-container', true);
    
    const nomeFormatado = capitalizarPalavras(nome);
    const cpfFormatado = formatarCPF(cpf);
    
    showLoading('cadastro-btn');

    const formData = new FormData();
    formData.append('action', 'cadastro');
    formData.append('nome', nomeFormatado);
    formData.append('email', email);
    formData.append('senha', senha);
    formData.append('cpf', cpfFormatado);

    fetch(scriptURL, { method: 'POST', body: formData })
        .then(res => res.json())
        .then(res => {
            hideLoading('cadastro-btn');
            
            if (!res.sucesso && res.cpfExistente) {
                mostrarNotificacao('CPF já cadastrado. Redirecionando...', 'erro');
                
                setTimeout(() => {
                    const cpfLimpo = cpfFormatado.replace(/[.-]/g, '');
                    document.getElementById('login-container').style.display = 'none';
                    document.getElementById('cadastro-container').style.display = 'none';
                    document.getElementById('esqueceu-senha-container').style.display = 'flex';
                    document.getElementById('etapa-verificacao').dataset.identificador = cpfLimpo;
                    document.getElementById('etapa-verificacao').style.display = 'none';
                    document.getElementById('etapa-redefinicao').style.display = 'block';
                    document.getElementById('nova-senha').value = '';
                    document.getElementById('confirmar-nova-senha').value = '';
                    document.getElementById('nova-senha').focus();
                    toggleFormFields('etapa-redefinicao', false);
                    const btnRedefinir = document.getElementById('redefinir-senha-btn');
                    if (btnRedefinir) {
                        btnRedefinir.disabled = false;
                        btnRedefinir.classList.remove('desabilitado');
                    }
                    updateThemeColorCamaleao();
                }, 1500);
            } else if (!res.sucesso) {
                mostrarNotificacao(res.mensagem, 'erro');
                toggleFormFields('cadastro-container', false);
                const btnCadastro = document.getElementById('cadastro-btn');
                if (btnCadastro) {
                    btnCadastro.disabled = false;
                    btnCadastro.classList.remove('desabilitado');
                }
                setTimeout(() => { window.processando.cadastro = false; }, 1000);
            } else {
                mostrarNotificacao(res.mensagem, 'sucesso');
                sessionStorage.setItem('emailCadastrado', email);
                toggleCadastro(false);
                updateThemeColorCamaleao();
                setTimeout(() => { window.processando.cadastro = false; }, 1000);
            }
        })
        .catch(err => {
            hideLoading('cadastro-btn');
            mostrarNotificacao('Erro ao tentar cadastrar. Tente novamente.', 'erro');
            console.error(err);
            toggleFormFields('cadastro-container', false);
            const btnCadastro = document.getElementById('cadastro-btn');
            if (btnCadastro) {
                btnCadastro.disabled = false;
                btnCadastro.classList.remove('desabilitado');
            }
            setTimeout(() => { window.processando.cadastro = false; }, 1000);
        });
}

// =================================================================================
// CONTROLE DE VISIBILIDADE DOS PAINÉIS
// =================================================================================

function toggleEsqueceuSenha(mostrar, cpfPreenchido = null) {
    document.getElementById('login-container').style.display = mostrar ? 'none' : 'flex';
    document.getElementById('esqueceu-senha-container').style.display = mostrar ? 'flex' : 'none';
    document.getElementById('cadastro-container').style.display = 'none';
    
    if (!mostrar) {
        document.getElementById('recuperacao-identificador').value = '';
        document.getElementById('nova-senha').value = '';
        document.getElementById('confirmar-nova-senha').value = '';
        
        document.getElementById('etapa-verificacao').style.display = 'block';
        document.getElementById('etapa-redefinicao').style.display = 'none';
        
        toggleFormFields('login-container', false);
        toggleFormFields('etapa-verificacao', false);
        toggleFormFields('etapa-redefinicao', false);

        const identificadorRecuperado = sessionStorage.getItem('identificadorRecuperado');
        if (identificadorRecuperado) {
            document.getElementById('login-email').value = identificadorRecuperado;
            setTimeout(() => {
                document.getElementById('login-password').focus();
            }, 100);
            sessionStorage.removeItem('identificadorRecuperado');
        }

    } else {
        if (cpfPreenchido) {
            document.getElementById('recuperacao-identificador').value = cpfPreenchido;
        }
        toggleFormFields('etapa-verificacao', false);
    }
    
    verificarCamposLogin();
    setTimeout(updateThemeColorCamaleao, 10);
}

function toggleCadastro(ativo) {
    document.getElementById('login-container').style.display = ativo ? 'none' : 'flex';
    document.getElementById('cadastro-container').style.display = ativo ? 'flex' : 'none';
    document.getElementById('esqueceu-senha-container').style.display = 'none';
    
    if (ativo) {
        document.getElementById('cadastro-nome').value = '';
        document.getElementById('cadastro-email').value = '';
        document.getElementById('cadastro-password').value = '';
        document.getElementById('cadastro-cpf').value = '';
        toggleFormFields('cadastro-container', false);
    } else {
        const emailCadastrado = sessionStorage.getItem('emailCadastrado');
        if (emailCadastrado) {
            document.getElementById('login-email').value = emailCadastrado;
            setTimeout(() => document.getElementById('login-password').focus(), 100);
            sessionStorage.removeItem('emailCadastrado');
        }
        document.getElementById('login-password').value = '';
        verificarCamposLogin();
        toggleFormFields('login-container', false);
    }
    setTimeout(updateThemeColorCamaleao, 10);
}

// --- INÍCIO DA MODIFICAÇÃO: Função de retorno ---
function goBack() {
    window.location.href = '../index.html';
}
// --- FIM DA MODIFICAÇÃO ---

// =================================================================================
// FUNÇÕES DE EXIBIÇÃO E SETUP DA UI
// =================================================================================

function mostrarNotificacao(mensagem, tipo) {
    document.querySelectorAll('.notificacao-sucesso, .notificacao-erro').forEach(n => n.remove());
    const notificacao = document.createElement('div');
    notificacao.className = `notificacao-${tipo}`;
    const icone = document.createElement('i');
    icone.className = tipo === 'sucesso' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    notificacao.appendChild(icone);
    const textoSpan = document.createElement('span');
    textoSpan.textContent = mensagem;
    notificacao.appendChild(textoSpan);
    notificacao.style.position = 'fixed';
    notificacao.style.bottom = '20px';
    notificacao.style.left = '50%';
    notificacao.style.transform = 'translateX(-50%)';
    notificacao.style.maxWidth = '80%';
    notificacao.style.zIndex = '1000';
    notificacao.style.animation = 'fadeSimple 0.2s forwards';
    document.body.appendChild(notificacao);
    setTimeout(() => {
        notificacao.style.transition = 'opacity 0.3s';
        notificacao.style.opacity = '0';
        setTimeout(() => { if (notificacao.parentNode) notificacao.parentNode.removeChild(notificacao); }, 300);
    }, 3000);
}

function setupPasswordToggle(inputId, toggleId) {
    const toggle = document.getElementById(toggleId);
    if (!toggle) return;
    toggle.classList.add('fa-eye');
    toggle.addEventListener('click', function() {
        const input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
            this.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            this.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });
}

function setupInputFormatters() {
    const nomeInput = document.getElementById('cadastro-nome');
    if (nomeInput) {
        nomeInput.addEventListener('input', function() { this.value = capitalizarPalavras(this.value); });
        nomeInput.addEventListener('keypress', e => {
            if (/\d/.test(e.key)) {
                e.preventDefault();
            }
        });
    }
    
    document.querySelectorAll('#cadastro-cpf, #login-email, #recuperacao-identificador').forEach(input => {
        if(input) input.addEventListener('input', function() {
            if (detectarTipoIdentificador(this.value) === 'cpf') this.value = formatarCPF(this.value);
            if (this.id === 'login-email') verificarCamposLogin();
        });
    });
    
    const cpfInput = document.getElementById('cadastro-cpf');
    if (cpfInput) cpfInput.addEventListener('keypress', e => { if (!/^\d+$/.test(e.key)) e.preventDefault(); });
    
    document.querySelectorAll('#cadastro-email, #login-email').forEach(input => {
        if (!input) return;
        let lastValue = '';
        input.addEventListener('input', function() {
            const value = this.value;
            if (value.length < lastValue.length) { lastValue = value; autocompletouEmail = false; return; }
            
            const partes = value.split('@');
            if (value.includes('@') && !autocompletouEmail && !value.includes('@gmail.com') && partes[0].length > 0) {
                this.value = partes[0] + '@gmail.com';
                autocompletouEmail = true;
                const nextId = this.id === 'cadastro-email' ? 'cadastro-password' : 'login-password';
                setTimeout(() => { document.getElementById(nextId)?.focus(); }, 100);
            }
            lastValue = value;
            if (!this.value.includes('@') || !this.value.includes('@gmail.com')) autocompletouEmail = false;
        });
    });
}

// =================================================================================
// INICIALIZAÇÃO DO DOM E EVENT LISTENERS
// =================================================================================

document.addEventListener('DOMContentLoaded', function() {
    updateThemeColorCamaleao();
    window.addEventListener('scroll', () => { clearTimeout(window.scrollThrottleTimeout); window.scrollThrottleTimeout = setTimeout(updateThemeColorCamaleao, 100); }, { passive: true });
    new MutationObserver(updateThemeColorCamaleao).observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', () => { clearTimeout(window.resizeThrottleTimeout); window.resizeThrottleTimeout = setTimeout(updateThemeColorCamaleao, 100); }, { passive: true });
    
    setupPasswordToggle('login-password', 'toggle-login-password');
    setupPasswordToggle('cadastro-password', 'toggle-cadastro-password');
    setupPasswordToggle('nova-senha', 'toggle-nova-senha');
    setupPasswordToggle('confirmar-nova-senha', 'toggle-confirmar-senha');
    setupInputFormatters();
    
    const emailHelp = document.getElementById('email-help');
    if (emailHelp) emailHelp.addEventListener('mouseenter', () => mostrarNotificacao(emailHelp.dataset.tooltip, 'sucesso'));
    
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) { loginBtn.classList.remove('desabilitado'); loginBtn.disabled = true; verificarCamposLogin(); }
    
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'cadastro') toggleCadastro(true);
    else if (params.get('action') === 'recuperar') toggleEsqueceuSenha(true);
    
    const keypressMap = {
        'login-email': () => document.getElementById('login-password')?.focus(), 'login-password': login,
        'recuperacao-identificador': verificarIdentificador, 'nova-senha': () => document.getElementById('confirmar-nova-senha')?.focus(),
        'confirmar-nova-senha': redefinirSenha, 'cadastro-nome': () => document.getElementById('cadastro-email')?.focus(),
        'cadastro-email': () => document.getElementById('cadastro-password')?.focus(), 'cadastro-password': () => document.getElementById('cadastro-cpf')?.focus(),
        'cadastro-cpf': cadastro
    };
    Object.keys(keypressMap).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); keypressMap[id](); } });
    });
    document.getElementById('login-email')?.addEventListener('input', verificarCamposLogin);
    document.getElementById('login-password')?.addEventListener('input', verificarCamposLogin);
    
    const savedIdentifier = localStorage.getItem('savedUserIdentifier');
    const savedPassword = localStorage.getItem('savedUserPassword');
    
    if (savedIdentifier && savedPassword) {
        document.getElementById('login-email').value = savedIdentifier;
        document.getElementById('login-password').value = savedPassword;
        document.getElementById('remember-me').checked = true;
        verificarCamposLogin();
    }
    
    // --- INÍCIO DA MODIFICAÇÃO: Event listener do botão de retorno ---
    const backBtn = document.getElementById('back-to-store-btn');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            goBack();
        });
    }
    // --- FIM DA MODIFICAÇÃO ---

    setInterval(updateThemeColorCamaleao, 2000);
});