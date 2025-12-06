// Amazon Lex V2 Runtime Service

class LexService {
    constructor(config, signer) {
        this.config = config;
        this.signer = signer;
    }

    // Send text to Lex bot and get response
    async sendText(sessionId, text) {
        const { LEX_BOT_ID, LEX_BOT_ALIAS_ID, LEX_BOT_LOCALE_ID, AWS_REGION } = this.config;

        const url = `https://runtime-v2-lex.${AWS_REGION}.amazonaws.com/bots/${LEX_BOT_ID}/botAliases/${LEX_BOT_ALIAS_ID}/botLocales/${LEX_BOT_LOCALE_ID}/sessions/${sessionId}/text`;

        const requestBody = {
            text: text
        };

        const bodyString = JSON.stringify(requestBody);

        console.log(`Sending to Lex: "${text}"`);
        console.log(`Session ID: ${sessionId}`);
        console.log(`URL: ${url}`);

        try {
            // Sign the request
            const signedRequest = await this.signer.signRequest(
                'POST',
                url,
                AWS_REGION,
                'lex',
                bodyString
            );

            // Make the request
            const response = await fetch(url, {
                method: 'POST',
                headers: signedRequest.headers,
                body: bodyString
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Lex error response:', errorText);
                throw new Error(`Lex request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Lex response:', data);

            // Extract the primary message from the response
            let primaryMessage = 'No response from bot';
            if (data.messages && data.messages.length > 0) {
                // Get the first text message
                const textMessage = data.messages.find(m => m.contentType === 'PlainText');
                if (textMessage) {
                    primaryMessage = textMessage.content;
                }
            }

            // Extract session attributes
            const sessionAttributes = data.sessionState?.sessionAttributes || {};

            return {
                primaryMessage: primaryMessage,
                sessionAttributes: sessionAttributes,
                intentName: data.sessionState?.intent?.name || null,
                dialogState: data.sessionState?.dialogAction?.type || null,
                rawResponse: data
            };

        } catch (error) {
            console.error('Error communicating with Lex:', error);
            throw error;
        }
    }

    // Clear session (by using a new session ID)
    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
}

// Export LexService
window.LexService = LexService;
