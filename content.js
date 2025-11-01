/**
 * content.js with Shadow DOM
 * Complete CSS isolation through Shadow DOM
 */
(() => {
    // Clean up any existing modals from previous injections to prevent stacking
    const existingModals = document.querySelectorAll('#supertab-root');
    existingModals.forEach(modal => modal.remove());

    let supertabContainer = null;
    let shadowRoot = null;
    let supertabModal = null;
    let suggestionsList = null;
    let searchInput = null;
    let isOpen = false;
    let selectedIndex = 0;
    let currentSuggestions = [];
    let filteredSuggestions = [];

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "toggle-supertab-modal") {
            if (isOpen) {
                closeModal();
            } else {
                currentSuggestions = request.suggestions;
                openModal();
            }
        }
    });
    
    function createModal() {
        // Check if container exists and is still in DOM
        if (supertabContainer && document.body.contains(supertabContainer)) return;

        // Clean up orphaned reference if container was removed from DOM
        if (supertabContainer && !document.body.contains(supertabContainer)) {
            supertabContainer = null;
            shadowRoot = null;
        }

        // Create container for Shadow DOM
        supertabContainer = document.createElement('div');
        supertabContainer.id = 'supertab-root';
        // Styles critiques sur le conteneur (avant Shadow DOM)
        supertabContainer.style.cssText = `
            position: fixed !important;
            inset: 0 !important;
            z-index: 2147483647 !important;
            pointer-events: none !important;
        `;
        
        // Attacher le Shadow DOM
        shadowRoot = supertabContainer.attachShadow({ mode: 'open' });
        
        // Injecter les styles ET le HTML dans le Shadow DOM
        shadowRoot.innerHTML = `
            <style>
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }
                :host {
                    all: initial;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                }
                :root {
                    --st-bg: #ffffff;
                    --st-text: #1f2937;
                    --st-text-light: #6b7280;
                    --st-border: #e5e7eb;
                    --st-overlay: rgba(24, 30, 40, 0.5);
                    --st-highlight: #f3f4f6;
                    --st-selection: #3b82f6;
                    --st-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                }
                .overlay {
                    position: fixed;
                    inset: 0;
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    align-items: flex-start;
                    justify-content: center;
                    padding-top: 15vh;
                    background-color: rgba(24, 30, 40, 0.5);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                    transition: opacity 0.2s ease-out;
                    pointer-events: auto;
                }
                .overlay.hidden { 
                    display: none;
                    pointer-events: none;
                }
                .overlay.visible { 
                    opacity: 1;
                    pointer-events: auto;
                }
                .modal {
                    width: 100%;
                    max-width: 640px;
                    background-color: #ffffff;
                    border-radius: 12px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    overflow: hidden;
                    border: 1px solid #e5e7eb;
                    transform: translateY(-20px) scale(0.98);
                    opacity: 0;
                    transition: transform 0.2s ease-out, opacity 0.2s ease-out;
                    pointer-events: auto;
                }
                .modal.visible {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
                .search-box { position: relative; }
                .search-icon { 
                    position: absolute; 
                    left: 16px; 
                    top: 50%; 
                    transform: translateY(-50%); 
                    width: 20px; 
                    height: 20px; 
                    color: var(--st-text-light); 
                }
                .search-input {
                    width: 100%;
                    padding: 16px 16px 16px 48px;
                    font-size: 16px;
                    border: none;
                    border-bottom: 1px solid #e5e7eb;
                    outline: none;
                    color: #1f2937;
                    background: #ffffff;
                    font-family: inherit;
                }
                .search-input::placeholder {
                    color: #9ca3af;
                    opacity: 1;
                }
                .suggestions-list { 
                    max-height: 400px; 
                    overflow-y: auto; 
                    padding: 8px; 
                }
                .suggestions-header {
                    padding: 12px 16px 8px 16px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    background-color: #ffffff;
                }
                .tab-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background-color 0.1s ease-in-out;
                    background-color: transparent;
                    text-decoration: none;
                }
                .tab-item:hover { 
                    background-color: #f3f4f6;
                }
                .tab-item.selected {
                    background-color: #3b82f6 !important;
                    color: #ffffff !important;
                }
                .favicon { 
                    width: 20px; 
                    height: 20px; 
                    border-radius: 4px; 
                    flex-shrink: 0; 
                }
                .tab-info { 
                    flex-grow: 1; 
                    min-width: 0; 
                }
                .tab-title { 
                    font-weight: 500;
                    color: #1f2937;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .tab-url { 
                    font-size: 12px;
                    color: #6b7280;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    line-height: 1.4;
                }
                .tab-item.selected .tab-title { 
                    color: #ffffff !important;
                }
                .tab-item.selected .tab-url { 
                    color: #ffffff !important;
                    opacity: 0.9;
                }
                .no-results { 
                    padding: 40px 20px; 
                    text-align: center; 
                    color: var(--st-text-light); 
                }
                .footer {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 8px 16px;
                    background-color: #f9fafb;
                    border-top: 1px solid var(--st-border);
                    font-size: 12px;
                    color: var(--st-text-light);
                }
                .footer-item kbd {
                    padding: 2px 6px;
                    border-radius: 4px;
                    border: 1px solid #d1d5db;
                    background-color: white;
                    box-shadow: 0 1px 1px rgba(0,0,0,0.05);
                    font-family: inherit;
                    margin-right: 4px;
                    font-size: 12px;
                }
            </style>
            <div class="overlay hidden">
                <div class="modal">
                    <div class="search-box">
                        <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                        <input type="text" placeholder="Search tabs by title or URL..." class="search-input">
                    </div>
                    <div class="suggestions-header">Suggested tabs</div>
                    <div class="suggestions-list"></div>
                    <div class="footer">
                        <div class="footer-item"><kbd>↑↓</kbd> Navigate</div>
                        <div class="footer-item"><kbd>Enter</kbd> Switch</div>
                        <div class="footer-item"><kbd>Esc</kbd> Close</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(supertabContainer);

        // Récupérer les références aux éléments dans le Shadow DOM
        const overlay = shadowRoot.querySelector('.overlay');
        supertabModal = shadowRoot.querySelector('.modal');
        suggestionsList = shadowRoot.querySelector('.suggestions-list');
        searchInput = shadowRoot.querySelector('.search-input');

        // Listeners
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        searchInput.addEventListener('input', handleSearch);
        document.addEventListener('keydown', handleKeyDown, true);
    }
    
    function openModal() {
        createModal();
        isOpen = true;
        selectedIndex = 0;
        const overlay = shadowRoot.querySelector('.overlay');
        overlay.classList.remove('hidden');
        
        renderSuggestions(currentSuggestions);
        searchInput.focus();
        searchInput.value = '';

        setTimeout(() => {
            overlay.classList.add('visible');
            supertabModal.classList.add('visible');
        }, 10);
    }

    function closeModal() {
        if (!isOpen) return;
        isOpen = false;
        const overlay = shadowRoot.querySelector('.overlay');
        overlay.classList.remove('visible');
        supertabModal.classList.remove('visible');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 200);
    }
    
    function renderSuggestions(tabsToRender) {
        filteredSuggestions = tabsToRender;
        if (!suggestionsList) return;

        if (tabsToRender.length === 0) {
            suggestionsList.innerHTML = `<div class="no-results">No matching tabs found.</div>`;
            return;
        }

        suggestionsList.innerHTML = tabsToRender.map((tab, index) => {
            const domain = tab.url ? new URL(tab.url).hostname.replace('www.', '') : 'Local page';
            const safeTitle = tab.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `
                <div class="tab-item ${index === selectedIndex ? 'selected' : ''}" data-index="${index}">
                    <img src="${tab.favIconUrl || 'https://www.google.com/s2/favicons?sz=32&domain_url=example.com'}" class="favicon" alt="" onerror="this.src='https://placehold.co/32x32/e2e8f0/adb5bd?text=?'">
                    <div class="tab-info">
                        <div class="tab-title">${safeTitle || 'Untitled Tab'}</div>
                        <div class="tab-url">${domain}</div>
                    </div>
                </div>
            `;
        }).join('');

        shadowRoot.querySelectorAll('.tab-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedIndex = parseInt(item.dataset.index);
                selectTab();
            });
        });
        scrollToSelected();
    }
    
    function handleKeyDown(e) {
        if (!isOpen) return;
        
        if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();

            switch(e.key) {
                case 'Escape':
                    closeModal();
                    break;
                case 'ArrowDown':
                    selectedIndex = (selectedIndex + 1) % filteredSuggestions.length;
                    renderSuggestions(filteredSuggestions);
                    break;
                case 'ArrowUp':
                    selectedIndex = (selectedIndex - 1 + filteredSuggestions.length) % filteredSuggestions.length;
                    renderSuggestions(filteredSuggestions);
                    break;
                case 'Enter':
                    selectTab();
                    break;
            }
        }
    }
    
    function selectTab() {
        if (selectedIndex >= filteredSuggestions.length) return;

        const selectedTab = filteredSuggestions[selectedIndex];
        chrome.runtime.sendMessage({
            action: "switch-tab",
            tabId: selectedTab.id,
            windowId: selectedTab.windowId
        });
        closeModal();
    }
    
    function handleSearch() {
        selectedIndex = 0;
        const query = searchInput.value.toLowerCase();
        
        if (!query) {
            renderSuggestions(currentSuggestions);
            return;
        }
        
        // Recherche locale rapide
        const localFiltered = currentSuggestions.filter(tab => 
            (tab.title && tab.title.toLowerCase().includes(query)) ||
            (tab.url && tab.url.toLowerCase().includes(query))
        );
        
        // Si peu de résultats locaux, demande fuzzy search au background
        if (localFiltered.length < 3) {
            chrome.runtime.sendMessage({
                action: "fuzzy-search",
                query: query
            }, (response) => {
                if (response && response.results) {
                    // Convertit résultats fuzzy en format tab
                    const fuzzyResults = response.results.map(r => 
                        currentSuggestions.find(t => t.id === r.id)
                    ).filter(Boolean);
                    
                    renderSuggestions(fuzzyResults.length > 0 ? fuzzyResults : localFiltered);
                } else {
                    renderSuggestions(localFiltered);
                }
            });
        } else {
            renderSuggestions(localFiltered);
        }
    }
    
    function scrollToSelected() {
        const selectedElement = suggestionsList.querySelector('.selected');
        if (selectedElement) {
            selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
})();