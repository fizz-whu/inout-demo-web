# Food Ordering Voice Kiosk (Web)

A web-based voice ordering kiosk that mirrors the iOS `inout-demo-ios` experience in Chrome browser. Customers speak their order, the app forwards text to Amazon Lex V2 bot, and replies are read back using the Web Speech API.

## Features

- **Continuous Voice Listening** - Always listening for customer orders using Web Speech API
- **AWS Lex V2 Integration** - Natural language processing for understanding food orders
- **Text-to-Speech** - Speaks responses back to customers using browser's speech synthesis
- **Order Management** - Displays orders with items, prices, and payment status
- **Conversation History** - Shows chat between customer and assistant
- **Responsive UI** - 60% chat interface + 40% orders display, matching iOS design

## Browser Support

This app requires Chrome browser (or Chromium-based browsers) for the following features:
- Web Speech API (Speech Recognition)
- Web Speech Synthesis API (Text-to-Speech)
- SubtleCrypto API (for AWS SigV4 signing)

## Project Structure

```
inout-demo-web/
├── index.html          # Main HTML structure
├── styles.css          # CSS styling matching iOS design
├── config.js           # AWS configuration
├── aws-signer.js       # AWS SigV4 signing implementation
├── lex-service.js      # Lex API integration
├── speech-service.js   # Web Speech API wrapper
├── orders-service.js   # Orders API integration
├── app.js              # Main application logic
└── README.md           # This file
```

## Configuration

Edit `config.js` and replace the `REPLACE_ME` values with your actual AWS settings:

```javascript
const AWS_CONFIG = {
    LEX_BOT_ID: 'your-bot-id',                    // e.g., 'CnRes001'
    LEX_BOT_ALIAS_ID: 'your-alias-id',            // e.g., 'TSTALIASID'
    LEX_BOT_LOCALE_ID: 'en_US',                   // Bot locale
    COGNITO_IDENTITY_POOL_ID: 'your-pool-id',     // e.g., 'us-east-1:uuid'
    AWS_REGION: 'us-east-1',                      // AWS region
    ORDERS_API_URL: ''                            // Optional: Orders API URL
};
```

### Required AWS Resources

| Config Key | Description | Example |
|------------|-------------|---------|
| `LEX_BOT_ID` | Lex V2 bot ID | `CnRes001` |
| `LEX_BOT_ALIAS_ID` | Active bot alias ID | `TSTALIASID` |
| `LEX_BOT_LOCALE_ID` | Bot locale | `en_US` |
| `COGNITO_IDENTITY_POOL_ID` | Cognito Federated Identity pool | `us-east-1:12345678-...` |
| `AWS_REGION` | AWS region hosting Lex + Cognito | `us-east-1` |

### IAM Permissions

The Cognito Identity Pool must permit **unauthenticated identities** and grant the following IAM permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "lex:RecognizeText"
            ],
            "Resource": "*"
        }
    ]
}
```

**Note:** Amazon Polly access is **not** required because the web app uses browser's built-in speech synthesis.

## Running the App

### Option 1: Local Development Server

Using Python:
```bash
cd inout-demo-web
python3 -m http.server 8000
```

Then open Chrome and navigate to: `http://localhost:8000`

Using Node.js (with http-server):
```bash
cd inout-demo-web
npx http-server -p 8000
```

### Option 2: Direct File Access

You can also open `index.html` directly in Chrome, but some browsers may restrict certain features when using the `file://` protocol. A local server is recommended.

### First Run

1. The app will check configuration on startup
2. If configuration is missing, a modal will display the missing values
3. Edit `config.js` with your AWS settings
4. Refresh the page
5. Grant microphone permissions when prompted by Chrome
6. The app will start listening automatically

## How It Works

### Voice Pipeline

1. **Speech-to-Text** - Web Speech API continuously listens and produces partial + final transcripts
2. **Lex Round-Trip** - Requests are signed with AWS SigV4 using temporary Cognito credentials
3. **Text-to-Speech** - Browser's SpeechSynthesis speaks the bot's response
4. **State Management** - App transitions through states: Idle → Listening → Processing → Speaking → Listening

### Conversation Flow

```
User speaks → Speech Recognition → Final Transcript
    ↓
Send to Lex Bot (with session ID)
    ↓
Receive bot response
    ↓
Display in chat + Speak response
    ↓
Check for order_id in session attributes
    ↓
Fetch order from Orders API (if available)
    ↓
Display order card
```

### State Management

- **idle** - Not started yet
- **listening** - Actively listening for speech
- **processing** - Sending to Lex and waiting for response
- **speaking** - Bot is speaking the response (listening paused)
- **error** - An error occurred

## AWS Deployment

### Option 1: S3 + CloudFront (Recommended)

1. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://your-kiosk-app
   ```

2. **Enable Static Website Hosting**
   ```bash
   aws s3 website s3://your-kiosk-app --index-document index.html
   ```

3. **Upload Files**
   ```bash
   aws s3 sync . s3://your-kiosk-app --exclude ".git/*" --exclude "README.md"
   ```

4. **Set Bucket Policy** (for public read)
   ```json
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Sid": "PublicReadGetObject",
               "Effect": "Allow",
               "Principal": "*",
               "Action": "s3:GetObject",
               "Resource": "arn:aws:s3:::your-kiosk-app/*"
           }
       ]
   }
   ```

5. **Create CloudFront Distribution**
   - Origin: Your S3 bucket
   - Default root object: `index.html`
   - Enable HTTPS

6. **Access Your App**
   - Via CloudFront URL: `https://d1234567890.cloudfront.net`
   - Or configure custom domain with Route 53

### Option 2: AWS Amplify Hosting

1. **Install Amplify CLI**
   ```bash
   npm install -g @aws-amplify/cli
   ```

2. **Initialize Amplify**
   ```bash
   cd inout-demo-web
   amplify init
   ```

3. **Add Hosting**
   ```bash
   amplify add hosting
   ```
   - Choose: Hosting with Amplify Console
   - Select: Manual deployment

4. **Publish**
   ```bash
   amplify publish
   ```

5. **Access Your App**
   - Amplify will provide a URL: `https://main.d1234567890.amplifyapp.com`

## Troubleshooting

### Configuration Issues

- If configuration values are missing, the app presents a configuration warning modal
- Check browser console for detailed error messages
- Verify all AWS resource IDs are correct in `config.js`

### Speech Recognition Issues

- **Microphone access denied**: Check Chrome permissions (chrome://settings/content/microphone)
- **No speech detected**: Ensure microphone is working and not muted
- **Recognition stops**: The app automatically restarts listening after each turn

### Lex Connection Issues

- **401 Unauthorized**: Check Cognito Identity Pool configuration and IAM permissions
- **403 Forbidden**: Verify the IAM role has `lex:RecognizeText` permission
- **Network errors**: Check AWS region matches Lex bot region

### Credentials

- Credentials are automatically refreshed one minute before expiration
- Check browser console for credential fetch logs
- Verify Cognito Identity Pool allows unauthenticated access

## Development

### Debugging

The app logs extensively to the browser console. Open Chrome DevTools (F12) to see:
- Speech recognition events
- Lex request/response details
- Credential fetching
- State transitions

### Testing Locally

1. Use Chrome's DevTools to simulate different network conditions
2. Test microphone permissions in different scenarios
3. Monitor console for errors and warnings

### Code Style

- ES6+ JavaScript (classes, async/await, arrow functions)
- No external dependencies - pure vanilla JavaScript
- Modular architecture with separate service classes

## Comparison with iOS App

| Feature | iOS App | Web App |
|---------|---------|---------|
| Speech Recognition | iOS Speech Framework | Web Speech API |
| Text-to-Speech | AVSpeechSynthesizer | SpeechSynthesis API |
| Lex Integration | Native AWS SDK | Custom SigV4 + Fetch |
| Credentials | Cognito Identity | Cognito Identity |
| UI Framework | SwiftUI | HTML/CSS/JS |
| State Management | @Published properties | Class properties |
| Orders API | URLSession | Fetch API |

## License

This project is part of the mj-ai-solution organization. For licensing information, please contact the development team.

## Contributing

This is currently developed by Chee Fan (fizz-whu). If you'd like to contribute, please reach out via email (fizz.whu@gmail.com) or create an issue in the repository.

## Developer

**Chee Fan (fizz-whu)**
- Email: fizz.whu@gmail.com
- Organization: mj-ai-solution
- GitHub: https://github.com/fizz-whu

**Project Timeline**
- Started: December 2024
- Active Development: December 2024 - Present
