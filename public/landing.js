document.addEventListener('DOMContentLoaded', function() {
    // =================================================================================
    // LÓGICA DA GALERIA - ENVIA MENSAGEM PARA A PÁGINA PAI
    // =================================================================================

    /**
     * Em vez de tentar abrir o lightbox diretamente (o que falha por causa do iframe),
     * esta função agora coleta as imagens e o índice inicial e envia uma mensagem
     * para a janela pai (index.html), que é responsável por abrir o modal.
     */
    function openUnifiedLightbox(images, startIndex) {
        // As imagens são enviadas com o caminho relativo à landing page
        const message = {
            type: 'openLightbox',
            images: images,
            startIndex: startIndex
        };
        // Envia a mensagem para a página que contém o iframe
        window.parent.postMessage(message, '*');
    }

    // =================================================================================
    // POPULAÇÃO DINÂMICA DAS GALERIAS
    // =================================================================================

    const feedbacksGrid = document.getElementById('feedbacks-grid');
    const feedbacks = [
        { image: 'images/feeds/feed1.png', alt: 'Feedback de usuário mostrando sistema ultra-rápido' },
        { image: 'images/feeds/feed2.png', alt: 'Feedback de usuário sobre instalação em apenas 3 minutos' },
        { image: 'images/feeds/feed3.png', alt: 'Feedback de usuário relatando zero travamentos com nosso sistema' },
        { image: 'images/feeds/feed4.png', alt: 'Feedback de usuário sobre revitalização de PC antigo' },
        { image: 'images/feeds/feed5.png', alt: 'Feedback de gamer relatando melhoria de FPS com nosso sistema' }
    ];

    if (feedbacksGrid) {
        feedbacksGrid.innerHTML = '';
        feedbacks.forEach((feedback, index) => {
            const feedbackItem = document.createElement('div');
            feedbackItem.className = 'feedback-item';
            const img = document.createElement('img');
            img.src = feedback.image;
            img.alt = feedback.alt;
            img.className = 'feedback-image';
            // O click agora chama a função que envia a mensagem
            feedbackItem.addEventListener('click', () => openUnifiedLightbox(feedbacks, index));
            feedbackItem.appendChild(img);
            feedbacksGrid.appendChild(feedbackItem);
        });
    }

    const systemGallery = document.getElementById('system-gallery');
    const systemImages = [
        { image: 'images/sistema/detalhes1.png', alt: 'Interface otimizada do Sistema FURY' },
        { image: 'images/sistema/detalhes2.png', alt: 'Painel de controle simplificado do FURY' },
        { image: 'images/sistema/detalhes3.png', alt: 'Ferramentas exclusivas do Sistema FURY' },
        { image: 'images/sistema/detalhes4.png', alt: 'Desempenho superior do Sistema FURY' }
    ];

    if (systemGallery) {
        systemGallery.innerHTML = '';
        systemImages.forEach((imgData, index) => {
            const galleryItem = document.createElement('div');
            galleryItem.className = 'system-gallery-item';
            const imgEl = document.createElement('img');
            imgEl.src = imgData.image;
            imgEl.alt = imgData.alt;
            imgEl.className = 'system-gallery-image';
            // O click agora chama a função que envia a mensagem
            galleryItem.addEventListener('click', () => openUnifiedLightbox(systemImages, index));
            galleryItem.appendChild(imgEl);
            systemGallery.appendChild(galleryItem);
        });
    }

    // =================================================================================
    // LÓGICA DE UI E ANIMAÇÕES
    // =================================================================================

    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach((item) => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            item.classList.toggle('active');
        });
    });
    
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        const header = card.querySelector('.feature-header');
        if (header) {
            header.addEventListener('click', () => {
                card.classList.toggle('active');
            });
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            if (this.getAttribute('href') !== "#") {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - 70;
                    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                }
            }
        });
    });

    const fadeElements = document.querySelectorAll('.fade-in');
    const checkFadeElements = () => {
        const triggerBottom = window.innerHeight * 0.8;
        fadeElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            if (elementTop < triggerBottom) {
                element.classList.add('active');
            }
        });
    };
    window.addEventListener('scroll', checkFadeElements);
    checkFadeElements();
});


// =================================================================================
// SCRIPT DE COMUNICAÇÃO COM IFRAME (PÁGINA PAI)
// =================================================================================

(function() {
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    let lastHeight = 0;

    function sendHeight() {
        const newHeight = document.body.scrollHeight;
        if (Math.abs(newHeight - lastHeight) > 1) {
            lastHeight = newHeight;
            if (window.parent) {
                window.parent.postMessage({ type: 'iframeResize', height: newHeight }, '*');
            }
        }
    }

    const debouncedSendHeight = debounce(sendHeight, 150);

    window.addEventListener('load', sendHeight);

    if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(debouncedSendHeight);
        observer.observe(document.body);
    } else {
        setInterval(sendHeight, 500);
    }
})();