/**
 * Email Templates for AMCAG Donation System
 * Uses Handlebars-style templating for dynamic content
 */

/**
 * Donation Confirmation Email
 * Sent immediately after a donation is submitted (pending status)
 */
exports.donationConfirmationEmail = (data) => {
    const { donorName, donationType, amount, items, campaignName, donationId, createdAt } = data;

    const itemsList = items && items.length > 0
        ? items.map(item => `<li>${item.name} - ${item.quantity} ${item.unit}</li>`).join('')
        : '';

    return {
        subject: 'Thank You for Your Donation - AMCAG',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #1976D2, #1565C0);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.95;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
        }
        .donation-details {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            color: #666;
            font-weight: 500;
        }
        .detail-value {
            font-weight: 600;
            color: #1976D2;
        }
        .items-list {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 15px;
            margin-top: 10px;
        }
        .items-list h4 {
            margin: 0 0 10px 0;
            color: #333;
        }
        .items-list ul {
            margin: 0;
            padding-left: 20px;
        }
        .items-list li {
            padding: 5px 0;
        }
        .status-badge {
            display: inline-block;
            background: #FFF3CD;
            color: #856404;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .next-steps {
            background: #E3F2FD;
            border-left: 4px solid #1976D2;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .next-steps h3 {
            margin: 0 0 10px 0;
            color: #1565C0;
        }
        .next-steps ol {
            margin: 0;
            padding-left: 20px;
        }
        .next-steps li {
            padding: 5px 0;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
        }
        .footer p {
            margin: 10px 0;
            font-size: 14px;
        }
        .social-links {
            margin: 20px 0;
        }
        .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: #1976D2;
            text-decoration: none;
        }
        .btn {
            display: inline-block;
            background: #1976D2;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
        .btn:hover {
            background: #1565C0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Thank You for Your Donation! 🙏</h1>
            <p>Association of Methodist Church Administrators in Ghana</p>
        </div>
        
        <div class="content">
            <p class="greeting">Dear ${donorName},</p>
            
            <p>Thank you for your generous ${donationType} donation to AMCAG. Your contribution will make a meaningful difference in our community outreach programs.</p>
            
            <div class="donation-details">
                <h3 style="margin-top: 0;">Donation Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Reference Number:</span>
                    <span class="detail-value">#${donationId.substring(0, 8).toUpperCase()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">${new Date(createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${donationType === 'monetary' ? 'Monetary' : 'Material'}</span>
                </div>
                ${donationType === 'monetary' ? `
                    <div class="detail-row">
                        <span class="detail-label">Amount:</span>
                        <span class="detail-value">GHS ${amount ? amount.toFixed(2) : '0.00'}</span>
                    </div>
                ` : ''}
                ${campaignName ? `
                    <div class="detail-row">
                        <span class="detail-label">Campaign:</span>
                        <span class="detail-value">${campaignName}</span>
                    </div>
                ` : ''}
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="status-badge">Pending Confirmation</span>
                </div>
            </div>
            
            ${donationType === 'material' && itemsList ? `
                <div class="items-list">
                    <h4>Items Donated:</h4>
                    <ul>${itemsList}</ul>
                </div>
            ` : ''}
            
            <div class="next-steps">
                <h3>What Happens Next?</h3>
                <ol>
                    ${donationType === 'monetary' ? `
                        <li><strong>Payment Verification:</strong> Our regional office will verify your payment within 1-2 business days.</li>
                        <li><strong>Official Receipt:</strong> Once confirmed, you will receive an official receipt via email.</li>
                        <li><strong>Tax Documentation:</strong> A downloadable PDF receipt will be available in your member dashboard.</li>
                    ` : `
                        <li><strong>Coordination:</strong> Our regional office will contact you to arrange collection of the donated items.</li>
                        <li><strong>Collection:</strong> Items will be collected at a mutually convenient time.</li>
                        <li><strong>Confirmation:</strong> You will receive confirmation once items are received and distributed.</li>
                    `}
                    <li><strong>Impact Updates:</strong> We'll keep you informed about how your donation is making a difference.</li>
                </ol>
            </div>
            
            <center>
                <a href="https://amcag.org/member-dashboard/my-donations.html" class="btn">View My Donations</a>
            </center>
            
            <p style="margin-top: 30px;">Your generosity helps us support children's homes, community development projects, and various charitable initiatives across Ghana. Thank you for being a blessing to others!</p>
            
            <p style="margin-top: 20px; color: #666; font-size: 14px;">If you have any questions about your donation, please contact your regional office or email us at <a href="mailto:donations@amcag.org" style="color: #1976D2;">donations@amcag.org</a>.</p>
        </div>
        
        <div class="footer">
            <p><strong>Association of Methodist Church Administrators in Ghana</strong></p>
            <p>Email: info@amcag.org | Phone: +233 XX XXX XXXX</p>
            <p>Website: www.amcag.org</p>
            
            <div class="social-links">
                <a href="#">Facebook</a> |
                <a href="#">Twitter</a> |
                <a href="#">Instagram</a>
            </div>
            
            <p style="font-size: 12px; margin-top: 20px;">
                This is an automated email. Please do not reply directly to this message.<br>
                Add donations@amcag.org to your contacts to ensure you receive our emails.
            </p>
        </div>
    </div>
</body>
</html>
        `,
        text: `
Dear ${donorName},

Thank you for your generous ${donationType} donation to AMCAG!

DONATION DETAILS:
Reference: #${donationId.substring(0, 8).toUpperCase()}
Date: ${new Date(createdAt).toLocaleDateString('en-GB')}
Type: ${donationType === 'monetary' ? 'Monetary' : 'Material'}
${donationType === 'monetary' ? `Amount: GHS ${amount ? amount.toFixed(2) : '0.00'}` : ''}
${campaignName ? `Campaign: ${campaignName}` : ''}
Status: Pending Confirmation

${donationType === 'material' && items && items.length > 0 ? `
ITEMS DONATED:
${items.map(item => `- ${item.name} - ${item.quantity} ${item.unit}`).join('\n')}
` : ''}

Your donation is being processed by our regional office and you will receive confirmation soon.

Thank you for your generosity!

Best regards,
AMCAG Team
www.amcag.org
        `
    };
};

/**
 * Donation Receipt Email  
 * Sent when regional office confirms the donation
 */
exports.donationReceiptEmail = (data) => {
    const { donorName, donationType, amount, items, campaignName, donationId, confirmedAt, regionalOfficer, receiptUrl } = data;

    const itemsList = items && items.length > 0
        ? items.map(item => `<li>${item.name} - ${item.quantity} ${item.unit}</li>`).join('')
        : '';

    return {
        subject: 'Official Receipt for Your Donation - AMCAG',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #28a745, #218838);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.95;
        }
        .success-badge {
            background: white;
            color: #28a745;
            display: inline-block;
            padding: 10px 20px;
            border-radius: 30px;
            font-size: 16px;
            font-weight: 600;
            margin-top: 15px;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
        }
        .receipt-box {
            border: 2px solid #28a745;
            border-radius: 8px;
            padding: 25px;
            margin: 25px 0;
            background: #f8fff9;
        }
        .receipt-header {
            text-align: center;
            border-bottom: 2px solid #28a745;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .receipt-header h2 {
            margin: 0;
            color: #28a745;
            font-size: 24px;
        }
        .receipt-number {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            color: #666;
            font-weight: 500;
        }
        .detail-value {
            font-weight: 600;
            color: #28a745;
        }
        .amount-highlight {
            background: #28a745;
            color: white;
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .items-list {
            background: white;
            border: 1px solid #d4edda;
            border-radius: 6px;
            padding: 15px;
            margin-top: 10px;
        }
        .items-list h4 {
            margin: 0 0 10px 0;
            color: #28a745;
        }
        .items-list ul {
            margin: 0;
            padding-left: 20px;
        }
        .items-list li {
            padding: 5px 0;
        }
        .download-section {
           background: #E3F2FD;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 25px 0;
        }
        .download-section h3 {
            margin: 0 0 10px 0;
            color: #1976D2;
        }
        .download-section p {
            margin: 0 0 15px 0;
            color: #666;
        }
        .btn {
            display: inline-block;
            background: #1976D2;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 5px;
        }
        .btn:hover {
            background: #1565C0;
        }
        .btn-success {
            background: #28a745;
        }
        .btn-success:hover {
            background: #218838;
        }
        .tax-notice {
            background: #FFF3CD;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .tax-notice strong {
            color: #856404;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
        }
        .footer p {
            margin: 10px 0;
            font-size: 14px;
        }
        .signature {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
        .signature p {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✓ Donation Confirmed!</h1>
            <p>Association of Methodist Church Administrators in Ghana</p>
            <div class="success-badge">Official Receipt</div>
        </div>
        
        <div class="content">
            <p class="greeting">Dear ${donorName},</p>
            
            <p>We are pleased to confirm that your donation has been received and verified. Thank you for your generous contribution to AMCAG's mission!</p>
            
            <div class="receipt-box">
                <div class="receipt-header">
                    <h2>OFFICIAL DONATION RECEIPT</h2>
                    <p class="receipt-number">Receipt #${donationId.substring(0, 8).toUpperCase()}</p>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Donor Name:</span>
                    <span class="detail-value">${donorName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date Received:</span>
                    <span class="detail-value">${new Date(confirmedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Donation Type:</span>
                    <span class="detail-value">${donationType === 'monetary' ? 'Monetary' : 'Material'}</span>
                </div>
                ${campaignName ? `
                    <div class="detail-row">
                        <span class="detail-label">Campaign:</span>
                        <span class="detail-value">${campaignName}</span>
                    </div>
                ` : ''}
                ${regionalOfficer ? `
                    <div class="detail-row">
                        <span class="detail-label">Confirmed By:</span>
                        <span class="detail-value">${regionalOfficer}</span>
                    </div>
                ` : ''}
                
                ${donationType === 'monetary' ? `
                    <div class="amount-highlight">
                        GHS ${amount ? amount.toFixed(2) : '0.00'}
                    </div>
                ` : ''}
                
                ${donationType === 'material' && itemsList ? `
                    <div class="items-list">
                        <h4>Items Received:</h4>
                        <ul>${itemsList}</ul>
                    </div>
                ` : ''}
            </div>
            
            ${donationType === 'monetary' ? `
                <div class="tax-notice">
                    <strong>Tax Deductible Donation:</strong> This receipt serves as official documentation for tax purposes. AMCAG is a registered organization, and your donation may be tax-deductible. Please consult with your tax advisor for specific guidance.
                </div>
            ` : ''}
            
            <div class="download-section">
                <h3>Download Your Receipt</h3>
                <p>A PDF copy of your official receipt is available for download:</p>
                ${receiptUrl ? `
                    <a href="${receiptUrl}" class="btn btn-success">Download PDF Receipt</a>
                ` : ''}
                <a href="https://amcag.org/member-dashboard/my-donations.html" class="btn">View All My Donations</a>
            </div>
            
            <p style="margin-top: 30px;">Your contribution helps us make a real difference in the lives of those we serve. We are grateful for your partnership in our mission to support children's homes, community development, and charitable initiatives across Ghana.</p>
            
            <div class="signature">
                <p><strong>With sincere gratitude,</strong></p>
                <p>The AMCAG Team</p>
                <p style="font-style: italic; color: #666; font-size: 14px;">
                    "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver." - 2 Corinthians 9:7
                </p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Association of Methodist Church Administrators in Ghana</strong></p>
            <p>Email: donations@amcag.org | Phone: +233 XX XXX XXXX</p>
            <p>Website: www.amcag.org</p>
            
            <p style="font-size: 12px; margin-top: 20px;">
                This is an automated email. Please do not reply directly to this message.<br>
                Keep this receipt for your records.
            </p>
        </div>
    </div>
</body>
</html>
        `,
        text: `
Dear ${donorName},

OFFICIAL DONATION RECEIPT
Receipt #${donationId.substring(0, 8).toUpperCase()}

Your donation has been confirmed and received!

RECEIPT DETAILS:
Donor: ${donorName}
Date Received: ${new Date(confirmedAt).toLocaleDateString('en-GB')}
Type: ${donationType === 'monetary' ? 'Monetary' : 'Material'}
${donationType === 'monetary' ? `Amount: GHS ${amount ? amount.toFixed(2) : '0.00'}` : ''}
${campaignName ? `Campaign: ${campaignName}` : ''}
${regionalOfficer ? `Confirmed By: ${regionalOfficer}` : ''}

${donationType === 'material' && items && items.length > 0 ? `
ITEMS RECEIVED:
${items.map(item => `- ${item.name} - ${item.quantity} ${item.unit}`).join('\n')}
` : ''}

${receiptUrl ? `Download your PDF receipt: ${receiptUrl}` : ''}

Thank you for your generous contribution to AMCAG's mission!

Best regards,
AMCAG Team
www.amcag.org
        `
    };
};

/**
 * Distribution Notification Email
 * Sent when donated items/funds are distributed
 */
exports.distributionNotificationEmail = (data) => {
    const { donorName, donationType, amount, items, distributionDate, beneficiaryName, beneficiaryType, impact, distributionPhotos, regionalOfficer } = data;

    const photoGallery = distributionPhotos && distributionPhotos.length > 0
        ? distributionPhotos.slice(0, 4).map(photo => `
            <div style="display: inline-block; width: 48%; margin: 1%; vertical-align: top;">
                <img src="${photo.url}" alt="Distribution photo" style="width: 100%; border-radius: 8px; height: 150px; object-fit: cover;">
            </div>
        `).join('')
        : '';

    return {
        subject: 'Your Donation Has Made an Impact! - AMCAG',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #9C27B0, #7B1FA2);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.95;
        }
        .impact-badge {
            background: white;
            color: #9C27B0;
            display: inline-block;
            padding: 10px 20px;
            border-radius: 30px;
            font-size: 16px;
            font-weight: 600;
            margin-top: 15px;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
        }
        .impact-box {
            background: linear-gradient(135deg, #F3E5F5, #E1BEE7);
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            text-align: center;
        }
        .impact-box h2 {
            margin: 0 0 15px 0;
            color: #7B1FA2;
            font-size: 24px;
        }
        .impact-box p {
            margin: 0;
            font-size: 16px;
            color: #4A148C;
            font-weight: 500;
        }
        .distribution-details {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            color: #666;
            font-weight: 500;
        }
        .detail-value {
            font-weight: 600;
            color: #9C27B0;
        }
        .photo-gallery {
            margin: 25px 0;
        }
        .photo-gallery h3 {
            margin: 0 0 15px 0;
            color: #7B1FA2;
        }
        .quote-box {
            background: #FFF9C4;
            border-left: 4px solid #FBC02D;
            padding: 20px;
            margin: 25px 0;
            font-style: italic;
            border-radius: 4px;
        }
        .thank-you-message {
            background: linear-gradient(135deg, #E8F5E9, #C8E6C9);
            padding: 25px;
            border-radius: 8px;
            margin: 25px 0;
            text-align: center;
        }
        .thank-you-message h3 {
            margin: 0 0 10px 0;
            color: #2E7D32;
            font-size: 22px;
        }
        .thank-you-message p {
            margin: 0;
            color: #1B5E20;
        }
        .btn {
            display: inline-block;
            background: #9C27B0;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 10px;
        }
        .btn:hover {
            background: #7B1FA2;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
        }
        .footer p {
            margin: 10px 0;
            font-size: 14px;
        }
        .stats-row {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
        }
        .stat-item {
            text-align: center;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #9C27B0;
            display: block;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            display: block;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Your Donation Made an Impact!</h1>
            <p>Association of Methodist Church Administrators in Ghana</p>
            <div class="impact-badge">Distribution Complete</div>
        </div>
        
        <div class="content">
            <p class="greeting">Dear ${donorName},</p>
            
            <p>We are excited to share wonderful news with you! Your generous ${donationType} donation has been distributed and is already making a difference in the lives of those we serve.</p>
            
            <div class="impact-box">
                <h2>Your Impact</h2>
                <p>${impact || `Your contribution has blessed ${beneficiaryName} and helped us fulfill our mission of serving others with love and compassion.`}</p>
            </div>
            
            <div class="distribution-details">
                <h3 style="margin-top: 0; color: #7B1FA2;">Distribution Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Distribution Date:</span>
                    <span class="detail-value">${new Date(distributionDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Beneficiary:</span>
                    <span class="detail-value">${beneficiaryName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${beneficiaryType || 'Community Outreach'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Donation Type:</span>
                    <span class="detail-value">${donationType === 'monetary' ? `Monetary (GHS ${amount ? amount.toFixed(2) : '0.00'})` : `Material (${items ? items.length : 0} items)`}</span>
                </div>
                ${regionalOfficer ? `
                    <div class="detail-row">
                        <span class="detail-label">Coordinated By:</span>
                        <span class="detail-value">${regionalOfficer}</span>
                    </div>
                ` : ''}
            </div>
            
            ${photoGallery ? `
                <div class="photo-gallery">
                    <h3>Distribution Photos</h3>
                    <div style="text-align: center;">
                        ${photoGallery}
                    </div>
                    <p style="text-align: center; margin-top: 15px; color: #666; font-size: 14px;">
                        <a href="https://amcag.org/member-dashboard/my-donations.html" style="color: #9C27B0;">View all photos in your dashboard →</a>
                    </p>
                </div>
            ` : ''}
            
            <div class="quote-box">
                <p>"Whoever is kind to the poor lends to the Lord, and he will reward them for what they have done." - Proverbs 19:17</p>
            </div>
            
            <div class="thank-you-message">
                <h3>Thank You for Being a Blessing!</h3>
                <p>Your generosity exemplifies the spirit of giving and compassion. Together, we are making a real difference in our communities across Ghana.</p>
            </div>
            
            <center>
                <a href="https://amcag.org/member-dashboard/my-donations.html" class="btn">View My Impact</a>
                <a href="https://amcag.org/member-dashboard/donate.html" class="btn">Make Another Donation</a>
            </center>
            
            <p style="margin-top: 30px; text-align: center; color: #666;">
                Want to stay updated on our outreach programs? Follow us on social media or visit our website to see more stories of impact!
            </p>
        </div>
        
        <div class="footer">
            <p><strong>Association of Methodist Church Administrators in Ghana</strong></p>
            <p>Email: donations@amcag.org | Phone: +233 XX XXX XXXX</p>
            <p>Website: www.amcag.org</p>
            
            <p style="font-size: 12px; margin-top: 20px;">
               This is an automated notification. Please do not reply directly to this message.<br>
                Thank you for your continued support!
            </p>
        </div>
    </div>
</body>
</html>
        `,
        text: `
Dear ${donorName},

YOUR DONATION MADE AN IMPACT!

Your generous ${donationType} donation has been distributed successfully!

DISTRIBUTION DETAILS:
Date: ${new Date(distributionDate).toLocaleDateString('en-GB')}
Beneficiary: ${beneficiaryName}
Type: ${beneficiaryType || 'Community Outreach'}
Donation: ${donationType === 'monetary' ? `GHS ${amount ? amount.toFixed(2) : '0.00'}` : `${items ? items.length : 0} items`}
${regionalOfficer ? `Coordinated By: ${regionalOfficer}` : ''}

YOUR IMPACT:
${impact || `Your contribution has blessed ${beneficiaryName} and helped us fulfill our mission.`}

View photos and more details: https://amcag.org/member-dashboard/my-donations.html

Thank you for being a blessing to others!

Best regards,
AMCAG Team
www.amcag.org
        `
    };
};
