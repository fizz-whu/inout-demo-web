# Deployment Guide - S3 + CloudFront with GitHub Actions

This guide walks you through deploying the Voice Kiosk web app to AWS using S3 + CloudFront with automated GitHub Actions CI/CD.

## Architecture

```
GitHub Push → GitHub Actions → S3 Bucket → CloudFront → Users (HTTPS)
                    ↓
              OIDC Authentication
                    ↓
                AWS IAM Role
```

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- GitHub repository for this project
- GitHub account with admin access to the repository

## Step 1: Set Up GitHub OIDC Provider in AWS

This allows GitHub Actions to authenticate with AWS without storing long-lived credentials.

### Option A: Using AWS Console

1. Go to **IAM** → **Identity providers**
2. Click **Add provider**
3. Select **OpenID Connect**
4. Enter the following:
   - **Provider URL**: `https://token.actions.githubusercontent.com`
   - **Audience**: `sts.amazonaws.com`
5. Click **Add provider**

### Option B: Using AWS CLI

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

**Note**: You only need to do this once per AWS account. If it already exists, skip to Step 2.

## Step 2: Deploy Infrastructure with CloudFormation

### Update Parameters

Edit `infrastructure/cloudformation.yml` and update the parameters:

```yaml
Parameters:
  GitHubOrg:
    Default: 'your-github-username'  # Change this

  GitHubRepo:
    Default: 'inout-demo-web'  # Change if different

  BucketName:
    Default: 'voice-kiosk-web-app'  # Change to a globally unique name
```

### Deploy the Stack

```bash
cd infrastructure

# Validate the template
aws cloudformation validate-template \
  --template-body file://cloudformation.yml

# Create the stack
aws cloudformation create-stack \
  --stack-name voice-kiosk-web-app \
  --template-body file://cloudformation.yml \
  --parameters \
    ParameterKey=GitHubOrg,ParameterValue=your-github-username \
    ParameterKey=GitHubRepo,ParameterValue=inout-demo-web \
    ParameterKey=BucketName,ParameterValue=your-unique-bucket-name \
  --capabilities CAPABILITY_NAMED_IAM

# Wait for stack creation to complete (takes ~5-10 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name voice-kiosk-web-app

# Get the outputs
aws cloudformation describe-stacks \
  --stack-name voice-kiosk-web-app \
  --query 'Stacks[0].Outputs' \
  --output table
```

### Save the Outputs

You'll need these values for GitHub secrets:
- `GitHubActionsRoleArn` → `AWS_ROLE_ARN`
- `S3BucketName` → `S3_BUCKET_NAME`
- `CloudFrontDistributionId` → `CLOUDFRONT_DISTRIBUTION_ID`
- `CloudFrontDomain` → `CLOUDFRONT_DOMAIN`
- Region you deployed to → `AWS_REGION`

## Step 3: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add each of the following:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `AWS_ROLE_ARN` | IAM role ARN from CloudFormation output | `arn:aws:iam::123456789012:role/GitHubActions-inout-demo-web-Role` |
| `AWS_REGION` | AWS region where you deployed | `us-east-1` |
| `S3_BUCKET_NAME` | S3 bucket name from output | `voice-kiosk-web-app` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID | `E1234567890ABC` |
| `CLOUDFRONT_DOMAIN` | CloudFront domain name | `d1234567890.cloudfront.net` |

## Step 4: Configure Your Web App

Before deployment, update your AWS configuration:

1. Edit `config.js` and replace the placeholder values:

```javascript
const AWS_CONFIG = {
    LEX_BOT_ID: 'your-bot-id',
    LEX_BOT_ALIAS_ID: 'your-alias-id',
    LEX_BOT_LOCALE_ID: 'en_US',
    COGNITO_IDENTITY_POOL_ID: 'us-east-1:your-pool-id',
    AWS_REGION: 'us-east-1',
    ORDERS_API_URL: '',  // Optional
};
```

2. Commit the changes:

```bash
git add config.js
git commit -m "Configure AWS settings"
```

## Step 5: Deploy

### Automatic Deployment (Recommended)

Simply push to the main branch:

```bash
git push origin main
```

The GitHub Action will automatically:
1. Check out the code
2. Authenticate with AWS using OIDC
3. Sync files to S3
4. Invalidate CloudFront cache
5. Report deployment status

### Manual Deployment

You can also trigger the workflow manually:

1. Go to **Actions** tab in GitHub
2. Select **Deploy to S3 and CloudFront** workflow
3. Click **Run workflow** → **Run workflow**

## Step 6: Verify Deployment

1. Check the GitHub Actions workflow run:
   - Go to **Actions** tab
   - Click on the latest workflow run
   - Verify all steps completed successfully

2. Access your app:
   ```
   https://[CLOUDFRONT_DOMAIN]
   ```
   (Use the CloudFront domain from the stack outputs)

3. Test functionality:
   - Grant microphone permissions
   - Speak a test order
   - Verify Lex integration works
   - Check order display

## Monitoring and Logs

### GitHub Actions Logs

- View deployment logs in the **Actions** tab of your repository
- Each step shows detailed output

### AWS CloudWatch Logs

- CloudFront access logs (if enabled)
- S3 server access logs (if enabled)

### CloudFront Metrics

```bash
# View CloudFront distribution details
aws cloudfront get-distribution \
  --id [CLOUDFRONT_DISTRIBUTION_ID]

# List recent invalidations
aws cloudfront list-invalidations \
  --distribution-id [CLOUDFRONT_DISTRIBUTION_ID]
```

## Updating the App

Every push to `main` branch automatically deploys:

```bash
# Make your changes
git add .
git commit -m "Update feature X"
git push origin main

# GitHub Actions will deploy automatically
```

## Troubleshooting

### GitHub Actions Fails with Authentication Error

**Error**: `Unable to assume role`

**Solution**:
1. Verify OIDC provider is set up correctly
2. Check `AWS_ROLE_ARN` secret matches the CloudFormation output
3. Ensure the trust policy in the IAM role includes your GitHub repo

### CloudFront Shows Old Content

**Error**: Changes not visible after deployment

**Solution**:
- Wait 2-3 minutes for invalidation to complete
- Check invalidation status:
  ```bash
  aws cloudfront list-invalidations \
    --distribution-id [DISTRIBUTION_ID]
  ```
- Force refresh in browser (Ctrl+Shift+R)

### S3 Sync Fails

**Error**: `Access Denied` when syncing to S3

**Solution**:
1. Verify the IAM role has correct S3 permissions
2. Check bucket name is correct in GitHub secrets
3. Ensure bucket exists and is in the correct region

### Web App Configuration Errors

**Error**: Configuration modal appears

**Solution**:
1. Verify `config.js` has correct AWS values
2. Commit and push changes
3. Wait for deployment to complete
4. Clear browser cache

## Cost Estimate

Approximate monthly costs for typical kiosk usage:

| Service | Usage | Cost |
|---------|-------|------|
| S3 Storage | 10 MB | $0.01 |
| S3 Requests | 10,000 GET | $0.01 |
| CloudFront | 1 GB transfer | $0.09 |
| CloudFront Requests | 10,000 | $0.01 |
| **Total** | | **~$0.12/month** |

With moderate traffic (100,000 requests/month):
- Estimated cost: **$1-3/month**

## Clean Up

To delete all resources:

```bash
# Delete CloudFormation stack (also deletes S3 bucket and CloudFront)
aws cloudformation delete-stack \
  --stack-name voice-kiosk-web-app

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete \
  --stack-name voice-kiosk-web-app
```

**Note**: CloudFront distribution deletion can take 15-30 minutes.

## Security Best Practices

1. **HTTPS Only**: CloudFront enforces HTTPS (required for Web Speech API)
2. **No AWS Credentials in Code**: Uses OIDC for secure authentication
3. **S3 Bucket Not Public**: Only CloudFront can access via OAC
4. **Versioning Enabled**: S3 versioning protects against accidental overwrites
5. **IAM Least Privilege**: GitHub Actions role has minimal required permissions

## Advanced Configuration

### Custom Domain

To use a custom domain (e.g., `kiosk.example.com`):

1. Request SSL certificate in **ACM** (us-east-1 region)
2. Update CloudFormation template:
   ```yaml
   CloudFrontDistribution:
     Properties:
       DistributionConfig:
         Aliases:
           - kiosk.example.com
         ViewerCertificate:
           AcmCertificateArn: arn:aws:acm:us-east-1:...
           SslSupportMethod: sni-only
   ```
3. Create Route 53 A record pointing to CloudFront

### Enable Access Logs

Add to CloudFormation template:

```yaml
WebsiteBucket:
  Properties:
    LoggingConfiguration:
      DestinationBucketName: !Ref LogBucket
      LogFilePrefix: s3-access-logs/

CloudFrontDistribution:
  Properties:
    DistributionConfig:
      Logging:
        Bucket: !GetAtt LogBucket.DomainName
        Prefix: cloudfront-logs/
```

### Environment-Based Deployments

To support dev/staging/prod environments:

1. Create separate stacks:
   ```bash
   aws cloudformation create-stack \
     --stack-name voice-kiosk-dev \
     --template-body file://cloudformation.yml \
     --parameters ParameterKey=BucketName,ParameterValue=voice-kiosk-dev
   ```

2. Create separate GitHub workflows for each environment
3. Use different `config.js` values per environment

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-org/inout-demo-web/issues
- Email: fizz.whu@gmail.com

## References

- [GitHub Actions OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
