// AWS Configuration
// Replace these values with your actual AWS settings

const AWS_CONFIG = {
    // Lex Bot Configuration
    LEX_BOT_ID: 'REPLACE_ME',           // e.g., 'CnRes001'
    LEX_BOT_ALIAS_ID: 'REPLACE_ME',     // e.g., 'TSTALIASID'
    LEX_BOT_LOCALE_ID: 'REPLACE_ME',    // e.g., 'en_US'

    // Cognito Identity Pool
    COGNITO_IDENTITY_POOL_ID: 'REPLACE_ME', // e.g., 'us-east-1:12345678-1234-1234-1234-123456789012'

    // AWS Region
    AWS_REGION: 'REPLACE_ME',           // e.g., 'us-east-1'

    // Optional: Orders API Configuration
    ORDERS_API_URL: '',                 // e.g., 'https://your-api-id.execute-api.us-east-1.amazonaws.com/prod'
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
