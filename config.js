// AWS Configuration
// Replace these values with your actual AWS settings

const AWS_CONFIG = {
    // Lex Bot Configuration
    LEX_BOT_ID: 'QIBGB1HECL',           // CnRes006 bot
    LEX_BOT_ALIAS_ID: 'TSTALIASID',     // TestBotAlias
    LEX_BOT_LOCALE_ID: 'en_US',         // English (US)

    // Cognito Identity Pool
    COGNITO_IDENTITY_POOL_ID: 'us-west-2:85221a4d-9a9b-41a7-a4d5-5f826c62ee81', // CnRes0_ios_access

    // AWS Region
    AWS_REGION: 'us-west-2',            // US West (Oregon)

    // Optional: Orders API Configuration
    ORDERS_API_URL: '',                 // e.g., 'https://your-api-id.execute-api.us-west-2.amazonaws.com/prod'
};

// Validate configuration
function validateConfig() {
    const errors = [];

    if (AWS_CONFIG.LEX_BOT_ID === 'REPLACE_ME' || !AWS_CONFIG.LEX_BOT_ID) {
        errors.push('LEX_BOT_ID');
    }
    if (AWS_CONFIG.LEX_BOT_ALIAS_ID === 'REPLACE_ME' || !AWS_CONFIG.LEX_BOT_ALIAS_ID) {
        errors.push('LEX_BOT_ALIAS_ID');
    }
    if (AWS_CONFIG.LEX_BOT_LOCALE_ID === 'REPLACE_ME' || !AWS_CONFIG.LEX_BOT_LOCALE_ID) {
        errors.push('LEX_BOT_LOCALE_ID');
    }
    if (AWS_CONFIG.COGNITO_IDENTITY_POOL_ID === 'REPLACE_ME' || !AWS_CONFIG.COGNITO_IDENTITY_POOL_ID) {
        errors.push('COGNITO_IDENTITY_POOL_ID');
    }
    if (AWS_CONFIG.AWS_REGION === 'REPLACE_ME' || !AWS_CONFIG.AWS_REGION) {
        errors.push('AWS_REGION');
    }

    return {
        isValid: errors.length === 0,
        missingFields: errors
    };
}

// Export configuration
window.AWS_CONFIG = AWS_CONFIG;
window.validateConfig = validateConfig;
