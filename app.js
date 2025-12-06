// Main Application Logic

class VoiceOrderKioskApp {
    constructor() {
        // Services
        this.signer = new AWSSigner();
        this.lexService = new LexService(AWS_CONFIG, this.signer);
        this.speechService = new SpeechService();
        this.ordersService = new OrdersService();

        // State
        this.conversationState = 'idle'; // idle, listening, processing, speaking, error
        this.sessionId = this.generateSessionId();
        this.conversationHistory = [];
        this.orders = [];
        this.lastBotMessage = '';
        this.audioLevel = 0;

        // DOM elements
        this.chatMessages = document.getElementById('chatMessages');
        this.ordersContainer = document.getElementById('ordersContainer');
        this.ordersEmpty = document.getElementById('ordersEmpty');
        this.clearChatBtn = document.getElementById('clearChatBtn');
        this.clearOrdersBtn = document.getElementById('clearOrdersBtn');
        this.statusText = document.getElementById('statusText');
        this.statusBadge = document.querySelector('.status-badge');
        this.configModal = document.getElementById('configModal');
        this.closeConfigBtn = document.getElementById('closeConfigBtn');

        // Bind event handlers
        this.clearChatBtn.addEventListener('click', () => this.clearConversationHistory());
        this.clearOrdersBtn.addEventListener('click', () => this.clearOrders());
        this.closeConfigBtn.addEventListener('click', () => this.hideConfigModal());
    }

    async initialize() {
        console.log('=== APP STARTED - Initializing Voice Order Kiosk ===');

        // Validate configuration
        const validation = validateConfig();
        if (!validation.isValid) {
            console.error('Configuration validation failed:', validation.missingFields);
            this.showConfigModal(validation.missingFields);
            return;
        }

        // Check speech support
        if (!this.speechService.isSupported()) {
            alert('Your browser does not support speech recognition or synthesis. Please use Chrome.');
            return;
        }

        // Start continuous listening
        await this.startContinuousListening();

        console.log('=== Initialization complete ===');
    }

    async startContinuousListening() {
        console.log('Starting continuous listening mode...');

        this.conversationState = 'listening';
        this.updateUI();

        this.speechService.startContinuousListening({
            onPartial: (text) => {
                console.log(`Partial: "${text}"`);
                this.updateStatusText('Listening...');
            },
            onFinal: (text) => {
                console.log(`Final detected: "${text}"`);
                this.handleFinalTranscript(text);
            },
            onError: (error) => {
                console.error('Speech error:', error);
                this.conversationState = 'error';
                this.updateUI();
            },
            onAudioLevel: (level) => {
                this.audioLevel = level;
                this.updateAudioVisualizer(level);
            },
            onSpeechDetected: () => {
                console.log('User started speaking');
            }
        });

        console.log('Continuous listening started successfully');
    }

    async handleFinalTranscript(text) {
        const trimmed = text.trim();
        if (!trimmed) {
            console.log('Empty transcript, skipping...');
            return;
        }

        console.log(`User said: "${trimmed}"`);

        this.conversationState = 'processing';
        this.updateStatusText('Processing...');
        this.updateUI();

        // Add user message to conversation history
        this.addMessage('user', trimmed);

        try {
            console.log(`Sending to Lex Bot (Session: ${this.sessionId})...`);
            const reply = await this.lexService.sendText(this.sessionId, trimmed);
            console.log(`Lex response received: "${reply.primaryMessage}"`);

            this.lastBotMessage = reply.primaryMessage;

            // Add bot response to conversation history
            this.addMessage('bot', reply.primaryMessage);

            // Check if Lex returned an order_id
            if (reply.sessionAttributes.order_id || reply.sessionAttributes.last_order_id) {
                const orderId = reply.sessionAttributes.order_id || reply.sessionAttributes.last_order_id;
                console.log(`Order ID detected from Lex: ${orderId}`);
                await this.fetchOrder(orderId);
            } else {
                console.log('No order_id returned from Lex');
            }

            // Speak the response
            this.speak(reply.primaryMessage);

        } catch (error) {
            console.error('Lex error:', error);
            this.conversationState = 'error';
            this.updateStatusText('Error');
            this.updateUI();

            // Restart listening after error
            setTimeout(() => {
                this.startContinuousListening();
            }, 2000);
        }
    }

    speak(message) {
        console.log('Pausing listening before speaking...');
        this.speechService.pauseListening();

        console.log(`Speaking: "${message}"`);
        this.conversationState = 'speaking';
        this.updateStatusText('Speaking...');
        this.updateUI();

        this.speechService.speak(message, {
            onStart: () => {
                console.log('TTS started');
            },
            onCompletion: () => {
                console.log('TTS completed, restarting listening...');
                this.startContinuousListening();
            },
            onError: (error) => {
                console.error('TTS error:', error);
                console.log('Skipping TTS error, restarting listening...');
                this.startContinuousListening();
            }
        });
    }

    addMessage(sender, text) {
        const message = {
            id: Date.now(),
            sender: sender,
            text: text,
            timestamp: new Date()
        };

        this.conversationHistory.push(message);
        this.renderMessage(message);
        this.scrollToBottom();

        console.log(`Added ${sender} message to conversation history. Total messages: ${this.conversationHistory.length}`);
    }

    renderMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender}`;
        messageDiv.id = `msg-${message.id}`;

        const isUser = message.sender === 'user';

        let html = '';

        if (!isUser) {
            html += `
                <div class="message-avatar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 6v6l4 2"></path>
                    </svg>
                </div>
            `;
        }

        html += `
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${isUser ? 'You' : 'Assistant'}</span>
                    <span class="message-time">${this.formatTime(message.timestamp)}</span>
                </div>
                <div class="message-bubble">
                    ${this.escapeHtml(message.text)}
                </div>
            </div>
        `;

        messageDiv.innerHTML = html;
        this.chatMessages.appendChild(messageDiv);
    }

    async fetchOrder(orderId) {
        try {
            console.log(`Fetching order ${orderId} from API...`);
            const apiOrder = await this.ordersService.fetchOrder(orderId);

            const order = this.ordersService.convertToOrder(apiOrder);

            // Check if order already exists
            const existingIndex = this.orders.findIndex(o => o.orderId === orderId);
            if (existingIndex >= 0) {
                this.orders[existingIndex] = order;
                console.log(`Updated existing order: ${orderId}`);
            } else {
                this.orders.unshift(order);
                console.log(`Added new order: ${orderId}`);
            }

            this.renderOrders();

        } catch (error) {
            console.error(`Failed to fetch order ${orderId}:`, error);
        }
    }

    renderOrders() {
        // Clear existing orders (except empty state)
        const existingOrders = this.ordersContainer.querySelectorAll('.order-card');
        existingOrders.forEach(el => el.remove());

        if (this.orders.length === 0) {
            this.ordersEmpty.style.display = 'flex';
        } else {
            this.ordersEmpty.style.display = 'none';

            this.orders.forEach(order => {
                const orderCard = this.createOrderCard(order);
                this.ordersContainer.appendChild(orderCard);
            });
        }

        this.clearOrdersBtn.disabled = this.orders.length === 0;
    }

    createOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'order-card';

        const timeStr = this.ordersService.formatTime(order.timestamp);

        card.innerHTML = `
            <div class="order-image">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
            </div>
            <div class="order-details">
                <div class="order-number">Order ${this.escapeHtml(order.orderNumber)}</div>
                <div class="order-items">${this.escapeHtml(order.items)}</div>
                <div class="order-time">${timeStr}</div>
            </div>
            <div class="order-price-section">
                <div class="order-price">${this.escapeHtml(order.price)}</div>
                ${order.isPaid ? `
                    <div class="paid-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span>Paid</span>
                    </div>
                ` : ''}
            </div>
        `;

        return card;
    }

    clearConversationHistory() {
        this.conversationHistory = [];
        this.chatMessages.innerHTML = '';
        this.sessionId = this.generateSessionId();
        console.log(`Cleared conversation history and reset session to: ${this.sessionId}`);
        this.clearChatBtn.disabled = true;
    }

    clearOrders() {
        this.orders = [];
        this.renderOrders();
        this.sessionId = this.generateSessionId();
        console.log(`Cleared all orders and reset session to: ${this.sessionId}`);
    }

    updateUI() {
        // Update clear chat button
        this.clearChatBtn.disabled = this.conversationHistory.length === 0;

        // Update status badge
        if (this.conversationState === 'listening') {
            this.statusBadge.classList.add('listening');
        } else {
            this.statusBadge.classList.remove('listening');
        }
    }

    updateStatusText(text) {
        this.statusText.textContent = text;
    }

    updateAudioVisualizer(level) {
        const bars = document.querySelectorAll('.audio-bar');
        const activeBars = Math.floor(level * bars.length);

        bars.forEach((bar, index) => {
            if (index < activeBars) {
                bar.classList.add('active');
            } else {
                bar.classList.remove('active');
            }
        });
    }

    showConfigModal(missingFields) {
        this.configModal.classList.add('active');

        // Update modal with missing field info
        document.getElementById('configBotId').textContent =
            AWS_CONFIG.LEX_BOT_ID === 'REPLACE_ME' ? 'Not set' : AWS_CONFIG.LEX_BOT_ID;
        document.getElementById('configAliasId').textContent =
            AWS_CONFIG.LEX_BOT_ALIAS_ID === 'REPLACE_ME' ? 'Not set' : AWS_CONFIG.LEX_BOT_ALIAS_ID;
        document.getElementById('configLocaleId').textContent =
            AWS_CONFIG.LEX_BOT_LOCALE_ID === 'REPLACE_ME' ? 'Not set' : AWS_CONFIG.LEX_BOT_LOCALE_ID;
        document.getElementById('configPoolId').textContent =
            AWS_CONFIG.COGNITO_IDENTITY_POOL_ID === 'REPLACE_ME' ? 'Not set' : AWS_CONFIG.COGNITO_IDENTITY_POOL_ID;
        document.getElementById('configRegion').textContent =
            AWS_CONFIG.AWS_REGION === 'REPLACE_ME' ? 'Not set' : AWS_CONFIG.AWS_REGION;
    }

    hideConfigModal() {
        this.configModal.classList.remove('active');
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new VoiceOrderKioskApp();
    app.initialize();

    // Make app globally accessible for debugging
    window.app = app;
});
