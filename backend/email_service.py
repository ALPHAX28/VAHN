import os
import smtplib
from email.message import EmailMessage

def send_otp_email(to_email: str, otp_code: str, subject: str = "Your VAHN Verification Code") -> bool:
    """
    Sends a 6-digit OTP email using Brevo SMTP.
    If SMTP credentials are not set in environment, logs to console for seamless dev testing.
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp-relay.brevo.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    from_email = os.getenv("EMAILS_FROM_EMAIL", "noreply@vahn.com")
    from_name = os.getenv("EMAILS_FROM_NAME", "VAHN Official")

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{subject}</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f7f7; margin: 0; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 40px; border: 1px solid #e2e2e2;">
        <h1 style="font-size: 24px; font-weight: 800; letter-spacing: 0.2em; text-align: center; text-transform: uppercase; margin-bottom: 24px; color: #111111;">VAHN</h1>
        <p style="font-size: 15px; color: #444444; line-height: 1.6; text-align: center;">Use the verification code below to complete your authentication process:</p>
        <div style="margin: 32px 0; text-align: center;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 0.3em; background: #000000; color: #ffffff; padding: 12px 28px; display: inline-block;">{otp_code}</span>
        </div>
        <p style="font-size: 13px; color: #888888; line-height: 1.5; text-align: center; margin-top: 32px;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
        <p style="font-size: 11px; color: #aaaaaa; text-align: center; text-transform: uppercase; letter-spacing: 0.1em;">&copy; 2026 VAHN. All rights reserved.</p>
      </div>
    </body>
    </html>
    """

    print(f"\n==========================================")
    print(f"  [OTP EMAIL RECIPIENT]: {to_email}")
    print(f"  [OTP VERIFICATION CODE]: {otp_code}")
    print(f"==========================================\n")

    if not smtp_user or not smtp_password:
        print("[EMAIL SERVICE] Brevo SMTP credentials not set in .env. OTP printed to console above.")
        return True

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        msg.set_content(f"Your VAHN verification code is: {otp_code}")
        msg.add_alternative(html_content, subtype="html")

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)

        print(f"[EMAIL SERVICE] OTP email successfully sent to {to_email} via Brevo SMTP.")
        return True
    except Exception as e:
        print(f"[EMAIL SERVICE ERROR] Failed to send email via Brevo SMTP: {e}")
        return False

def send_order_confirmation_email(to_email: str, order_id: str, total_amount: float, currency: str = "INR", items_summary: list = None) -> bool:
    """
    Sends an Order Confirmation email asynchronously using Brevo SMTP.
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp-relay.brevo.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    from_email = os.getenv("EMAILS_FROM_EMAIL", "noreply@vahn.com")
    from_name = os.getenv("EMAILS_FROM_NAME", "VAHN Official")

    items_html = ""
    if items_summary:
        for item in items_summary:
            items_html += f"""
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee;">
                <strong>{item.get('title', 'Product')}</strong> ({item.get('variant', 'Default')}) x {item.get('quantity', 1)}
              </td>
              <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; text-align: right;">
                {currency} {item.get('price', 0.0):.2f}
              </td>
            </tr>
            """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation #{order_id}</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f7f7; margin: 0; padding: 40px 20px;">
      <div style="max-width: 550px; margin: 0 auto; background: #ffffff; padding: 40px; border: 1px solid #e2e2e2;">
        <h1 style="font-size: 24px; font-weight: 800; letter-spacing: 0.2em; text-align: center; text-transform: uppercase; margin-bottom: 8px; color: #111111;">VAHN</h1>
        <p style="font-size: 13px; font-weight: 600; text-align: center; text-transform: uppercase; letter-spacing: 0.1em; color: #666666; margin-bottom: 32px;">Order Confirmed #{order_id}</p>
        
        <p style="font-size: 15px; color: #444444; line-height: 1.6;">Thank you for shopping with VAHN. We have received your order and are preparing it for dispatch.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; color: #333333;">
          <thead>
            <tr style="border-bottom: 2px solid #111111; text-align: left;">
              <th style="padding-bottom: 8px;">Item</th>
              <th style="padding-bottom: 8px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            {items_html or '<tr><td colspan="2" style="padding: 12px 0;">Order details processed.</td></tr>'}
          </tbody>
        </table>

        <div style="text-align: right; margin-top: 16px; font-size: 16px; font-weight: 800; color: #111111;">
          Total Paid: {currency} {total_amount:.2f}
        </div>

        <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
        <p style="font-size: 11px; color: #aaaaaa; text-align: center; text-transform: uppercase; letter-spacing: 0.1em;">&copy; 2026 VAHN. All rights reserved.</p>
      </div>
    </body>
    </html>
    """

    print(f"\n==========================================")
    print(f"  [ORDER EMAIL RECIPIENT]: {to_email}")
    print(f"  [ORDER ID]: {order_id}")
    print(f"  [TOTAL AMOUNT]: {currency} {total_amount:.2f}")
    print(f"==========================================\n")

    if not smtp_user or not smtp_password:
        print("[EMAIL SERVICE] Brevo SMTP credentials not set in .env. Order confirmation printed to console above.")
        return True

    try:
        msg = EmailMessage()
        msg["Subject"] = f"Order Confirmation #{order_id} - VAHN Official"
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        msg.set_content(f"Thank you for your order #{order_id}! Total amount: {currency} {total_amount:.2f}")
        msg.add_alternative(html_content, subtype="html")

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)

        print(f"[EMAIL SERVICE] Order confirmation email successfully sent to {to_email} via Brevo SMTP.")
        return True
    except Exception as e:
        print(f"[EMAIL SERVICE ERROR] Failed to send order confirmation email via Brevo SMTP: {e}")
        return False

