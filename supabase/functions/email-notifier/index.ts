import "@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  // Check request method
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log("Received webhook payload:", payload);

    // Validate the event structure
    if (!payload || payload.table !== 'orders') {
      return new Response('Invalid table or payload', { status: 400 });
    }

    const { type, record, old_record } = payload;

    // We only care about status updates
    if (type !== 'UPDATE') {
      return new Response('Ignore non-UPDATE events', { status: 200 });
    }

    if (!record || !old_record) {
      return new Response('Missing records', { status: 400 });
    }

    const oldStatus = old_record.status;
    const newStatus = record.status;

    // Check if status changed
    if (oldStatus === newStatus) {
      return new Response('Status did not change', { status: 200 });
    }

    // Check if the new status is "printing" or "done"
    if (newStatus !== 'printing' && newStatus !== 'done') {
      return new Response(`Ignore status: ${newStatus}`, { status: 200 });
    }

    // Get Resend API Key
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY is not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    // Determine recipient
    const originalEmail = record.email;
    const testRecipient = Deno.env.get('TEST_RECIPIENT_EMAIL');
    
    // If testRecipient is set, override the recipient (sandbox mode)
    const recipient = testRecipient ? testRecipient : originalEmail;

    if (!recipient) {
      return new Response('No recipient email available', { status: 400 });
    }

    // Construct email content (NO EMOJIS, clean aesthetics, McLaren Orange color #FF8000)
    let subject = "";
    let statusTitle = "";
    let statusText = "";
    const accentColor = "#FF8000"; // McLaren orange

    if (newStatus === 'printing') {
      subject = `Update on your order: Printing started`;
      statusTitle = `Your Order is Printing`;
      statusText = `We have started printing your 3D design. Our team is monitoring the print for high quality.`;
    } else if (newStatus === 'done') {
      subject = `Your order is ready! - JUST print`;
      statusTitle = `Your Order is Ready`;
      statusText = `Great news! Your 3D print is completed, inspected, and ready for you to pick up.`;
    }

    const sandboxNotice = testRecipient 
      ? `<div style="background-color: #222222; color: #FF8000; padding: 12px; border-radius: 6px; font-size: 13px; font-weight: bold; margin-bottom: 24px; text-align: center; border: 1px solid #FF8000; font-family: sans-serif;">
          Sandbox Testing Mode: This email was generated for customer ${record.name || 'Unknown'} (${originalEmail})
         </div>`
      : "";

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d0d0d; color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d0d0d; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; width: 100%; background-color: #161616; border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; border-spacing: 0; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 30px 40px; border-bottom: 1px solid #2a2a2a; text-align: center;">
              <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 0.05em; text-transform: uppercase;">
                JUST <span style="color: ${accentColor};">print</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              ${sandboxNotice}

              <h2 style="font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px;">
                ${statusTitle}
              </h2>
              
              <p style="font-size: 15px; line-height: 1.6; color: #cccccc; margin-top: 0; margin-bottom: 24px;">
                Hello ${record.name || 'Customer'},
              </p>
              
              <p style="font-size: 15px; line-height: 1.6; color: #cccccc; margin-top: 0; margin-bottom: 24px;">
                ${statusText}
              </p>

              <!-- Order Details Table -->
              <table width="100%" style="background-color: #202020; border-radius: 8px; border-spacing: 0; padding: 20px; margin-bottom: 30px; border: 1px solid #2a2a2a;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #888888; font-weight: bold; text-transform: uppercase; width: 130px;">Order Name:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #ffffff; font-weight: 600;">${record.ordername || '3D Print'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #888888; font-weight: bold; text-transform: uppercase;">Tracking Code:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: ${accentColor}; font-family: monospace; font-weight: bold; letter-spacing: 0.05em;">${record.tracking_code}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #888888; font-weight: bold; text-transform: uppercase;">Material:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #ffffff;">${record.material || 'Standard PLA'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #888888; font-weight: bold; text-transform: uppercase;">Color:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #ffffff;">${record.color || 'Default'}</td>
                </tr>
              </table>

              <!-- Call to Action -->
              <div style="text-align: center; margin-bottom: 10px;">
                <a href="https://3bdallahhahmed.github.io/3D-EJUST/#track" style="display: inline-block; background-color: ${accentColor}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 14px; font-weight: bold; letter-spacing: 0.03em; box-shadow: 0 4px 12px rgba(255, 128, 0, 0.3);">
                  Track Order Status
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #111111; padding: 30px; text-align: center; border-top: 1px solid #2a2a2a;">
              <p style="font-size: 12px; color: #666666; margin: 0 0 10px 0;">
                This is an automated notification from JUST print. Please do not reply directly to this email.
              </p>
              <p style="font-size: 12px; color: #666666; margin: 0;">
                JUST print campus 3D printing hub.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    // Send email using Resend API
    console.log(`Sending email via Resend to ${recipient}...`);
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'JUST print <onboarding@resend.dev>',
        to: [recipient],
        subject: subject,
        html: htmlContent
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API returned error:', resendData);
      return new Response(JSON.stringify({ error: resendData }), { 
        status: resendResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Email sent successfully:', resendData);
    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error processing webhook:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
