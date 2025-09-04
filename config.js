const CONFIG = {
    api: {
        scriptURL: 'https://script.google.com/macros/s/AKfycbyC20N9uj0QvTQwPw676VGN7aAsuD5LgLxhczrtSbpDr_NWpEfhJWhLjeUdVE3lzD-Lgw/exec'
    },
    
    app: {
        name: "Acervo dos Entusiastas",
        version: "1.0.0",
        description: "Sistemas de Alta Performance com instalação em 3 minutos"
    },
    
    paths: {
        images: "public/images/",
        feedbacks: "public/images/feedbacks/",
        icons: "assets/icons/"
    },
    
    ui: {
        testimonials: {
            autoplay: true,
            interval: 5000,
            transitionSpeed: 400,
            showDots: true,
            showArrows: true
        },
        
        allowedImageExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        
        lightbox: {
            animationSpeed: 300,
            closeOnClickOutside: true,
            showCounter: true
        }
    },
    
    feedbacks: [
        { 
            id: 1,
            path: "public/images/feedback1.jpg", 
            alt: "Feedback de usuário 1",
            date: "2024-05-01"
        },
        { 
            id: 2,
            path: "public/images/feedback2.jpg", 
            alt: "Feedback de usuário 2",
            date: "2024-05-02"
        }
    ]
};

function getConfig(key, defaultValue = null) {
    const parts = key.split('.');
    let result = CONFIG;
    
    for (const part of parts) {
        if (result && typeof result === 'object' && part in result) {
            result = result[part];
        } else {
            return defaultValue;
        }
    }
    
    return result !== undefined ? result : defaultValue;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, getConfig };
} else {
    window.CONFIG = CONFIG;
    window.getConfig = getConfig;
}