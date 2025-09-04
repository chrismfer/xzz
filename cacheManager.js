// =================================================================================
// CONFIGURAÇÕES E INICIALIZAÇÃO DO CACHE
// =================================================================================

const CACHE_VERSION = "1.0";
const CACHE_PREFIX = "skullstore_";
let imagensProdutosCache = {};

function initImageCache() {
    const cacheInfo = localStorage.getItem(`${CACHE_PREFIX}cache_info`);
    
    if (!cacheInfo || JSON.parse(cacheInfo).version !== CACHE_VERSION) {
        clearImageCache();
        
        localStorage.setItem(`${CACHE_PREFIX}cache_info`, JSON.stringify({
            version: CACHE_VERSION,
            created: new Date().toISOString(),
            lastUpdate: new Date().toISOString()
        }));
    }
    
    try {
        const cachedImages = localStorage.getItem(`${CACHE_PREFIX}images_cache`);
        if (cachedImages) {
            imagensProdutosCache = JSON.parse(cachedImages);
            console.log("Cache de imagens carregado: ", Object.keys(imagensProdutosCache).length, "imagens em cache");
        }
    } catch (error) {
        console.error("Erro ao carregar cache de imagens:", error);
        clearImageCache();
    }
}

// =================================================================================
// GERENCIAMENTO DO CACHE
// =================================================================================

function clearImageCache() {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
            localStorage.removeItem(key);
        }
    });
    
    imagensProdutosCache = {};
}

function saveImageCache() {
    try {
        const cacheStr = JSON.stringify(imagensProdutosCache);
        const cacheSize = cacheStr.length * 2;
        
        if (cacheSize > 4.5 * 1024 * 1024) {
            const keys = Object.keys(imagensProdutosCache);
            const keysToRemove = keys.slice(0, keys.length - 100);
            
            keysToRemove.forEach(key => {
                delete imagensProdutosCache[key];
            });
            
            console.log(`Cache reduzido: ${keys.length} → ${Object.keys(imagensProdutosCache).length} imagens`);
        }
        
        localStorage.setItem(`${CACHE_PREFIX}images_cache`, JSON.stringify(imagensProdutosCache));
        
        const cacheInfo = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}cache_info`) || '{}');
        cacheInfo.lastUpdate = new Date().toISOString();
        localStorage.setItem(`${CACHE_PREFIX}cache_info`, JSON.stringify(cacheInfo));
        
    } catch (error) {
        console.error("Erro ao salvar cache de imagens:", error);
        clearImageCache();
    }
}

function addImageToCache(url, status = true) {
    if (!url) return;
    
    imagensProdutosCache[url] = {
        cached: status,
        timestamp: new Date().getTime()
    };
    
    if (Object.keys(imagensProdutosCache).length % 10 === 0) {
        saveImageCache();
    }
}

function isImageCached(url) {
    if (!url) return false;
    return imagensProdutosCache[url]?.cached === true;
}

// =================================================================================
// PRÉ-CARREGAMENTO DE IMAGENS
// =================================================================================

function preCarregarImagens(imagens) {
    if (!imagens || !Array.isArray(imagens) || imagens.length === 0) return;
    
    const preloadContainer = document.getElementById('preload-container');
    if (!preloadContainer) return;
    
    preloadContainer.innerHTML = '';

    const batchSize = 5;
    const totalBatches = Math.ceil(imagens.length / batchSize);
    
    function loadBatch(batchIndex) {
        if (batchIndex >= totalBatches) {
            saveImageCache();
            return;
        }
        
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, imagens.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const url = imagens[i];
            if (!url || isImageCached(url)) continue;
            
            const img = new Image();
            img.onload = () => {
                addImageToCache(url, true);
                img.remove();
            };
            img.onerror = () => {
                addImageToCache(url, false);
                img.remove();
            };
            img.src = url;
            preloadContainer.appendChild(img);
        }
        
        setTimeout(() => loadBatch(batchIndex + 1), 300);
    }
    
    loadBatch(0);
}