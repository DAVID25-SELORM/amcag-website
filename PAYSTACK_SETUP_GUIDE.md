# Paystack Integration Setup Guide

## Overview
This guide will help you set up Paystack payment gateway for processing monthly dues payments in the AMCAG membership system.

## Prerequisites
- A Paystack account (create one at https://paystack.com)
- Access to Firebase project
- Node.js installed for installing dependencies

---

## Step 1: Create Paystack Account

1. **Sign Up**: Go to https://paystack.com and create an account
2. **Complete KYC**: Submit business documents for verification
3. **Activate Account**: Wait for Paystack approval (usually 1-3 business days)

---

## Step 2: Get API Keys

1. Log in to your Paystack dashboard
2. Go to **Settings** → **API Keys & Webhooks**
3. Copy your keys:
   - **Test Public Key**: `pk_test_xxxxxxxxxx` (for testing)
   - **Test Secret Key**: `sk_test_xxxxxxxxxx` (for testing)
   - **Live Public Key**: `pk_live_xxxxxxxxxx` (for production)
   - **Live Secret Key**: `sk_live_xxxxxxxxxx` (for production)

⚠️ **IMPORTANT**: Never commit secret keys to version control!

---

## Step 3: Configure Frontend

### Update `member-dashboard/dues-payment.html`

Find this line (around line 195):
```javascript
const PAYSTACK_PUBLIC_KEY = 'pk_test_xxxxxxxxxxxxxxxxxxxx';
```

Replace with:
```javascript
const PAYSTACK_PUBLIC_KEY = 'pk_test_YOUR_ACTUAL_PUBLIC_KEY'; // For testing
// const PAYSTACK_PUBLIC_KEY = 'pk_live_YOUR_ACTUAL_PUBLIC_KEY'; // For production
```

---

## Step 4: Configure Backend (Cloud Functions)

### Update `functions/index.js`

Find this line (around line 10):
```javascript
const PAYSTACK_SECRET_KEY = 'sk_test_xxxxxxxxxxxxxxxxxxxx';
```

Replace with:
```javascript
const PAYSTACK_SECRET_KEY = 'sk_test_YOUR_ACTUAL_SECRET_KEY'; // For testing
// const PAYSTACK_SECRET_KEY = 'sk_live_YOUR_ACTUAL_SECRET_KEY'; // For production
```

**BETTER APPROACH:** Use Firebase environment config:

```bash
# Set the secret key as environment variable
firebase functions:config:set paystack.secret_key="sk_test_YOUR_ACTUAL_SECRET_KEY"
```

Then in `functions/index.js`, replace the constant with:
```javascript
const PAYSTACK_SECRET_KEY = functions.config().paystack.secret_key;
```

---

## Step 5: Install Dependencies

Navigate to the functions directory:
```bash
cd functions
npm install
```

This will install axios (required for Paystack API calls).

---

## Step 6: Deploy Functions

Deploy the updated Cloud Functions:
```bash
firebase deploy --only functions
```

This deploys:
- `processDuesPayment` - Handles payment processing and verification
- `paystackWebhook` - Receives Paystack webhook events
- `approveManualPayment` - Allows admins to approve manual payments

---

## Step 7: Configure Paystack Webhooks

1. Go to Paystack Dashboard → **Settings** → **API Keys & Webhooks**
2. Scroll to **Webhooks** section
3. Click **Add URL**
4. Enter your webhook URL:
   ```
   https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/paystackWebhook
   ```
   
   Example:
   ```
   https://us-central1-amcag-ghana.cloudfunctions.net/paystackWebhook
   ```

5. Click **Save**

### Test the Webhook
Paystack will send a test event. Check Firebase Functions logs:
```bash
firebase functions:log
```

---

## Step 8: Update Bank Details

Edit `member-dashboard/dues-payment.html` and update the bank transfer details (around line 117):

```html
<p style="margin: 0; font-weight: 600;">Bank Details:</p>
<p style="margin: 0.5rem 0 0 0;">
  Bank: [Your Actual Bank Name]<br>
  Account: [Your Actual Account Number]<br>
  Account Name: AMCAG Ghana
</p>
```

---

## Step 9: Testing

### Test with Paystack Test Cards

Use these test cards in test mode:

**Successful Payment:**
- Card Number: `5060 6666 6666 6666 666`
- CVV: `123`
- Expiry: Any future date
- PIN: `1234`
- OTP: `123456`

**Failed Payment:**
- Card Number: `5060 0000 0000 0000 000`

### Test Mobile Money (Test Mode)
- Network: Select any (MTN, Vodafone, AirtelTigo)
- Phone: `0551234567`
- OTP: `123456`

### Test Bank Transfer
- Select any bank
- Complete the test transfer flow

### Testing Workflow

1. **Login as a member**
2. Go to **Pay Dues** page
3. Select months to pay
4. Choose **Pay Now (Card / Mobile Money / Bank)**
5. Complete payment with test card
6. Verify payment appears in history
7. Check Firebase Console → Firestore → `payments` collection

---

## Step 10: Approve Manual Payments (Testing)

1. **Login as Regional Executive**
2. Go to **Payment Approvals** page
3. Submit a manual payment as a member (bank transfer/cash)
4. As regional exec, approve or reject the payment
5. Verify member receives notification

---

## Step 11: Go Live

### Before Going Live:
1. ✅ Complete Paystack KYC verification
2. ✅ Test all payment flows thoroughly
3. ✅ Update to live API keys
4. ✅ Update webhook URL to production function
5. ✅ Test with small real transactions

### Switch to Live Mode:

**Frontend** (`member-dashboard/dues-payment.html`):
```javascript
const PAYSTACK_PUBLIC_KEY = 'pk_live_YOUR_ACTUAL_LIVE_KEY';
```

**Backend** (`functions/index.js`):
```javascript
const PAYSTACK_SECRET_KEY = 'sk_live_YOUR_ACTUAL_LIVE_KEY';
```
Or using Firebase config:
```bash
firebase functions:config:set paystack.secret_key="sk_live_YOUR_ACTUAL_LIVE_KEY"
firebase deploy --only functions
```

Deploy:
```bash
firebase deploy
```

---

## Payment Flow Overview

### Electronic Payments (Paystack)
1. Member selects months and clicks "Pay with Paystack"
2. Paystack popup opens
3. Member completes payment
4. Cloud Function verifies transaction with Paystack API
5. Payment status set to **"paid"** immediately
6. Member receives confirmation

### Manual Payments (Bank Transfer / Cash)
1. Member selects payment method
2. Provides reference number (if bank transfer)
3. Cloud Function creates payment with **"pending"** status
4. Regional/National Executive reviews in **Payment Approvals**
5. Executive approves or rejects
6. Payment status updated to **"paid"** or **"rejected"**
7. Member receives notification

---

## Monitoring & Troubleshooting

### Check Payment Status
Firebase Console → Firestore → `payments` collection

### View Function Logs
```bash
firebase functions:log
```

### Common Issues

**"Payment verification failed"**
- Check secret key is correct
- Ensure axios is installed
- Check Paystack API status

**"Invalid Paystack signature" (webhook)**
- Verify webhook secret matches
- Check webhook URL is correct

**"Insufficient permissions" (approval)**
- Verify user has regional_executive or higher role
- Check Firestore security rules

---

## Security Best Practices

1. ✅ **Never commit API keys** to version control
2. ✅ Use Firebase environment config for secrets
3. ✅ Keep webhook signature validation enabled
4. ✅ Use HTTPS only
5. ✅ Regularly monitor transaction logs
6. ✅ Set up Firebase Security Command Center alerts

---

## Support

- **Paystack Support**: support@paystack.com
- **Paystack Docs**: https://paystack.com/docs
- **Firebase Functions Docs**: https://firebase.google.com/docs/functions

---

## Summary Checklist

- [ ] Paystack account created and verified
- [ ] API keys obtained (test and live)
- [ ] Frontend configured with public key
- [ ] Backend configured with secret key
- [ ] Dependencies installed (`npm install` in functions/)
- [ ] Cloud Functions deployed
- [ ] Webhook URL configured in Paystack
- [ ] Bank details updated
- [ ] Test payments completed successfully
- [ ] Manual payment approval tested
- [ ] Ready to go live (when KYC approved)

---

**Next Steps:**
1. Test the payment flow with test keys
2. Complete Paystack KYC for live transactions
3. Switch to live keys when ready
4. Monitor the first few transactions closely

Good luck! 🚀
