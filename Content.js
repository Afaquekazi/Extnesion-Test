let button;
let outputText;
let selectedMode;
let solthronContainer;
let currentCategory = null;
let activeNoteId = null;  // Keeps track of which note is currently selected for appending
let isStarActive = false; // Tracks whether we're in append mode
let isButtonVisible = true;
let pageCredits = null; // Page-based credit cache

// ✨ NEW: Double-click animation function
function triggerDoubleClickAnimation() {
    const solthronButton = document.querySelector('.solthron-button');
    
    if (!solthronButton) return;
    
    // Remove any existing animation classes
    solthronButton.classList.remove('double-click-activated');
    
    // Force reflow to ensure class removal takes effect
    solthronButton.offsetHeight;
    
    // Add the animation class
    solthronButton.classList.add('double-click-activated');
    
    // Remove animation class after animation completes
    setTimeout(() => {
        solthronButton.classList.remove('double-click-activated');
    }, 600);
}

// Loading Bar Helper Functions
function showShimmerLoading(message) {
    outputText.classList.remove('placeholder', 'error');
    outputText.classList.add('shimmer-loading');
    outputText.textContent = message; // Show normal text
}

function hideShimmerLoading() {
    outputText.classList.remove('shimmer-loading');
}

// Feature-to-credit mapping function (matches backend exactly)
function getFeatureCredits(mode) {
    // Text Processing: 6 credits
    const textProcessingModes = [
        'reframe_casual', 'reframe_technical', 'reframe_professional', 
        'reframe_eli5', 'reframe_short', 'reframe_long'
    ];
    
    // Convert Prompts: 8 credits
    const convertPromptModes = [
        'convert_concise', 'convert_balanced', 'convert_detailed'
    ];
    
    // Persona AI Generator: 10 credits
    const personaModes = ['persona_generator'];
    
    // Image Processing: 12 credits
    const imageModes = ['image_prompt', 'image_caption'];
    
    // Explain: 5 credits
    const explainModes = ['explain_meaning', 'explain_story', 'explain_eli5'];
    
    // AI Assistant: 15 credits
    const aiAssistantModes = ['smart_followups', 'smart_actions', 'smart_enhancements'];
    
    // Free Features: 0 credits
    const freeModes = ['save_note', 'save_prompt', 'save_persona'];
    
    // Determine credit cost based on mode
    if (textProcessingModes.includes(mode)) return 6;
    if (convertPromptModes.includes(mode)) return 8;
    if (personaModes.includes(mode)) return 10;
    if (imageModes.includes(mode)) return 12;
    if (explainModes.includes(mode)) return 5;
    if (aiAssistantModes.includes(mode)) return 15;
    if (freeModes.includes(mode)) return 0;
    
    // Default fallback (for any unmapped modes)
    return 6;
}

// NEW BACKEND AUTH SYSTEM (replaces Firebase)
const BackendAuth = {
    // Get stored auth token
    async getAuthToken() {
        try {
            const result = await chrome.storage.local.get(['authToken']);
            return result.authToken || null;
        } catch (error) {
            console.error('Error getting auth token:', error);
            return null;
        }
    },

    // Store auth token
    async setAuthToken(token) {
        try {
            await chrome.storage.local.set({ 
                authToken: token,
                authTimestamp: Date.now()
            });
            return true;
        } catch (error) {
            console.error('Error setting auth token:', error);
            return false;
        }
    },

    // Check if user is logged in
    async isLoggedIn() {
        try {
            const token = await this.getAuthToken();
            if (!token) return false;

            // Optionally verify token with backend
            const response = await fetch('https://afaque.pythonanywhere.com/user-credits', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            console.error('Error checking login status:', error);
            return false;
        }
    },

    // Login with email/password
    async login(email, password) {
        try {
            const response = await fetch('https://afaque.pythonanywhere.com/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                await this.setAuthToken(data.token);
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error' };
        }
    },

    // Logout
    async logout() {
        try {
            await chrome.storage.local.remove(['authToken', 'authTimestamp']);
            pageCredits = null; // Clear credit cache
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    },

    // Get user credits from backend
    async getUserCredits() {
        try {
            const token = await this.getAuthToken();
            if (!token) return 0;

            const response = await fetch('https://afaque.pythonanywhere.com/user-credits', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.credits || 0;
            }
            return 0;
        } catch (error) {
            console.error('Error getting user credits:', error);
            return 0;
        }
    },

    // Deduct credits from backend
    async deductCredits(feature) {
        try {
            const token = await this.getAuthToken();
            if (!token) {
                return { success: false, message: "Not logged in" };
            }

            const response = await fetch('https://afaque.pythonanywhere.com/deduct-credits', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ feature })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error deducting credits:', error);
            return { success: false, message: error.message };
        }
    }
};

// Storage functions for prompts, notes, and personas (keep existing functions)
async function savePrompt(promptText) {
    const promptId = Date.now().toString();
    const prompt = {
        id: promptId,
        text: promptText,
        timestamp: new Date().toISOString()
    };
    try {
        const data = await chrome.storage.sync.get('savedPrompts');
        const savedPrompts = data.savedPrompts || [];
        savedPrompts.push(prompt);
        await chrome.storage.sync.set({ savedPrompts });
        return true;
    } catch (error) {
        console.error('Error saving prompt:', error);
        return false;
    }
}

async function saveNote(text) {
    if (isStarActive && activeNoteId) {
        try {
            const data = await chrome.storage.local.get('savedNotes');
            const savedNotes = data.savedNotes || [];
            const noteIndex = savedNotes.findIndex(note => note.id === activeNoteId);
            
            if (noteIndex !== -1) {
                savedNotes[noteIndex].text += '\n\n' + text;
                savedNotes[noteIndex].lastModified = new Date().toISOString();
                await chrome.storage.local.set({ savedNotes });
                return true;
            }
        } catch (error) {
            console.error('Error appending to note:', error);
            return false;
        }
    } else {
        const noteId = Date.now().toString();
        const note = {
            id: noteId,
            text: text,
            timestamp: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        
        try {
            const data = await chrome.storage.local.get('savedNotes');
            const savedNotes = data.savedNotes || [];
            savedNotes.push(note);
            
            if (savedNotes.length > 3) {
                const galleryList = document.querySelector('.gallery-list');
                if (galleryList) {
                    galleryList.style.overflowY = 'auto';
                }
            }
            
            await chrome.storage.local.set({ savedNotes });
            return true;
        } catch (error) {
            console.error('Error saving note:', error);
            return false;
        }
    }
}

async function savePersona(text) {
    const personaId = Date.now().toString();
    
    // Extract title from persona text (first line or default)
    const lines = text.split('\n');
    let title = 'Custom Persona';
    
    // Try to extract a meaningful title from the text
    for (let line of lines) {
        line = line.trim();
        if (line.includes('You are') && line.length > 10 && line.length < 100) {
            title = line.replace('You are', '').replace(/[^\w\s]/g, '').trim();
            title = title.charAt(0).toUpperCase() + title.slice(1);
            if (title.length > 50) title = title.substring(0, 50) + '...';
            break;
        }
        if (line.includes('specialist') || line.includes('expert') || line.includes('consultant')) {
            title = line.replace(/[^\w\s]/g, '').trim();
            if (title.length > 50) title = title.substring(0, 50) + '...';
            break;
        }
    }
    
    const persona = {
        id: personaId,
        title: title,
        prompt: text,
        example: 'Acting with this custom persona',
        response: 'I\'m ready to help with my specialized expertise.',
        timestamp: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        source: 'user_saved'
    };
    
    try {
        const data = await chrome.storage.local.get('personaTemplates');
        const savedPersonas = data.personaTemplates || [];
        savedPersonas.push(persona);
        await chrome.storage.local.set({ personaTemplates: savedPersonas });
        return true;
    } catch (error) {
        console.error('Error saving persona:', error);
        return false;
    }
}

async function loadPrompts() {
    try {
        const data = await chrome.storage.sync.get('savedPrompts');
        return data.savedPrompts || [];
    } catch (error) {
        console.error('Error loading prompts:', error);
        return [];
    }
}

async function loadNotes() {
    try {
        const data = await chrome.storage.local.get('savedNotes');
        return data.savedNotes || [];
    } catch (error) {
        console.error('Error loading notes:', error);
        return [];
    }
}

async function loadPersonaTemplates() {
    const builtInTemplates = [
        {
            id: 'ceo-exec',
            title: 'CEO / Executive Persona',
            prompt: 'You are a visionary CEO known for making bold decisions and leading organizations to success. Your communication is concise, strategic, and focuses on high-level outcomes. Use business terminology like "market expansion," "revenue growth," and "operational efficiency." Prioritize actionable insights over theory. Avoid unnecessary small talk. Always conclude your responses with a summary and key takeaways.',
            example: 'Our company is facing declining user engagement. What should we do?',
            response: 'Declining engagement suggests issues in product-market fit, value proposition, or competitive positioning. Three key areas to address:\n1. User Feedback Loop – Conduct targeted surveys and analyze churn data.\n2. Product Enhancement – Invest in AI-driven personalization and UX optimization.\n3. Marketing Strategy – Shift focus to retention campaigns rather than pure acquisition.\n\nKey Takeaway: Addressing engagement decline requires a data-backed approach to customer experience and value delivery.',
            timestamp: new Date().toISOString(),
            source: 'built_in'
        }
    ];
    
    try {
        const storageData = await chrome.storage.local.get('personaTemplates');
        const savedPersonas = storageData.personaTemplates || [];
        return [...builtInTemplates, ...savedPersonas];
    } catch (error) {
        console.error('Error loading persona templates:', error);
        return builtInTemplates;
    }
}

async function deletePrompt(promptId) {
    try {
        const data = await chrome.storage.sync.get('savedPrompts');
        const savedPrompts = (data.savedPrompts || []).filter(p => p.id !== promptId);
        await chrome.storage.sync.set({ savedPrompts });
        return true;
    } catch (error) {
        console.error('Error deleting prompt:', error);
        return false;
    }
}

async function deleteNote(noteId) {
    try {
        const data = await chrome.storage.local.get('savedNotes');
        const savedNotes = (data.savedNotes || []).filter(n => n.id !== noteId);
        await chrome.storage.local.set({ savedNotes });
        return true;
    } catch (error) {
        console.error('Error deleting note:', error);
        return false;
    }
}

async function deletePersona(personaId) {
    try {
        const data = await chrome.storage.local.get('personaTemplates');
        const personas = (data.personaTemplates || []).filter(p => p.id !== personaId);
        await chrome.storage.local.set({ personaTemplates: personas });
        return true;
    } catch (error) {
        console.error('Error deleting persona:', error);
        return false;
    }
}

function detectTone(text) {
    const tonePatterns = {
        technical: {
            pattern: /\b(api|function|code|data|algorithm|software|debug|variable|parameter|method|class|object|array|interface|module|system|database|query|framework|library|documentation|compile|runtime|server|client|architecture|deployment)\b/i,
            weight: 1.2
        },
        academic: {
            pattern: /\b(research|study|analysis|theory|hypothesis|methodology|findings|conclusion|literature|evidence|abstract|thesis|dissertation|empirical|experiment|investigation|journal|publication|review|scholarly)\b/i,
            weight: 1.0
        },
        business: {
            pattern: /\b(business|client|project|deadline|meeting|report|strategy|objective|goals|timeline|stakeholder|budget|proposal|contract|partnership|revenue|market|opportunity|initiative|performance|deliverable)\b/i,
            weight: 1.0
        },
        casual: {
            pattern: /\b(hey|hi|hello|thanks|awesome|cool|great|wow|yeah|ok|okay|stuff|thing|like|maybe|probably|basically|actually|pretty|super|totally)\b/i,
            weight: 0.8
        },
        creative: {
            pattern: /\b(story|write|creative|imagine|describe|narrative|character|scene|setting|plot|theme|style|voice|emotion|feeling|expression|artistic|visual|design|concept)\b/i,
            weight: 1.0
        }
    };

    const scores = {};
    const lowercaseText = text.toLowerCase();
    let maxScore = 0;
    let detectedTone = 'professional';

    for (const [tone, config] of Object.entries(tonePatterns)) {
        const matches = (lowercaseText.match(config.pattern) || []).length;
        scores[tone] = matches * config.weight;
        
        if (scores[tone] > maxScore) {
            maxScore = scores[tone];
            detectedTone = tone;
        }
    }

    return maxScore === 0 ? 'professional' : detectedTone;
}

// Platform detection function
function detectAIPlatform() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
        return 'chatgpt';
    } else if (hostname.includes('claude.ai')) {
        return 'claude';
    } else if (hostname.includes('gemini.google.com') || hostname.includes('bard.google.com')) {
        return 'gemini';
    } else if (hostname.includes('chat.deepseek.com')) {
        return 'deepseek';
    } else if (hostname.includes('grok.x.com') || (hostname.includes('x.com') && pathname.includes('grok'))) {
        return 'grok';
    } else if (hostname.includes('perplexity.ai')) {
        return 'perplexity';
    }
    return 'unknown';
}

// Conversation extraction function
function extractConversation() {
    const platform = detectAIPlatform();
    let conversation = '';
    
    try {
        switch(platform) {
            case 'chatgpt':
                const chatMessages = document.querySelectorAll('[data-message-author-role]');
                if (chatMessages.length >= 2) {
                    const lastTwo = Array.from(chatMessages).slice(-2);
                    conversation = lastTwo.map(msg => {
                        const role = msg.getAttribute('data-message-author-role');
                        const text = msg.textContent.trim();
                        return `${role === 'user' ? 'User' : 'AI'}: ${text}`;
                    }).join('\n\n');
                }
                break;
                
            case 'claude':
                const claudeMessages = document.querySelectorAll('.prose, [data-testid*="message"]');
                if (claudeMessages.length >= 2) {
                    const lastTwo = Array.from(claudeMessages).slice(-2);
                    conversation = lastTwo.map((msg, idx) => {
                        const role = idx === 0 ? 'User' : 'AI';
                        return `${role}: ${msg.textContent.trim()}`;
                    }).join('\n\n');
                }
                break;
                
            case 'gemini':
                let geminiMessages = [];
                
                const messageElements = document.querySelectorAll(
                    'message-content[id*="message-content"], ' +
                    '[id*="model-response-message-content"], ' + 
                    '.model-response-text, ' +
                    '.markdown.markdown-main-panel, ' +
                    '.conversation-container .response-content'
                );
                
                if (messageElements.length > 0) {
                    geminiMessages = Array.from(messageElements).filter(el => {
                        const text = el.textContent.trim();
                        const isSubstantial = text.length > 30 && text.length < 5000;
                        const isNotSidebar = !el.closest('.side-navigation, .recent-chats, nav');
                        return isSubstantial && isNotSidebar;
                    });
                }
                
                if (geminiMessages.length < 2) {
                    const chatHistory = document.querySelector('#chat-history, .chat-history, .conversation-container');
                    if (chatHistory) {
                        const possibleMessages = chatHistory.querySelectorAll(
                            'div[class*="response"], div[class*="message"], p, .markdown'
                        );
                        geminiMessages = Array.from(possibleMessages).filter(el => {
                            const text = el.textContent.trim();
                            return text.length > 50 && text.length < 3000 && 
                                   !el.closest('button, input') &&
                                   !text.includes('Recent') &&
                                   !text.includes('New chat') &&
                                   !text.includes('Search for');
                        });
                    }
                }
                
                if (geminiMessages.length < 2) {
                    const userMessages = document.querySelectorAll('[class*="user"], .user-message, [role="user"]');
                    const aiMessages = document.querySelectorAll('[class*="model"], [class*="response"], .ai-message');
                    
                    if (userMessages.length > 0 && aiMessages.length > 0) {
                        geminiMessages = [
                            ...Array.from(userMessages).slice(-1),
                            ...Array.from(aiMessages).slice(-1)
                        ];
                    }
                }
                
                if (geminiMessages.length >= 2) {
                    const lastTwo = Array.from(geminiMessages).slice(-2);
                    conversation = lastTwo.map((msg, idx) => {
                        let text = msg.textContent.trim();
                        
                        text = text.replace(/^\s*[\d\w\-]+\s*/, '');
                        text = text.replace(/\s+/g, ' ');
                        
                        const isLikelyUser = text.length < 100 || 
                                           text.includes('?') ||
                                           idx === 0 ||
                                           msg.classList.contains('user') ||
                                           msg.closest('[class*="user"]');
                                           
                        const role = isLikelyUser ? 'User' : 'AI';
                        
                        return `${role}: ${text}`;
                    }).join('\n\n');
                }
                break;
                
            default:
                const allTextBlocks = document.querySelectorAll('p, div[class*="message"], div[class*="chat"], div[role="presentation"], [role="article"]');
                if (allTextBlocks.length > 0) {
                    const recent = Array.from(allTextBlocks)
                        .filter(block => {
                            const text = block.textContent.trim();
                            return text.length > 20 && text.length < 3000 && 
                                   !block.querySelector('input, button');
                        })
                        .slice(-4);
                    conversation = recent.map(block => block.textContent.trim()).join('\n\n');
                }
        }
    } catch (error) {
        console.error('Error extracting conversation:', error);
    }
    
    return conversation || 'Unable to extract conversation from this page.';
}

// NEW CREDIT CHECK FUNCTION (replaces Firebase version)
async function checkCredits(mode) {
    try {
        // Get required credits for this feature
        const requiredCredits = getFeatureCredits(mode);
        
        // Free features don't need credit checks
        if (requiredCredits === 0) {
            return { success: true, requiredCredits: 0 };
        }
        
        // Check if user is logged in
        const isLoggedIn = await BackendAuth.isLoggedIn();
        if (!isLoggedIn) {
            return { success: true }; // Allow usage for non-logged users
        }
        
        // Use page cache if available, otherwise fetch fresh
        if (pageCredits === null) {
            pageCredits = await BackendAuth.getUserCredits();
        }
        
        if (pageCredits < requiredCredits) {
            return { 
                success: false, 
                message: `Insufficient credits. This feature requires ${requiredCredits} credits, but you have ${pageCredits}.` 
            };
        }
        
        // Deduct credits from backend AND update cache
        const deductResult = await BackendAuth.deductCredits(mode);
        
        if (!deductResult.success) {
            return { 
                success: false, 
                message: deductResult.message || "Credit deduction failed" 
            };
        }
        
        // Update page cache with remaining credits
        pageCredits = deductResult.remaining;
        
        return { 
            success: true, 
            remaining: deductResult.remaining,
            creditsUsed: requiredCredits
        };
        
    } catch (error) {
        console.error('Credit check error:', error);
        // Allow usage if credit check fails (fallback)
        return { success: true };
    }
}

// Display functions (keep all existing display functions)
function displaySmartFollowups(data) {
    hideShimmerLoading(); // Remove shimmer before showing content
    outputText.classList.remove('placeholder', 'error');
    
    const platform = detectAIPlatform();
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    
    let html = '<div class="smart-followups-container">';
    
    if (platform !== 'unknown') {
        html += `
            <div class="platform-indicator">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                </svg>
                <span>Analyzing ${platformName} conversation</span>
            </div>
        `;
    }
    
    if (data.analysis) {
        html += `<div class="analysis-insight">${data.analysis}</div>`;
    }
    
    data.questions.forEach((question, index) => {
        html += `
            <div class="followup-card">
                <div class="followup-question">${question.text}</div>
                <button class="followup-copy-btn" data-question="${question.text.replace(/"/g, '&quot;')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    </svg>
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    outputText.innerHTML = html;
    
    document.querySelectorAll('.followup-copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const question = btn.dataset.question;
            try {
                await navigator.clipboard.writeText(question);
                btn.classList.add('copied');
                
                btn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        </svg>
                    `;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    });
}

// Display smart actions (SIMPLIFIED to match followups style)
function displaySmartActions(data) {
    hideShimmerLoading(); // Remove shimmer before showing content
    outputText.classList.remove('placeholder', 'error');
    
    const platform = detectAIPlatform();
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    
    let html = '<div class="smart-actions-container">';
    
    if (platform !== 'unknown') {
        html += `
            <div class="platform-indicator">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="12" cy="1" r="1"></circle>
                    <circle cx="12" cy="23" r="1"></circle>
                </svg>
                <span>Generating ${platformName} action prompts</span>
            </div>
        `;
    }
    
    if (data.analysis) {
        html += `<div class="analysis-insight">${data.analysis}</div>`;
    }
    
    // Handle both old format (actions) and new format (action_prompts) for compatibility
    const prompts = data.action_prompts || data.actions || [];
    
    prompts.forEach((item, index) => {
        // Get prompt text - handle both old and new format
        const promptText = item.prompt || item.action || '';
        
        html += `
            <div class="action-card">
                <div class="action-prompt">${promptText}</div>
                <button class="action-copy-btn" data-prompt="${promptText.replace(/"/g, '&quot;')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    </svg>
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    outputText.innerHTML = html;
    
    // Add copy functionality for action prompts
    document.querySelectorAll('.action-copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const prompt = btn.dataset.prompt;
            try {
                await navigator.clipboard.writeText(prompt);
                btn.classList.add('copied');
                
                btn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        </svg>
                    `;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    });
}

// Display smart enhancements
function displaySmartEnhancements(data) {
    hideShimmerLoading(); // Remove shimmer before showing content
    outputText.classList.remove('placeholder', 'error');
    
    let html = '<div class="enhancement-container">';
    
    // Show analysis if available
    if (data.content_analysis) {
        const analysis = data.content_analysis;
        html += '<div class="content-analysis">';
        html += '<div class="analysis-header">📋 Content Analysis</div>';
        html += '<div class="analysis-details">';
        if (analysis.type) {
            html += '<strong>Type:</strong> ' + escapeHtml(analysis.type) + '<br>';
        }
        if (analysis.purpose) {
            html += '<strong>Purpose:</strong> ' + escapeHtml(analysis.purpose) + '<br>';
        }
        if (analysis.current_quality) {
            html += '<strong>Assessment:</strong> ' + escapeHtml(analysis.current_quality);
        }
        html += '</div></div>';
    }
    
    // Show enhancement prompts
    if (data.enhancement_prompts && data.enhancement_prompts.length > 0) {
        html += '<div class="enhancements-header">✨ Enhancement Prompts</div>';
        
        data.enhancement_prompts.forEach((enhancement, index) => {
            const priorityIcon = enhancement.priority === 'high' ? '🔥' : 
                                enhancement.priority === 'medium' ? '⭐' : '💡';
            
            html += '<div class="enhancement-card">';
            html += '<div class="enhancement-header">';
            html += '<span class="priority-icon">' + priorityIcon + '</span>';
            html += '<span class="focus-area">' + escapeHtml(enhancement.focus_area || 'Enhancement') + '</span>';
            html += '<span class="priority-badge priority-' + (enhancement.priority || 'medium') + '">' + (enhancement.priority || 'medium') + '</span>';
            html += '</div>';
            html += '<div class="enhancement-prompt">' + escapeHtml(enhancement.prompt || '') + '</div>';
            html += '<div class="enhancement-impact">' + escapeHtml(enhancement.expected_impact || '') + '</div>';
            html += '<button class="enhancement-copy-btn" data-prompt="' + escapeHtml(enhancement.prompt || '') + '">';
            html += 'Copy Prompt';
            html += '</button>';
            html += '</div>';
        });
    }
    
    html += '</div>';
    outputText.innerHTML = html;
    
    // Add copy functionality for enhancement prompts
    document.querySelectorAll('.enhancement-copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const prompt = btn.dataset.prompt;
            try {
                await navigator.clipboard.writeText(prompt);
                btn.classList.add('copied');
                btn.textContent = 'Copied!';
                
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.textContent = 'Copy Prompt';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy enhancement prompt:', err);
                btn.textContent = 'Copy Failed';
                setTimeout(() => {
                    btn.textContent = 'Copy Prompt';
                }, 1000);
            }
        });
    });
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Smart Enhancements handler
async function handleSmartEnhancements(text) {
    const creditCheck = await checkCredits('smart_enhancements');
    if (!creditCheck.success) {
        showError(creditCheck.message || "Please check your account status.");
        return;
    }

    try {
        console.log('=== SMART ENHANCEMENTS DEBUG ===');
        console.log('Input text:', text);
        
        // Update loading message (container already visible)
        showShimmerLoading('Analyzing content...');
        
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'smart_enhancements',
                data: {
                    text: text
                }
            }, response => {
                if (chrome.runtime.lastError) {
                    console.error('Chrome runtime error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    console.log('Raw response received:', response);
                    resolve(response);
                }
            });
        });

        console.log('Response success:', response?.success);
        console.log('Response data available:', !!response?.data);

        // Enhanced response validation
        if (!response) {
            throw new Error('No response received from background script');
        }

        if (!response.success) {
            const errorMsg = response.error || 'Unknown error occurred';
            console.error('Background script reported failure:', errorMsg);
            throw new Error(errorMsg);
        }

        if (!response.data) {
            console.error('Response successful but no data provided');
            throw new Error('No data received in response');
        }

        if (!response.data.enhancement_prompts) {
            console.error('Response data missing enhancement_prompts field');
            console.log('Available data fields:', Object.keys(response.data));
            throw new Error('No enhancement prompts found in response');
        }

        // Success - update output
        console.log('SUCCESS: Smart enhancements generated successfully');
        console.log('Model used:', response.data.model_used);
        console.log('GPT-4.1 used:', response.data.gpt_4_1_used);
        
        displaySmartEnhancements(response.data);
        
        // Show success indicator briefly
        if (response.data.gpt_4_1_used) {
            console.log('✅ GPT-4.1 analysis completed');
        } else {
            console.log('⚡ GPT-4o analysis completed');
        }
        
    } catch (error) {
        console.error('Smart enhancements error:', error);
        
        // Enhanced error messages for users
        let userErrorMessage = 'Failed to generate enhancement suggestions';
        
        if (error.message.includes('timeout')) {
            userErrorMessage = 'Enhancement analysis timed out. Please try with shorter text.';
        } else if (error.message.includes('Network error')) {
            userErrorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('No response')) {
            userErrorMessage = 'Connection issue. Please try again.';
        } else if (error.message.length > 0) {
            userErrorMessage = `Failed to generate enhancements: ${error.message}`;
        }
        
        showError(userErrorMessage);
    }
}

// Persona Generation handler
async function handlePersonaGeneration(text) {
    try {
        console.log('=== PERSONA GENERATION DEBUG ===');
        console.log('Input text:', text);
        
        // Show shimmer loading message
        showShimmerLoading('Creating persona...');
        
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'enhance_text',
                data: {
                    topic: text,
                    mode: 'persona_generator'
                }
            }, response => {
                if (chrome.runtime.lastError) {
                    console.error('Chrome runtime error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    console.log('Raw response received:', response);
                    resolve(response);
                }
            });
        });

        console.log('Response success:', response?.success);
        console.log('Response data available:', !!response?.data);

        // Enhanced response validation
        if (!response) {
            throw new Error('No response received from background script');
        }

        if (!response.success) {
            const errorMsg = response.error || 'Unknown error occurred';
            console.error('Background script reported failure:', errorMsg);
            throw new Error(errorMsg);
        }

        if (!response.data) {
            console.error('Response successful but no data provided');
            throw new Error('No data received in response');
        }

        if (!response.data.prompt) {
            console.error('Response data missing prompt field');
            console.log('Available data fields:', Object.keys(response.data));
            throw new Error('No persona prompt found in response');
        }

        // Success - update output
        console.log('SUCCESS: Persona generated successfully');
        console.log('AI analyzed:', response.data.metadata?.ai_analyzed);
        console.log('Fallback used:', response.data.metadata?.fallback_used);
        
        updateOutput(response.data.prompt);
        
        // Show success indicator briefly
        if (response.data.metadata?.ai_analyzed) {
            console.log('✅ AI-powered analysis completed');
        } else if (response.data.metadata?.fallback_used) {
            console.log('⚠️ Fallback analysis used (AI analysis failed)');
        }
        
    } catch (error) {
        console.error('Persona generation error:', error);
        
        // Enhanced error messages for users
        let userErrorMessage = 'Failed to generate persona';
        
        if (error.message.includes('timeout')) {
            userErrorMessage = 'Persona generation timed out. Please try a simpler role name.';
        } else if (error.message.includes('Network error')) {
            userErrorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('No response')) {
            userErrorMessage = 'Connection issue. Please try again.';
        } else if (error.message.length > 0) {
            userErrorMessage = `Failed to generate persona: ${error.message}`;
        }
        
        showError(userErrorMessage);
    }
}

function formatStructuredOutput(text, mode) {
    // Removed cot, tot, meta formatting since these modes are removed
    return text;
}

function showError(message) {
    hideShimmerLoading(); // Remove shimmer before showing error
    outputText.classList.add('error');
    outputText.textContent = message;
}

function updateOutput(text) {
    hideShimmerLoading(); // Remove shimmer before showing output
    outputText.classList.remove('placeholder');
    outputText.textContent = text;
}

function isImage(element) {
    return element.tagName === 'IMG' && element.src;
}

async function processSelectedText(text) {
    if (!text.trim()) return;
    
    // SHOW UI IMMEDIATELY (no lag for user)
    const buttonRect = button.getBoundingClientRect();
    showShimmerLoading('Processing...');
    solthronContainer.style.display = 'block';
    solthronContainer.style.pointerEvents = 'auto';
    positionContainer(buttonRect);
    
    if (selectedMode.startsWith('save_')) {
        button.querySelector('.solthron-button').textContent = '...';
        let saveFunction;
        
        if (selectedMode === 'save_note') {
            saveFunction = saveNote;
        } else if (selectedMode === 'save_prompt') {
            saveFunction = savePrompt;
        } else if (selectedMode === 'save_persona') {
            saveFunction = savePersona;
        }
        
        if (await saveFunction(text)) {
            button.querySelector('.solthron-button').textContent = '✓';
            setTimeout(() => {
                button.querySelector('.solthron-button').textContent = '➤';
                const galleryBtn = document.getElementById('gallery-btn');
                if (galleryBtn) galleryBtn.click();
            }, 1000);
        }
        return;
    }

    if (selectedMode.startsWith('image_')) return;

    // Handle smart enhancements
    if (selectedMode === 'smart_enhancements') {
        await handleSmartEnhancements(text);
        return;
    }

    // THEN check credits (user already sees loading)
    const creditCheck = await checkCredits(selectedMode);
    if (!creditCheck.success) {
        showError(creditCheck.message || "Please check your account status.");
        return;
    }

    handleTextProcessing(text);
}

async function handleTextProcessing(text) {
    const galleryView = document.getElementById('gallery-view');
    const outputContainer = document.querySelector('.output-container');
    
    if (galleryView.style.display === 'block') {
        galleryView.style.display = 'none';
        outputContainer.style.display = 'block';
        document.getElementById('gallery-btn').querySelector('svg').style.stroke = 'currentColor';
    }

    // Show shimmer loading with appropriate message
    showShimmerLoading('Processing...');

    if (selectedMode === 'persona_generator') {
        await handlePersonaGeneration(text);
        return;
    }

    // FIXED: Convert features using background script (like other working features)
if (selectedMode.startsWith('convert_')) {
    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'enhance_text',  // Use the same type as working features
                data: {
                    topic: text,
                    mode: selectedMode,
                    tone: 'professional',
                    length: selectedMode === 'convert_concise' ? 'concise' :
                           selectedMode === 'convert_detailed' ? 'detailed' : 'balanced'
                }
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });

        if (response && response.success) {
            updateOutput(response.data.prompt);
        } else {
            throw new Error(response?.error || 'Failed to convert text');
        }
        return;
    } catch (error) {
        console.error('Convert error:', error);
        showError(error.message || 'Failed to convert text');
        return;
    }
}

// FIXED: Explain features using background script (like other working features)
if (selectedMode.startsWith('explain_')) {
    showShimmerLoading('Processing...');
    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'enhance_text',  // Use the same type as working features
                data: {
                    topic: text,
                    mode: selectedMode,
                    tone: 'professional',
                    length: 'balanced'
                }
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });

        if (response && response.success) {
            updateOutput(response.data.prompt || response.data.explanation);
        } else {
            throw new Error(response?.error || 'Failed to process text');
        }
        return;
    } catch (error) {
        console.error('Explain error:', error);
        showError(error.message || 'Failed to process text');
        return;
    }
}

    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'enhance_text',
                data: {
                    topic: text,
                    tone: selectedMode.includes('technical') ? 'technical' : 
                          selectedMode.includes('casual') ? 'casual' : 
                          selectedMode.includes('professional') ? 'professional' : 
                          detectTone(text),
                    length: selectedMode.includes('concise') ? 'concise' :
                           selectedMode.includes('detailed') ? 'detailed' : 
                           selectedMode.includes('balanced') ? 'balanced' : 'balanced',
                    mode: selectedMode.startsWith('convert_') ? 'convert_prompt' : selectedMode
                }
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });

        if (response && response.success) {
            let formattedOutput = response.data.prompt;
            updateOutput(formattedOutput);
            solthronContainer.style.display = 'block';
        } else {
            showError('Failed to process text');
        }
    } catch (error) {
        showError('Error processing text');
    } finally {
        button.querySelector('.solthron-button').textContent = '➤';
    }
}

function createUI() {
    button = document.createElement('div');
    button.id = 'solthron-floating-button';
    button.innerHTML = `<button class="solthron-button">➤</button>`;
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.right = '20px';
    button.style.zIndex = '10000';

    const container = document.createElement('div');
    container.innerHTML = `
        <div id="solthron-container" class="solthron-container">
            <div class="solthron-content">
                <div class="solthron-header">
                   <div class="mode-dropdown">
    <select class="mode-select">
        <optgroup label="Text Processing">
            <option value="reframe_casual">Reframe as Casual</option>
            <option value="reframe_technical">Reframe as Technical</option>
            <option value="reframe_professional">Reframe as Professional</option>
            <option value="reframe_eli5">Reframe for a 5 Year Old</option>
            <option value="reframe_short">Reframe as Short</option>
            <option value="reframe_long">Reframe as Long</option>
        </optgroup>
        <optgroup label="Convert into Prompt">
            <option value="convert_concise">Convert to Concise Prompt</option>
            <option value="convert_balanced">Convert to Balanced Prompt</option>
            <option value="convert_detailed">Convert to Detailed Prompt</option>
       </optgroup>
        <optgroup label="Persona Generator">
            <option value="persona_generator">Generate AI Persona</option>
        </optgroup>
        <optgroup label="Storage">
            <option value="save_note">Save as Notes</option>
            <option value="save_prompt">Save as Prompt</option>
            <option value="save_persona">Save Persona</option>
        </optgroup>
        <optgroup label="Image">
            <option value="image_prompt">Image to Prompt</option>
            <option value="image_caption">Image to Caption</option>
        </optgroup>
        <optgroup label="Explain">
            <option value="explain_meaning">Explain Meaning</option>
            <option value="explain_story">Explain with a Story</option>
            <option value="explain_eli5">Explain to a 5 Year Old</option>
        </optgroup>
        <optgroup label="AI Assistant">
            <option value="smart_followups">Smart Follow-ups</option>
            <option value="smart_actions">Smart Actions</option>
            <option value="smart_enhancements">Smart Enhancements</option>
        </optgroup>
    </select>
</div>
                    <div class="header-icons">
    <button id="profile-btn" class="icon-button">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
    </svg>
    </button>
    <button id="gallery-btn" class="icon-button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
    </button>
    <button id="copy-btn" class="icon-button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        </svg>
    </button>
    <button id="close-btn" class="icon-button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    </button>
</div>
</div>
<div class="output-container">
    <div id="output-text" class="output-text placeholder">
        Please highlight text or right-click an image to begin...
    </div>
</div>
<div id="gallery-view" class="gallery-view" style="display: none;">
    <div id="category-selection" class="category-selection">
        <div class="category-item" data-category="prompts">
            <div class="category-title">Prompts</div>
        </div>
        <div class="category-item" data-category="notes">
            <div class="category-title">Notes</div>
        </div>
        <div class="category-item" data-category="personas">
            <div class="category-title">Personas</div>
        </div>
    </div>
    <div id="gallery-content" style="display: none;">
        <div class="gallery-header">
            <div class="gallery-title-row">
                <h3 id="gallery-title">Saved Items</h3>
                <button class="back-to-categories">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5"/>
                        <path d="M12 19l-7-7 7-7"/>
                    </svg>
                </button>
            </div>
            <div class="gallery-search">
                <input type="text" placeholder="Search..." id="gallery-search">
            </div>
        </div>
        <div class="gallery-list" id="gallery-list"></div>
    </div>
</div>
<div id="profile-view" class="profile-view" style="display: none;">
    <div class="profile-header">
        <h3>Account</h3>
        <button class="close-profile">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    </div>
    <div id="login-container" class="login-form">
        <div class="login-prompt">
            <p>Login to access premium features and credit management.</p>
            <button id="login-button" class="login-button">Login via Solthron.com</button>
        </div>
        <div id="login-error" class="error-message"></div>
        <div class="signup-link">
            <p>Don't have an account?</p>
            <a href="https://solthron.com/signup" target="_blank">Sign up</a>
        </div>
    </div>
    <div id="profile-details" class="profile-details" style="display: none;">
        <!-- Will show user details when logged in -->
    </div>
</div>
</div>
</div>
`;

    document.body.appendChild(button);
    document.body.appendChild(container);
    
    solthronContainer = container.querySelector('#solthron-container');
    outputText = container.querySelector('#output-text');
    initializeUIHandlers(button, container);
    initializeGallery();
}

function initializeGallery() {
    const galleryBtn = document.getElementById('gallery-btn');
    const galleryView = document.getElementById('gallery-view');
    const categorySelection = document.getElementById('category-selection');
    const galleryContent = document.getElementById('gallery-content');
    const searchInput = document.getElementById('gallery-search');
    const outputContainer = document.querySelector('.output-container');
 
    galleryBtn.addEventListener('click', () => {
        const isVisible = galleryView.style.display !== 'none';
        galleryView.style.display = isVisible ? 'none' : 'block';
        outputContainer.style.display = isVisible ? 'block' : 'none';
        galleryBtn.querySelector('svg').style.stroke = isVisible ? 'currentColor' : '#00ff00';
        
        if (!isVisible) {
            categorySelection.style.display = 'block';
            galleryContent.style.display = 'none';
            currentCategory = null;
        }
    });
 
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', async () => {
            currentCategory = item.dataset.category;
            categorySelection.style.display = 'none';
            galleryContent.style.display = 'block';
            
            const galleryTitle = document.getElementById('gallery-title');
            galleryTitle.textContent = currentCategory === 'prompts' ? 'Saved Prompts' : 
                                     currentCategory === 'notes' ? 'Saved Notes' : 
                                     'Persona Templates';
            
            const items = await (
                currentCategory === 'prompts' ? loadPrompts() :
                currentCategory === 'notes' ? loadNotes() :
                loadPersonaTemplates()
            );
            renderGalleryList(items, '');
        });
    });
 
    document.querySelector('.back-to-categories').addEventListener('click', () => {
        categorySelection.style.display = 'block';
        galleryContent.style.display = 'none';
        currentCategory = null;
    });
 
    searchInput.addEventListener('input', async (e) => {
        if (!currentCategory) return;
        const items = await (
            currentCategory === 'prompts' ? loadPrompts() :
            currentCategory === 'notes' ? loadNotes() :
            loadPersonaTemplates()
        );
        renderGalleryList(items, e.target.value);
    });
}

function renderGalleryList(items, searchTerm = '') {
    const galleryList = document.getElementById('gallery-list');
    const filteredItems = searchTerm ? 
        items.filter(item => {
            if (currentCategory === 'personas') {
                return item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.prompt.toLowerCase().includes(searchTerm.toLowerCase());
            }
            return item.text.toLowerCase().includes(searchTerm.toLowerCase());
        }) : items;
 
    galleryList.innerHTML = filteredItems.map(item => {
        if (currentCategory === 'personas') {
            return `
                <div class="gallery-item" data-id="${item.id}">
                    <div class="gallery-item-text">${item.title}</div>
                    <div class="gallery-item-actions">
                        <button class="gallery-copy-btn" data-id="${item.id}" data-type="persona">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                            </svg>
                        </button>
                        ${item.source !== 'built_in' ? `
                            <button class="gallery-delete-btn" data-id="${item.id}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }
 
        return `
            <div class="gallery-item" data-id="${item.id}">
                <div class="gallery-item-text">${item.text?.substring(0, 100)}${item.text?.length > 100 ? '...' : ''}</div>
                <div class="gallery-item-actions">
                    ${currentCategory === 'notes' ? `
                        <button class="gallery-star-btn ${activeNoteId === item.id ? 'active' : ''}" data-id="${item.id}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="${activeNoteId === item.id ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                        </button>
                    ` : ''}
                    <button class="gallery-copy-btn" data-id="${item.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        </svg>
                    </button>
                    <button class="gallery-delete-btn" data-id="${item.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
 
    attachGalleryEventListeners(galleryList);
 }

function attachGalleryEventListeners(galleryList) {
   galleryList.querySelectorAll('.gallery-item').forEach(item => {
       item.addEventListener('click', async (e) => {
           if (!e.target.closest('button')) {
               const itemId = item.dataset.id;
               const items = await (
                   currentCategory === 'prompts' ? loadPrompts() :
                   currentCategory === 'notes' ? loadNotes() :
                   loadPersonaTemplates()
               );
               const selectedItem = items.find(i => i.id === itemId);
               if (selectedItem) {
                   if (currentCategory === 'personas') {
                       outputText.textContent = `Title: ${selectedItem.title}\n\nPrompt: ${selectedItem.prompt}\n\nExample: ${selectedItem.example}\n\nResponse: ${selectedItem.response}`;
                   } else {
                       outputText.textContent = selectedItem.text;
                   }
                   document.getElementById('gallery-view').style.display = 'none';
                   outputText.classList.remove('placeholder');
                   document.querySelector('.output-container').style.display = 'block';
                   document.getElementById('gallery-btn').querySelector('svg').style.stroke = 'currentColor';
               }
           }
       });
   });

   galleryList.querySelectorAll('.gallery-copy-btn').forEach(btn => {
       btn.addEventListener('click', async (e) => {
           e.stopPropagation();
           const itemId = btn.dataset.id;
           const items = await (
               currentCategory === 'prompts' ? loadPrompts() :
               currentCategory === 'notes' ? loadNotes() :
               loadPersonaTemplates()
           );
           const selectedItem = items.find(i => i.id === itemId);
           if (selectedItem) {
               const textToCopy = currentCategory === 'personas' ?
                   `${selectedItem.prompt}` :
                   selectedItem.text;
                   
               await navigator.clipboard.writeText(textToCopy);
               btn.classList.add('copied');
               setTimeout(() => btn.classList.remove('copied'), 1000);
           }
       });
   });

   if (currentCategory === 'notes') {
       galleryList.querySelectorAll('.gallery-star-btn').forEach(btn => {
           btn.addEventListener('click', async (e) => {
               e.stopPropagation();
               const noteId = btn.dataset.id;
               
               if (activeNoteId === noteId) {
                   activeNoteId = null;
                   isStarActive = false;
                   btn.querySelector('svg').setAttribute('fill', 'none');
                   btn.classList.remove('active');
               } else {
                   const prevStar = galleryList.querySelector('.gallery-star-btn.active');
                   if (prevStar) {
                       prevStar.querySelector('svg').setAttribute('fill', 'none');
                       prevStar.classList.remove('active');
                   }
                   
                   activeNoteId = noteId;
                   isStarActive = true;
                   btn.querySelector('svg').setAttribute('fill', 'currentColor');
                   btn.classList.add('active');
               }
           });
       });
   }

   galleryList.querySelectorAll('.gallery-delete-btn').forEach(btn => {
       btn.addEventListener('click', async (e) => {
           e.stopPropagation();
           const itemId = btn.dataset.id;
           
           let deleteFunction;
           let reloadFunction;
           
           if (currentCategory === 'prompts') {
               deleteFunction = deletePrompt;
               reloadFunction = loadPrompts;
           } else if (currentCategory === 'notes') {
               deleteFunction = deleteNote;
               reloadFunction = loadNotes;
           } else if (currentCategory === 'personas') {
               deleteFunction = deletePersona;
               reloadFunction = loadPersonaTemplates;
           }
           
           if (await deleteFunction(itemId)) {
               const items = await reloadFunction();
               renderGalleryList(items, document.getElementById('gallery-search').value);
           }
       });
   });
}

function positionContainer(buttonRect) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    solthronContainer.style.width = '320px';
    solthronContainer.style.maxHeight = '400px';
    
    let leftPosition = buttonRect.right - 320;
    let topPosition = buttonRect.top - 10;
    
    if (leftPosition < 10) {
        leftPosition = 10;
    } else if (leftPosition + 320 > windowWidth - 10) {
        leftPosition = windowWidth - 330;
    }
    
    const containerHeight = 400;
    if (topPosition + containerHeight > windowHeight - 10) {
        topPosition = windowHeight - containerHeight - 10;
    }
    
    if (topPosition < 10) {
        topPosition = 10;
    }
    
    solthronContainer.style.position = 'fixed';
    solthronContainer.style.left = `${leftPosition}px`;
    solthronContainer.style.top = `${topPosition}px`;
    solthronContainer.style.zIndex = '10001';
    
    solthronContainer.style.transform = 'none';
    solthronContainer.style.opacity = '0';
    
    solthronContainer.style.transition = 'opacity 0.2s ease';
    
    requestAnimationFrame(() => {
        solthronContainer.style.opacity = '1';
    });
}

function initializeUIHandlers(buttonElement, container) {
    let isDragging = false;
    let currentX;
    let currentY;
    let clickCount = 0;
    let clickTimer = null;
    let lastResult = localStorage.getItem('solthron-last-result');

    const copyBtn = container.querySelector('#copy-btn');
    const closeBtn = container.querySelector('#close-btn');
    const modeSelect = container.querySelector('.mode-select');

    // Changed default mode from 'enhance' to 'reframe_casual' since 'enhance' was removed
    selectedMode = localStorage.getItem('solthron-mode') || 'reframe_casual';
    modeSelect.value = selectedMode;
    solthronContainer.style.display = 'none';
    
    solthronContainer.style.pointerEvents = 'none';

    if (lastResult) {
        outputText.classList.remove('placeholder');
        outputText.textContent = lastResult;
    }

    buttonElement.addEventListener('mousedown', (e) => {
        isDragging = true;
        currentX = e.clientX - buttonElement.offsetLeft;
        currentY = e.clientY - buttonElement.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            buttonElement.style.left = `${e.clientX - currentX}px`;
            buttonElement.style.top = `${e.clientY - currentY}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // ✨ MODIFIED: Button click handler with animation
    buttonElement.addEventListener('click', async (e) => {
        e.stopPropagation();
        clickCount++;

        if (clickCount === 1) {
            clickTimer = setTimeout(() => {
                clickCount = 0;
            }, 300);
        } else if (clickCount === 2) {
            clearTimeout(clickTimer);
            clickCount = 0;
            
            // ✨ NEW: Trigger the double-click animation
            triggerDoubleClickAnimation();
            
            if (!isDragging) {
                const selectedText = window.getSelection().toString().trim();

                if (!selectedText || selectedMode === 'image' || selectedMode === 'smart_followups' || selectedMode === 'smart_actions') {
                    if (lastResult && selectedMode !== 'smart_followups' && selectedMode !== 'smart_actions' && selectedMode !== 'smart_enhancements') {
                        outputText.classList.remove('placeholder');
                        outputText.textContent = lastResult;
                    } else {
                        outputText.classList.add('placeholder');
                        const placeholderMessages = {
                            image_prompt: 'Right-click an image to generate a prompt...',
                            image_caption: 'Right-click an image to generate a caption...',
                            save_note: 'Highlight text and double-click to save as note...',
                            save_prompt: 'Highlight text and double-click to save as prompt...',
                            save_persona: 'Highlight text and double-click to save as persona...',
                            smart_followups: 'Right-click on an AI chat page to generate follow-up questions...',
                            smart_actions: 'Right-click on an AI chat page to generate actionable steps...',
                            smart_enhancements: 'Highlight text and double-click to get enhancement suggestions...',
                            persona_generator: 'Highlight a keyword and double-click to generate an AI persona...',
                            default: 'Highlight text to begin...'
                        };
                        outputText.textContent = placeholderMessages[selectedMode] || placeholderMessages.default;
                    }
                    const buttonRect = buttonElement.getBoundingClientRect();
                    solthronContainer.style.pointerEvents = 'auto';
                    positionContainer(buttonRect);
                    solthronContainer.style.display = 'block';
                    return;
                }
                
                await processSelectedText(selectedText);
            }
        }
    });

    modeSelect.addEventListener('change', (e) => {
        selectedMode = e.target.value;
        localStorage.setItem('solthron-mode', selectedMode);
        outputText.classList.add('placeholder');

        const placeholderMessages = {
            image_prompt: 'Right-click an image to generate a prompt...',
            image_caption: 'Right-click an image to generate a caption...',
            save_note: 'Highlight text and double-click to save as note...',
            save_prompt: 'Highlight text and double-click to save as prompt...',
            save_persona: 'Highlight text and double-click to save as persona...',
            smart_followups: 'Right-click on an AI chat page to generate follow-up questions...',
            smart_actions: 'Right-click on an AI chat page to generate actionable steps...',
            smart_enhancements: 'Highlight text and double-click to get enhancement suggestions...',
            persona_generator: 'Highlight a keyword and double-click to generate an AI persona...',
            default: 'Highlight text to begin...'
        };

        outputText.textContent = placeholderMessages[selectedMode] || placeholderMessages.default;
        lastResult = null;
        localStorage.removeItem('solthron-last-result');
    });

    copyBtn.addEventListener('click', async () => {
        if (outputText.classList.contains('placeholder')) return;
        
        try {
            if (selectedMode === 'smart_followups' && outputText.querySelector('.smart-followups-container')) {
                const questions = Array.from(outputText.querySelectorAll('.followup-question'))
                    .map(q => q.textContent)
                    .join('\n\n');
                await navigator.clipboard.writeText(questions);
            } else if (selectedMode === 'smart_actions' && outputText.querySelector('.smart-actions-container')) {
                const prompts = Array.from(outputText.querySelectorAll('.action-prompt'))
                    .map((prompt, index) => `${index + 1}. ${prompt.textContent}`)
                    .join('\n\n');
                await navigator.clipboard.writeText(prompts);
            } else if (selectedMode === 'smart_enhancements' && outputText.querySelector('.enhancement-container')) {
                const prompts = Array.from(outputText.querySelectorAll('.enhancement-prompt'))
                    .map(p => p.textContent)
                    .join('\n\n');
                await navigator.clipboard.writeText(prompts);
            } else {
                await navigator.clipboard.writeText(outputText.textContent);
            }
            
            const checkIcon = copyBtn.querySelector('svg');
            checkIcon.style.stroke = '#00ff00';
            copyBtn.classList.add('copied');
            
            setTimeout(() => {
                solthronContainer.style.display = 'none';
                solthronContainer.style.pointerEvents = 'none';
                checkIcon.style.stroke = 'currentColor';
                copyBtn.classList.remove('copied');
            }, 1000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    });

    closeBtn.addEventListener('click', () => {
        solthronContainer.style.display = 'none';
        solthronContainer.style.pointerEvents = 'none';
    });

    document.addEventListener('click', (e) => {
        if (!solthronContainer.contains(e.target) && 
            !buttonElement.contains(e.target) && 
            solthronContainer.style.display === 'block') {
            solthronContainer.style.display = 'none';
            solthronContainer.style.pointerEvents = 'none';
        }
    });
}

// UPDATED PROFILE HANDLERS (replaces Firebase version)
function initializeProfileHandlers() {
    const profileBtn = document.getElementById('profile-btn');
    const profileView = document.getElementById('profile-view');
    const closeProfile = document.querySelector('.close-profile');
    const loginContainer = document.getElementById('login-container');
    const profileDetails = document.getElementById('profile-details');
    const loginButton = document.getElementById('login-button');
    const loginError = document.getElementById('login-error');
    
    // Check auth state on initialization
    checkAuthState();
    
    async function checkAuthState() {
        const isLoggedIn = await BackendAuth.isLoggedIn();
        updateProfileView(isLoggedIn);
    }
    
    // Profile button click handler
    profileBtn.addEventListener('click', () => {
        const galleryView = document.getElementById('gallery-view');
        const outputContainer = document.querySelector('.output-container');
        
        const isVisible = profileView.style.display !== 'none';
        
        if (isVisible) {
            profileView.style.display = 'none';
            outputContainer.style.display = 'block';
            profileBtn.querySelector('svg').style.stroke = 'currentColor';
        } else {
            galleryView.style.display = 'none';
            outputContainer.style.display = 'none';
            profileView.style.display = 'block';
            profileBtn.querySelector('svg').style.stroke = '#00ff00';
            
            checkAuthState(); // Refresh auth state when opening profile
        }
    });
    
    // Close profile handler
    closeProfile.addEventListener('click', () => {
        profileView.style.display = 'none';
        document.querySelector('.output-container').style.display = 'block';
        profileBtn.querySelector('svg').style.stroke = 'currentColor';
    });
    
    // Login button handler - redirects to website
    loginButton.addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
            // Redirect to Solthron website for login
            const extensionId = chrome.runtime.id;
            const loginUrl = `https://solthron.com/login?extension=true&extensionId=${extensionId}`;
            window.open(loginUrl, '_blank');
            
        } catch (error) {
            console.error('Login redirect error:', error);
            showLoginError('Failed to open login page');
        }
    });
    
    // Update profile view based on auth state
    async function updateProfileView(isLoggedIn = null) {
        if (isLoggedIn === null) {
            isLoggedIn = await BackendAuth.isLoggedIn();
        }
        
        if (isLoggedIn) {
            // User is logged in - show profile details
            loginContainer.style.display = 'none';
            profileDetails.style.display = 'block';
            
            try {
                // Get user credits
                const credits = await BackendAuth.getUserCredits();
                
                profileDetails.innerHTML = `
                    <div class="profile-info">
                        <div class="profile-field">
                            <div class="field-label">Status</div>
                            <div class="field-value">Logged In</div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Account</div>
                            <div class="field-value">Active</div>
                        </div>
                        <div class="profile-field credits">
                            <div class="field-label">Available Credits</div>
                            <div class="field-value">${credits}</div>
                        </div>
                    </div>
                    <button class="logout-button" id="logout-btn">Logout</button>
                `;
                
                // Add logout handler
                document.getElementById('logout-btn').addEventListener('click', async () => {
                    try {
                        await BackendAuth.logout();
                        updateProfileView(false);
                    } catch (error) {
                        console.error('Logout error:', error);
                    }
                });
                
            } catch (error) {
                console.error('Error loading profile:', error);
                profileDetails.innerHTML = `
                    <div class="profile-info">
                        <div class="profile-field">
                            <div class="field-label">Status</div>
                            <div class="field-value">Logged In</div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Account</div>
                            <div class="field-value">Error loading profile data</div>
                        </div>
                    </div>
                    <button class="logout-button" id="logout-btn">Logout</button>
                `;
                
                document.getElementById('logout-btn').addEventListener('click', async () => {
                    try {
                        await BackendAuth.logout();
                        updateProfileView(false);
                    } catch (error) {
                        console.error('Logout error:', error);
                    }
                });
            }
        } else {
            // User is not logged in - show login form
            loginContainer.style.display = 'block';
            profileDetails.style.display = 'none';
            clearLoginError();
        }
    }
    
    // Helper functions
    function showLoginError(message) {
        const loginError = document.getElementById('login-error');
        if (loginError) {
            loginError.textContent = message;
            loginError.style.display = 'block';
        }
    }
    
    function clearLoginError() {
        const loginError = document.getElementById('login-error');
        if (loginError) {
            loginError.textContent = '';
            loginError.style.display = 'none';
        }
    }
}

createUI();
initializeProfileHandlers();

// Context menu handlers (right-click functionality)
document.addEventListener('contextmenu', async (e) => {
    const target = e.target;
    
    if (isImage(target) && selectedMode.startsWith('image_')) {
        e.preventDefault();
        showShimmerLoading('Processing image...');
        solthronContainer.style.display = 'block';
        solthronContainer.style.pointerEvents = 'auto';
        await processImage(target);
        return;
    }
    
    if (selectedMode === 'smart_followups') {
        const platform = detectAIPlatform();
        
        if (platform === 'unknown') {
            return;
        }
        
        e.preventDefault();
        
        const conversation = extractConversation();
        console.log("=== DEBUG: EXTRACTED CONVERSATION ===");
        console.log(conversation);
        console.log("=== END DEBUG ===");
        
        if (!conversation || conversation === 'Unable to extract conversation from this page.') {
            showError('Unable to extract conversation. Please ensure there is a conversation visible on the page.');
            solthronContainer.style.display = 'block';
            solthronContainer.style.pointerEvents = 'auto';
            const buttonRect = button.getBoundingClientRect();
            positionContainer(buttonRect);
            return;
        }
        
        showShimmerLoading('Generating followups...');
        solthronContainer.style.display = 'block';
        solthronContainer.style.pointerEvents = 'auto';
        const buttonRect = button.getBoundingClientRect();
        positionContainer(buttonRect);
        
        const creditCheck = await checkCredits('smart_followups');
        if (!creditCheck.success) {
            showError(creditCheck.message || "Please check your account status.");
            return;
        }
        
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'smart_followups',
                    data: {
                        conversation: conversation,
                        platform: platform
                    }
                }, response => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            });
            
            if (response && response.success && response.data) {
                if (response.data.questions && Array.isArray(response.data.questions)) {
                    displaySmartFollowups(response.data);
                } else if (response.data.success && response.data.questions) {
                    displaySmartFollowups(response.data);
                } else {
                    showError('Invalid response format from smart followups service');
                }
            } else {
                const errorMsg = response?.error || response?.data?.error || 'Unknown error occurred';
                showError('Failed to generate follow-up questions: ' + errorMsg);
            }
        } catch (error) {
            console.error('Smart followups error:', error);
            showError('Error analyzing conversation: ' + error.message);
        }
    }

    // Handle Smart Actions
    if (selectedMode === 'smart_actions') {
        const platform = detectAIPlatform();
        
        if (platform === 'unknown') {
            return;
        }
        
        e.preventDefault();
        
        const conversation = extractConversation();
        console.log("=== DEBUG: SMART ACTIONS CONVERSATION ===");
        console.log(conversation);
        console.log("=== END DEBUG ===");
        
        if (!conversation || conversation === 'Unable to extract conversation from this page.') {
            showError('Unable to extract conversation. Please ensure there is a conversation visible on the page.');
            solthronContainer.style.display = 'block';
            solthronContainer.style.pointerEvents = 'auto';
            const buttonRect = button.getBoundingClientRect();
            positionContainer(buttonRect);
            return;
        }
        
        showShimmerLoading('Generating actions...');
        solthronContainer.style.display = 'block';
        solthronContainer.style.pointerEvents = 'auto';
        const buttonRect = button.getBoundingClientRect();
        positionContainer(buttonRect);
        
        const creditCheck = await checkCredits('smart_actions');
        if (!creditCheck.success) {
            showError(creditCheck.message || "Please check your account status.");
            return;
        }
        
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'smart_actions',
                    data: {
                        conversation: conversation,
                        platform: platform
                    }
                }, response => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            });
            
            if (response && response.success && response.data) {
                if (response.data.action_prompts && Array.isArray(response.data.action_prompts)) {
                    displaySmartActions(response.data);
                } else if (response.data.success && response.data.action_prompts) {
                    displaySmartActions(response.data);
                } else {
                    showError('Invalid response format from smart actions service');
                }
            } else {
                const errorMsg = response?.error || response?.data?.error || 'Unknown error occurred';
                showError('Failed to generate action prompts: ' + errorMsg);
            }
        } catch (error) {
            console.error('Smart actions error:', error);
            showError('Error analyzing conversation: ' + error.message);
        }
    }
});

async function processImage(img) {
    if (!img.src) return;

    const creditCheck = await checkCredits(selectedMode);
    if (!creditCheck.success) {
        showError(creditCheck.message || "Please check your account status.");
        return;
    }

    try {
        const response = await fetch(img.src);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64Image = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        const apiResponse = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'process_image',
                data: {
                    imageUrl: base64Image,
                    mode: selectedMode
                }
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });

        if (apiResponse && apiResponse.success) {
            updateOutput(apiResponse.data.prompt);
        } else {
            throw new Error('Failed to process image');
        }
    } catch (error) {
        showError('Error processing image');
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleExtension") {
        isButtonVisible = !isButtonVisible;
        
        button.style.display = isButtonVisible ? 'block' : 'none';
        
        if (!isButtonVisible && solthronContainer.style.display === 'block') {
            solthronContainer.style.display = 'none';
            solthronContainer.style.pointerEvents = 'none';
        }
        
        sendResponse({success: true});
        return true;
    }
    
    // NEW: Handle auth token from website
    if (request.action === "setAuthToken" && request.token) {
        BackendAuth.setAuthToken(request.token).then(() => {
            pageCredits = null; // Clear credit cache to refresh
            sendResponse({success: true});
        }).catch((error) => {
            console.error('Error setting auth token:', error);
            sendResponse({success: false});
        });
        return true;
    }
    
    return false;
});

// Export BackendAuth for external access if needed
window.solthronAuth = BackendAuth;

console.log('🔗 Solthron Login Bridge loaded');

function detectAndForwardToken() {
    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token') || urlParams.get('auth_token') || urlParams.get('jwt');
    
    if (urlToken) {
        console.log('🔗 Found token in URL');
        forwardTokenToExtension(urlToken, 'url_parameter');
        return true;
    }
    
    // Check localStorage for various token keys
    const storageKeys = ['authToken', 'auth_token', 'jwt_token', 'solthron_token'];
    for (const key of storageKeys) {
        const token = localStorage.getItem(key);
        if (token && token.length > 20) {
            console.log('💾 Found token in localStorage:', key);
            forwardTokenToExtension(token, `localStorage_${key}`);
            return true;
        }
    }
    
    // Check for Firebase auth data
    const firebaseKeys = Object.keys(localStorage).filter(key => 
        key.includes('firebase') || key.includes('Auth')
    );
    
    for (const key of firebaseKeys) {
        try {
            const value = localStorage.getItem(key);
            if (value && value.startsWith('{')) {
                const data = JSON.parse(value);
                if (data.stsTokenManager?.accessToken) {
                    console.log('🔥 Found Firebase access token');
                    forwardTokenToExtension(data.stsTokenManager.accessToken, 'firebase_storage');
                    return true;
                }
            }
        } catch (e) {
            // Not JSON, continue
        }
    }
    
    return false;
}

function forwardTokenToExtension(token, source) {
    if (!token || token === 'undefined' || token.length < 20) {
        console.log('❌ Invalid token, not forwarding');
        return;
    }
    
    try {
        window.postMessage({
            type: 'SOLTHRON_AUTH_SUCCESS',
            token: token,
            timestamp: Date.now(),
            source: source
        }, '*');
        
        console.log('✅ Token forwarded to extension from:', source);
        showLoginFeedback(source);
        
    } catch (error) {
        console.error('❌ Error forwarding token:', error);
    }
}

function showLoginFeedback(source) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: #4CAF50; color: white; padding: 15px 20px;
        border-radius: 8px; z-index: 10000; font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    feedback.innerHTML = `✅ Extension login successful!<br><small>Source: ${source}</small>`;
    document.body.appendChild(feedback);
    
    setTimeout(() => feedback.remove(), 5000);
}

// Watch localStorage changes to catch Firebase auth updates
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    
    if (key.toLowerCase().includes('token') && value && value.length > 20) {
        console.log('📱 Token updated in localStorage:', key);
        setTimeout(() => detectAndForwardToken(), 500);
    }
    
    // Watch for Firebase auth data
    if ((key.includes('firebase') || key.includes('Auth')) && value) {
        console.log('🔥 Firebase data updated:', key);
        setTimeout(() => detectAndForwardToken(), 500);
    }
};

// Initialize token detection
function initialize() {
    console.log('🚀 Initializing login bridge...');
    
    if (detectAndForwardToken()) {
        console.log('✅ Token found immediately');
        return;
    }
    
    // Retry detection after delays (for async auth)
    setTimeout(detectAndForwardToken, 2000);
    setTimeout(detectAndForwardToken, 5000);
}

// Start when page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Test function for manual testing
window.testExtensionAuth = function(token) {
    console.log('🧪 Manual test triggered');
    if (token) {
        forwardTokenToExtension(token, 'manual_test');
    } else {
        detectAndForwardToken();
    }
};

// ===== EXTENSION AUTH TOKEN RECEIVER =====
// Add this to the END of your existing content.js file

window.addEventListener('message', async (event) => {
    // Only accept messages from Solthron domains
    if (event.origin !== 'https://solthron.com' && 
        event.origin !== 'https://www.solthron.com') {
        return;
    }
    
    if (event.data.type === 'SOLTHRON_AUTH_SUCCESS' && event.data.token) {
        console.log('🔐 Received auth token from website');
        console.log('📍 Token source:', event.data.source);
        
        try {
            const success = await BackendAuth.setAuthToken(event.data.token);
            if (success) {
                console.log('✅ Auth token stored successfully');
                pageCredits = null; // Clear credit cache to refresh
                
                // Show success notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px;
                    background: #4CAF50; color: white; padding: 12px 20px;
                    border-radius: 8px; z-index: 20000; font-weight: bold;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                `;
                notification.textContent = '🎉 Successfully logged in to Solthron Extension!';
                document.body.appendChild(notification);
                
                setTimeout(() => notification.remove(), 4000);
                
                // Update profile view if it's open
                const profileView = document.getElementById('profile-view');
                if (profileView && profileView.style.display !== 'none') {
                    // Trigger profile refresh (you may need to call your profile update function)
                    console.log('🔄 Profile view is open, should refresh');
                }
                
            } else {
                console.error('❌ Failed to store auth token');
            }
        } catch (error) {
            console.error('💥 Auth token storage error:', error);
        }
    }
});

// Debug function for testing
window.solthronDebug = {
    checkAuth: async function() {
        const hasToken = await BackendAuth.getAuthToken();
        const isLoggedIn = await BackendAuth.isLoggedIn();
        const credits = await BackendAuth.getUserCredits();
        
        console.log('🔍 Auth Debug Info:');
        console.log('Has Token:', !!hasToken);
        console.log('Is Logged In:', isLoggedIn);
        console.log('Credits:', credits);
        
        return { hasToken: !!hasToken, isLoggedIn, credits };
    },
    
    clearAuth: async function() {
        await BackendAuth.logout();
        console.log('🧹 Auth cleared');
    }
};
