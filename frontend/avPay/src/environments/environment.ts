export const environment = {
    apiUrl: 'http://127.0.0.1:8000',
    production: true,
    pwa: {
        enabled: true,
        serviceWorkerUrl: 'ngsw-worker.js',
        registrationStrategy: 'registerWhenStable:30000'
    },
    features: {
        faceCapture: true,
        paymentProcessing: true,
        transactionHistory: true,
        userSettings: true,
        pwaInstallPrompt: true
    },
    version: '1.0.0',
    buildDate: new Date().toISOString(),
    supportEmail: 'support@avpay.com',
  // HSBC Configuration for Production
  hsbc: {
    // clientId: process.env['HSBC_PROD_CLIENT_ID'] || '',
    // clientSecret: process.env['HSBC_PROD_CLIENT_SECRET'] || '',
    // encryptionKey: process.env['HSBC_PROD_ENCRYPTION_KEY'] || '',
    // signingKey: process.env['HSBC_PROD_SIGNING_KEY'] || '',
    // corporateAccountId: process.env['HSBC_PROD_CORPORATE_ACCOUNT'] || '',
    baseUrl: 'https://api.hsbc.com/corporate-banking/v1', // Production URL
    enabled: true
  },
  mollieApiKey: 'test_jmCkdTUcct3aEeuvCeuHJDeqS6NzAR', // Test API key
  mollieProfileId: 'pfl_EUaZi8qpyn', // Your Mollie profile ID
  mollieWebhookUrl: '/mollie/webhook',
  mollieRedirectUrl: 'https://localhost:4200/payment/success',
};
