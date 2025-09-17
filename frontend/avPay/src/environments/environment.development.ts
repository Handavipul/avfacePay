export const environment = {
    apiUrl: 'http://127.0.0.1:8000',
    production: false,
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
    // HSBC Configuration for Sandbox
    hsbc: {
        clientId: '49iGbpVTCncpRLQiLsVhGQbAU8hUVmMA', // Replace with actual HSBC Client ID
        clientSecret: '37cdb2a4-3ed6-4bf9-af9b-1e12f01ae470', // Replace with actual HSBC Client Secret
        encryptionKey: 'YOUR_HSBC_ENCRYPTION_KEY', // Replace with actual encryption key
        signingKey: 'YOUR_HSBC_SIGNING_KEY', // Replace with actual signing key
        corporateAccountId: 'av_solutio_11775', // Replace with your corporate account
        baseUrl: 'https://sandbox.hsbc.com/corporate-banking/v1', // Sandbox URL
        enabled: true // Toggle HSBC integration
    } ,
  mollieApiKey: 'test_jmCkdTUcct3aEeuvCeuHJDeqS6NzAR', // Test API key
  mollieProfileId: 'pfl_EUaZi8qpyn', // Your Mollie profile ID
  mollieWebhookUrl: '/mollie/webhook',
  mollieRedirectUrl: 'https://localhost:4200/payment/success',  
};
