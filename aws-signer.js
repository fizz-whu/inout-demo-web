// AWS Signature Version 4 Signing for Browser
// Based on AWS Signature Version 4 signing process

class AWSSigner {
    constructor() {
        this.credentials = null;
        this.credentialsExpiration = null;
    }

    // Get AWS credentials from Cognito Identity
    async getCredentials(region, identityPoolId) {
        // Check if credentials are still valid (refresh 1 minute before expiration)
        if (this.credentials && this.credentialsExpiration) {
            const now = new Date();
            const expirationBuffer = new Date(this.credentialsExpiration.getTime() - 60000);
            if (now < expirationBuffer) {
                console.log('Using cached credentials');
                return this.credentials;
            }
        }

        console.log('Fetching new credentials from Cognito...');

        try {
            // Get identity ID
            const identityResponse = await fetch(
                `https://cognito-identity.${region}.amazonaws.com/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-amz-json-1.1',
                        'X-Amz-Target': 'AWSCognitoIdentityService.GetId'
                    },
                    body: JSON.stringify({
                        IdentityPoolId: identityPoolId
                    })
                }
            );

            if (!identityResponse.ok) {
                throw new Error(`Failed to get identity: ${identityResponse.statusText}`);
            }

            const identityData = await identityResponse.json();
            const identityId = identityData.IdentityId;

            console.log(`Got identity ID: ${identityId}`);

            // Get credentials for identity
            const credentialsResponse = await fetch(
                `https://cognito-identity.${region}.amazonaws.com/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-amz-json-1.1',
                        'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity'
                    },
                    body: JSON.stringify({
                        IdentityId: identityId
                    })
                }
            );

            if (!credentialsResponse.ok) {
                throw new Error(`Failed to get credentials: ${credentialsResponse.statusText}`);
            }

            const credentialsData = await credentialsResponse.json();

            this.credentials = {
                accessKeyId: credentialsData.Credentials.AccessKeyId,
                secretAccessKey: credentialsData.Credentials.SecretKey,
                sessionToken: credentialsData.Credentials.SessionToken
            };

            this.credentialsExpiration = new Date(credentialsData.Credentials.Expiration * 1000);

            console.log('Successfully obtained credentials');
            return this.credentials;

        } catch (error) {
            console.error('Error getting credentials:', error);
            throw error;
        }
    }

    // Sign an AWS request using Signature Version 4
    async signRequest(method, url, region, service, body = '') {
        const credentials = await this.getCredentials(region, AWS_CONFIG.COGNITO_IDENTITY_POOL_ID);

        const urlObj = new URL(url);
        const host = urlObj.host;
        const path = urlObj.pathname + urlObj.search;

        const now = new Date();
        const amzDate = this.getAmzDate(now);
        const dateStamp = this.getDateStamp(now);

        // Create canonical request
        const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'host;x-amz-date';

        const payloadHash = await this.sha256(body);

        const canonicalRequest = [
            method,
            path,
            '',  // query string (already in path)
            canonicalHeaders,
            signedHeaders,
            payloadHash
        ].join('\n');

        // Create string to sign
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
        const canonicalRequestHash = await this.sha256(canonicalRequest);

        const stringToSign = [
            'AWS4-HMAC-SHA256',
            amzDate,
            credentialScope,
            canonicalRequestHash
        ].join('\n');

        // Calculate signature
        const signingKey = await this.getSignatureKey(
            credentials.secretAccessKey,
            dateStamp,
            region,
            service
        );

        const signature = await this.hmac(signingKey, stringToSign);

        // Create authorization header
        const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        return {
            headers: {
                'Authorization': authorization,
                'X-Amz-Date': amzDate,
                'X-Amz-Security-Token': credentials.sessionToken,
                'Content-Type': 'application/json'
            }
        };
    }

    // Helper functions
    getAmzDate(date) {
        return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    }

    getDateStamp(date) {
        return date.toISOString().substring(0, 10).replace(/-/g, '');
    }

    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async hmac(key, message) {
        const msgBuffer = new TextEncoder().encode(message);
        const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);

        // Return as hex string
        const hashArray = Array.from(new Uint8Array(signature));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async hmacBuffer(key, message) {
        const msgBuffer = new TextEncoder().encode(message);
        const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
        return new Uint8Array(signature);
    }

    async getSignatureKey(key, dateStamp, regionName, serviceName) {
        const kDate = await this.hmacBuffer('AWS4' + key, dateStamp);
        const kRegion = await this.hmacBuffer(kDate, regionName);
        const kService = await this.hmacBuffer(kRegion, serviceName);
        const kSigning = await this.hmacBuffer(kService, 'aws4_request');
        return kSigning;
    }
}

// Export AWSSigner
window.AWSSigner = AWSSigner;
