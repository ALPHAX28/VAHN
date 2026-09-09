import os
import smtplib
from email.message import EmailMessage
from typing import Optional, List, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()


def _get_ses_client():
    """Returns a boto3 SES client if explicit SES AWS credentials are configured in environment."""
    aws_access_key = (os.getenv("AWS_SES_ACCESS_KEY_ID") or "").strip()
    aws_secret_key = (os.getenv("AWS_SES_SECRET_ACCESS_KEY") or "").strip()
    aws_ses_region = os.getenv("AWS_SES_REGION", os.getenv("AWS_REGION", "ap-south-1")).strip()

    if not aws_access_key or not aws_secret_key:
        return None

    try:
        import boto3
        return boto3.client(
            "ses",
            region_name=aws_ses_region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
        )
    except Exception as e:
        print(f"[EMAIL SERVICE WARNING] Failed to initialize boto3 SES client: {e}")
        return None


def _send_email(to_email: str, subject: str, html_content: str, text_content: Optional[str] = None, reply_to: Optional[str] = None) -> bool:
    """
    Central Email Dispatcher for VAHN using Amazon SES.
    1. Uses Amazon SES SMTP (smtplib) with configured IAM SES credentials for instant, verified delivery.
    2. Uses native Amazon SES API if explicit AWS_SES_ACCESS_KEY_ID is provided.
    3. In local development with no credentials, logs message to console and returns True.
    """
    from_email = os.getenv("EMAILS_FROM_EMAIL", "noreply@vahnsports.com").strip()
    from_name = os.getenv("EMAILS_FROM_NAME", "VAHN Official").strip()
    source_address = f"{from_name} <{from_email}>" if from_name else from_email
    plain_text = text_content or subject

    # ------------------------------------------------------------
    # Method 1: Amazon SES SMTP (Primary Dispatcher)
    # ------------------------------------------------------------
    smtp_host = os.getenv("SMTP_HOST", "email-smtp.ap-south-1.amazonaws.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()

    if smtp_user and smtp_password and not smtp_user.startswith("your_"):
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = source_address
            msg["To"] = to_email
            if reply_to:
                msg["Reply-To"] = reply_to
            msg.set_content(plain_text)
            msg.add_alternative(html_content, subtype="html")

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

            print(f"[EMAIL SERVICE] Email successfully sent to {to_email} via Amazon SES SMTP.")
            return True
        except Exception as e:
            print(f"[EMAIL SERVICE ERROR] Failed to send email via Amazon SES SMTP: {e}")
            # Try fallback to SES API if configured below

    # ------------------------------------------------------------
    # Method 2: Amazon SES Direct HTTPS API (boto3 fallback)
    # ------------------------------------------------------------
    ses_client = _get_ses_client()
    if ses_client is not None:
        try:
            send_kwargs = {
                "Source": source_address,
                "Destination": {"ToAddresses": [to_email]},
                "Message": {
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": html_content, "Charset": "UTF-8"},
                        "Text": {"Data": plain_text, "Charset": "UTF-8"},
                    },
                },
            }
            if reply_to:
                send_kwargs["ReplyToAddresses"] = [reply_to]
            response = ses_client.send_email(**send_kwargs)
            message_id = response.get("MessageId", "N/A")
            print(f"[EMAIL SERVICE] Email successfully sent to {to_email} via Amazon SES API (MessageId: {message_id})")
            return True
        except Exception as e:
            print(f"[EMAIL SERVICE ERROR] Amazon SES API send failed: {e}")
            return False

    # ------------------------------------------------------------
    # Method 3: Local Dev Mode (Credentials not set)
    # ------------------------------------------------------------
    print("[EMAIL SERVICE - Amazon SES (Local Dev Mode)] AWS SES credentials / SMTP credentials not set in .env. Email logged above.")
    return True


def send_otp_email(to_email: str, otp_code: str, subject: str = "Your VAHN Verification Code") -> bool:
    """
    Sends a 6-digit OTP email using Amazon SES.
    """
    site_url = os.getenv("FRONTEND_URL", "https://vahnsports.com").rstrip("/")
    logo_url = f"{site_url}/assets/logo.png"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{subject}</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f7f7; margin: 0; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 40px; border: 1px solid #e2e2e2;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="{logo_url}" alt="VAHN" width="120" style="height: 28px; width: auto; max-width: 140px; display: inline-block; border: 0; outline: none; text-decoration: none; color: #111111; font-size: 20px; font-weight: 800; letter-spacing: 0.2em;" />
        </div>
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

    return _send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=f"Your VAHN verification code is: {otp_code}. Valid for 10 minutes."
    )


def send_order_confirmation_email(to_email: str, order_id: str, total_amount: float, currency: str = "INR", items_summary: list = None) -> bool:
    """
    Sends an Order Confirmation email asynchronously using Amazon SES.
    """
    site_url = os.getenv("FRONTEND_URL", "https://vahnsports.com").rstrip("/")
    logo_url = f"{site_url}/assets/logo.png"

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
        <div style="text-align: center; margin-bottom: 12px;">
          <img src="{logo_url}" alt="VAHN" width="120" style="height: 28px; width: auto; max-width: 140px; display: inline-block; border: 0; outline: none; text-decoration: none; color: #111111; font-size: 20px; font-weight: 800; letter-spacing: 0.2em;" />
        </div>
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

    return _send_email(
        to_email=to_email,
        subject=f"Order Confirmation #{order_id} - VAHN Official",
        html_content=html_content,
        text_content=f"Thank you for your order #{order_id}! Total amount: {currency} {total_amount:.2f}"
    )


def send_restock_notification_email(to_email: str, product_title: str, product_handle: str, colour_value: str = "", image_url: str = "") -> bool:
    """
    Sends a high-fashion VAHN Restock Notification email via Amazon SES.
    """
    site_url = os.getenv("FRONTEND_URL", "https://vahnsports.com").rstrip("/")
    product_link = f"{site_url}/products/{product_handle}"
    logo_white_url = f"{site_url}/assets/logo-white.png"

    variant_info = f"({colour_value})" if colour_value else ""

    full_image_url = ""
    if image_url:
        if image_url.startswith("http://") or image_url.startswith("https://"):
            full_image_url = image_url
        elif image_url.startswith("/"):
            full_image_url = f"{site_url}{image_url}"

    image_html = f"""
    <div style="text-align: center; margin: 24px 0;">
      <img src="{full_image_url}" alt="{product_title}" style="max-width: 100%; height: auto; max-height: 260px; border: 1px solid #eeeeee;" />
    </div>
    """ if full_image_url else ""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Back In Stock: {product_title} - VAHN</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 2px solid #000000; overflow: hidden;">
        
        <!-- Header Banner -->
        <div style="background-color: #000000; padding: 24px; text-align: center;">
          <img src="{logo_white_url}" alt="VAHN" width="120" style="height: 28px; width: auto; max-width: 140px; display: inline-block; vertical-align: middle; border: 0; outline: none; text-decoration: none; color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: 0.25em;" />
        </div>

        <!-- Content Area -->
        <div style="padding: 36px 30px; text-align: center;">
          
          <span style="display: inline-block; background: #d32f2f; color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; padding: 4px 12px; text-transform: uppercase; margin-bottom: 16px;">
            BACK IN STOCK
          </span>

          <h1 style="font-size: 22px; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; color: #000000; margin: 0 0 8px; line-height: 1.3;">
            {product_title} {variant_info}
          </h1>

          <p style="font-size: 14px; color: #555555; line-height: 1.6; margin: 16px 0 24px;">
            Good news! The item you requested restock notifications for is now back in stock and ready to order. Quantities are limited.
          </p>

          {image_html}

          <!-- Action Button -->
          <div style="margin: 32px 0 24px;">
            <a href="{product_link}" style="background-color: #000000; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; padding: 16px 36px; display: inline-block; border-radius: 0px;">
              SHOP NOW &amp; SECURE YOURS &rarr;
            </a>
          </div>

          <p style="font-size: 12px; color: #888888; margin-top: 24px;">
            Need help? Visit <a href="{site_url}" style="color: #000000; text-decoration: underline;">vahnsports.com</a> or reply to this email.
          </p>

        </div>

        <!-- Footer -->
        <div style="background-color: #f9f9f9; padding: 20px; border-top: 1px solid #eeeeee; text-align: center;">
          <p style="font-size: 11px; color: #999999; margin: 0; text-transform: uppercase; letter-spacing: 0.1em;">
            &copy; 2026 VAHN &bull; Bespoke Teamwear &amp; Apparel
          </p>
        </div>

      </div>
    </body>
    </html>
    """

    return _send_email(
        to_email=to_email,
        subject=f"Back In Stock: {product_title} - VAHN Official",
        html_content=html_content,
        text_content=f"Good news! {product_title} {variant_info} is back in stock. View at: {product_link}"
    )


def send_account_suspended_email(to_email: str, name: str = "", reason: str = "") -> bool:
    """
    Sends an Account Suspension email notification to the customer via Amazon SES.
    """
    if not to_email:
        return False

    site_url = os.getenv("FRONTEND_URL", "https://vahnsports.com").rstrip("/")
    logo_url = f"{site_url}/assets/logo.png"

    customer_name = name or to_email
    reason_html = f"<div style='background:#fef2f2; border-left:4px solid #dc2626; padding:12px 16px; margin:20px 0; color:#b91c1c; font-size:14px;'><strong>Reason:</strong> {reason}</div>" if reason else ""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Important: Account Suspended</title></head>
    <body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background-color:#f7f7f7; margin:0; padding:40px 20px;">
      <div style="max-width:520px; margin:0 auto; background:#ffffff; padding:40px; border:1px solid #e2e2e2;">
        <div style="text-align:center; margin-bottom:24px;">
          <img src="{logo_url}" alt="VAHN" width="120" style="height:28px; width:auto; border:0;" />
        </div>
        <div style="text-align:center; margin-bottom:20px;">
          <span style="background:#dc2626; color:#fff; font-size:11px; font-weight:800; padding:4px 12px; letter-spacing:0.15em; text-transform:uppercase;">ACCOUNT SUSPENDED</span>
        </div>
        <p style="font-size:15px; color:#333; line-height:1.6;">Dear {customer_name},</p>
        <p style="font-size:14px; color:#555; line-height:1.6;">Your VAHN account has been suspended by our administration team. You will not be able to log in or place new orders while your account is suspended.</p>
        {reason_html}
        <p style="font-size:13px; color:#666; line-height:1.6; margin-top:24px;">If you believe this is an error or would like to appeal this decision, please reply to this email or contact support.</p>
        <hr style="border:none; border-top:1px solid #eeeeee; margin:32px 0;">
        <p style="font-size:11px; color:#aaaaaa; text-align:center; text-transform:uppercase; letter-spacing:0.1em;">&copy; 2026 VAHN. All rights reserved.</p>
      </div>
    </body>
    </html>
    """

    print(f"\n==========================================")
    print(f"  [SUSPENSION EMAIL RECIPIENT]: {to_email}")
    print(f"  [CUSTOMER NAME]: {customer_name}")
    print(f"  [SUSPENSION REASON]: {reason or 'N/A'}")
    print(f"==========================================\n")

    return _send_email(
        to_email=to_email,
        subject="Important Notice: Your VAHN Account Has Been Suspended",
        html_content=html_content,
        text_content=f"Dear {customer_name}, your VAHN account has been suspended. Reason: {reason or 'N/A'}"
    )


def send_account_reactivated_email(to_email: str, name: str = "") -> bool:
    """
    Sends an Account Reactivation email notification to the customer via Amazon SES.
    """
    if not to_email:
        return False

    site_url = os.getenv("FRONTEND_URL", "https://vahnsports.com").rstrip("/")
    logo_url = f"{site_url}/assets/logo.png"

    customer_name = name or to_email

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Account Reactivated</title></head>
    <body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background-color:#f7f7f7; margin:0; padding:40px 20px;">
      <div style="max-width:520px; margin:0 auto; background:#ffffff; padding:40px; border:1px solid #e2e2e2;">
        <div style="text-align:center; margin-bottom:24px;">
          <img src="{logo_url}" alt="VAHN" width="120" style="height:28px; width:auto; border:0;" />
        </div>
        <div style="text-align:center; margin-bottom:20px;">
          <span style="background:#16a34a; color:#fff; font-size:11px; font-weight:800; padding:4px 12px; letter-spacing:0.15em; text-transform:uppercase;">ACCOUNT REACTIVATED</span>
        </div>
        <p style="font-size:15px; color:#333; line-height:1.6;">Dear {customer_name},</p>
        <p style="font-size:14px; color:#555; line-height:1.6;">Good news! Your VAHN account has been successfully reactivated. You can now log back in and continue shopping.</p>
        <div style="text-align:center; margin:32px 0;">
          <a href="{site_url}" style="background:#000; color:#fff; text-decoration:none; font-size:13px; font-weight:800; padding:14px 32px; letter-spacing:0.15em; text-transform:uppercase;">LOG IN TO VAHN &rarr;</a>
        </div>
        <hr style="border:none; border-top:1px solid #eeeeee; margin:32px 0;">
        <p style="font-size:11px; color:#aaaaaa; text-align:center; text-transform:uppercase; letter-spacing:0.1em;">&copy; 2026 VAHN. All rights reserved.</p>
      </div>
    </body>
    </html>
    """

    print(f"\n==========================================")
    print(f"  [REACTIVATION EMAIL RECIPIENT]: {to_email}")
    print(f"  [CUSTOMER NAME]: {customer_name}")
    print(f"==========================================\n")

    return _send_email(
        to_email=to_email,
        subject="Welcome Back! Your VAHN Account Has Been Reactivated",
        html_content=html_content,
        text_content=f"Dear {customer_name}, your VAHN account has been reactivated. You can log in at {site_url}"
    )


def send_account_deleted_email(to_email: str, name: str = "") -> bool:
    """
    Sends an Account Deletion notification email to the customer via Amazon SES.
    """
    if not to_email:
        return False

    site_url = os.getenv("FRONTEND_URL", "https://vahnsports.com").rstrip("/")
    logo_url = f"{site_url}/assets/logo.png"

    customer_name = name or to_email

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Account Deleted</title></head>
    <body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background-color:#f7f7f7; margin:0; padding:40px 20px;">
      <div style="max-width:520px; margin:0 auto; background:#ffffff; padding:40px; border:1px solid #e2e2e2;">
        <div style="text-align:center; margin-bottom:24px;">
          <img src="{logo_url}" alt="VAHN" width="120" style="height:28px; width:auto; border:0;" />
        </div>
        <div style="text-align:center; margin-bottom:20px;">
          <span style="background:#000; color:#fff; font-size:11px; font-weight:800; padding:4px 12px; letter-spacing:0.15em; text-transform:uppercase;">ACCOUNT DELETED</span>
        </div>
        <p style="font-size:15px; color:#333; line-height:1.6;">Dear {customer_name},</p>
        <p style="font-size:14px; color:#555; line-height:1.6;">This email confirms that your VAHN customer account and personal data have been removed from our database by administration.</p>
        <p style="font-size:13px; color:#666; line-height:1.6; margin-top:20px;">Thank you for being part of VAHN. If you have any questions, feel free to contact us.</p>
        <hr style="border:none; border-top:1px solid #eeeeee; margin:32px 0;">
        <p style="font-size:11px; color:#aaaaaa; text-align:center; text-transform:uppercase; letter-spacing:0.1em;">&copy; 2026 VAHN. All rights reserved.</p>
      </div>
    </body>
    </html>
    """

    print(f"\n==========================================")
    print(f"  [DELETION EMAIL RECIPIENT]: {to_email}")
    print(f"  [CUSTOMER NAME]: {customer_name}")
    print(f"==========================================\n")

    return _send_email(
        to_email=to_email,
        subject="Notice: Your VAHN Customer Account Has Been Deleted",
        html_content=html_content,
        text_content=f"Dear {customer_name}, your VAHN account has been removed."
    )


def send_contact_inquiry_notification(inquiry_data: dict) -> bool:
    """
    Sends customer inquiry notification to the VAHN Support team (support@vahnsports.com).
    Sets Reply-To header to the customer's email so support can reply directly.
    """
    support_email = os.getenv("SUPPORT_EMAIL", os.getenv("EMAILS_FROM_EMAIL", "support@vahnsports.com")).strip()
    first_name = inquiry_data.get("first_name", "")
    last_name = inquiry_data.get("last_name", "")
    customer_name = f"{first_name} {last_name}".strip() or "Customer"
    customer_email = inquiry_data.get("email", "")
    country_code = inquiry_data.get("country_code", "+91")
    phone = inquiry_data.get("phone", "")
    full_phone = f"{country_code} {phone}".strip() if phone else "Not provided"
    order_number = inquiry_data.get("order_number", "") or "N/A"
    subject_topic = inquiry_data.get("subject", "General Inquiry")
    message_body = inquiry_data.get("message", "")
    created_at = datetime.utcnow().strftime("%d %b %Y, %I:%M %p UTC")

    site_url = os.getenv("FRONTEND_URL", "https://vahnsports.com").rstrip("/")
    logo_url = f"{site_url}/assets/logo.png"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>New Customer Inquiry</title></head>
    <body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background-color:#f7f7f7; margin:0; padding:40px 20px;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:40px; border:1px solid #e2e2e2;">
        <div style="text-align:center; margin-bottom:24px;">
          <img src="{logo_url}" alt="VAHN" width="120" style="height:28px; width:auto; border:0;" />
        </div>
        <div style="text-align:center; margin-bottom:24px;">
          <span style="background:#4232d9; color:#fff; font-size:11px; font-weight:800; padding:5px 14px; letter-spacing:0.15em; text-transform:uppercase;">NEW CONTACT INQUIRY</span>
        </div>
        <h2 style="font-size:18px; color:#111; margin:0 0 16px; text-transform:uppercase; letter-spacing:-0.02em;">Inquiry Details</h2>
        <table style="width:100%; border-collapse:collapse; margin-bottom:24px; font-size:14px;">
          <tr>
            <td style="padding:8px 0; color:#888; width:130px; font-weight:600; text-transform:uppercase; font-size:11px;">Customer</td>
            <td style="padding:8px 0; color:#111; font-weight:700;">{customer_name}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#888; font-weight:600; text-transform:uppercase; font-size:11px;">Email</td>
            <td style="padding:8px 0;"><a href="mailto:{customer_email}" style="color:#4232d9; text-decoration:none; font-weight:600;">{customer_email}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#888; font-weight:600; text-transform:uppercase; font-size:11px;">Phone</td>
            <td style="padding:8px 0; color:#111;">{full_phone}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#888; font-weight:600; text-transform:uppercase; font-size:11px;">Order #</td>
            <td style="padding:8px 0; color:#111; font-weight:600;">{order_number}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#888; font-weight:600; text-transform:uppercase; font-size:11px;">Topic</td>
            <td style="padding:8px 0; color:#111; font-weight:600;">{subject_topic}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#888; font-weight:600; text-transform:uppercase; font-size:11px;">Submitted</td>
            <td style="padding:8px 0; color:#666;">{created_at}</td>
          </tr>
        </table>
        <div style="background:#fbfbfb; border-left:3px solid #4232d9; padding:20px; margin-bottom:28px;">
          <strong style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#888; margin-bottom:8px;">Message:</strong>
          <p style="margin:0; font-size:14px; line-height:1.7; color:#222; white-space:pre-wrap;">{message_body}</p>
        </div>
        <div style="text-align:center; margin-top:28px;">
          <a href="mailto:{customer_email}?subject=Re:%20{subject_topic}%20-%20VAHN%20Support" style="background:#4232d9; color:#fff; text-decoration:none; font-size:12px; font-weight:800; padding:12px 28px; letter-spacing:0.1em; text-transform:uppercase; display:inline-block;">REPLY TO CUSTOMER &rarr;</a>
        </div>
        <hr style="border:none; border-top:1px solid #eeeeee; margin:32px 0;">
        <p style="font-size:11px; color:#aaaaaa; text-align:center; text-transform:uppercase; letter-spacing:0.1em;">VAHN Operations &bull; Customer Support Notification</p>
      </div>
    </body>
    </html>
    """

    email_subject = f"New Inquiry from {customer_name}: {subject_topic}"
    return _send_email(
        to_email=support_email,
        subject=email_subject,
        html_content=html_content,
        text_content=f"New inquiry from {customer_name} ({customer_email}, Phone: {full_phone}):\n\n{message_body}",
        reply_to=customer_email
    )


def send_contact_inquiry_receipt(to_email: str, customer_name: str = "", subject_topic: str = "") -> bool:
    """
    Sends an automatic inquiry receipt to the customer reassuring them that their message was received.
    """
    if not to_email:
        return False

    site_url = os.getenv("FRONTEND_URL", "https://vahnsports.com").rstrip("/")
    logo_url = f"{site_url}/assets/logo.png"
    name = customer_name or "Valued Customer"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Message Received - VAHN</title></head>
    <body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background-color:#f7f7f7; margin:0; padding:40px 20px;">
      <div style="max-width:540px; margin:0 auto; background:#ffffff; padding:40px; border:1px solid #e2e2e2;">
        <div style="text-align:center; margin-bottom:24px;">
          <img src="{logo_url}" alt="VAHN" width="120" style="height:28px; width:auto; border:0;" />
        </div>
        <div style="text-align:center; margin-bottom:20px;">
          <span style="background:#0d0d0d; color:#fff; font-size:11px; font-weight:800; padding:5px 14px; letter-spacing:0.15em; text-transform:uppercase;">MESSAGE RECEIVED</span>
        </div>
        <p style="font-size:15px; color:#111; line-height:1.6;">Dear {name},</p>
        <p style="font-size:14px; color:#555; line-height:1.6;">Thank you for reaching out to VAHN. We have successfully received your inquiry regarding <strong>{subject_topic or 'Customer Support'}</strong>.</p>
        <p style="font-size:14px; color:#555; line-height:1.6;">Our support team reviews every message carefully. We will respond directly to this email address within 24 hours on business days (Monday to Saturday, 10:00 AM &ndash; 6:00 PM IST).</p>
        <div style="background:#fbfbfb; border:1px solid #e9e9e9; padding:16px; margin:24px 0; font-size:12px; color:#666;">
          <strong style="color:#111; display:block; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.04em;">Need Urgent Assistance?</strong>
          You can also reach our studio directly via Phone/WhatsApp at <a href="tel:+918013340567" style="color:#4232d9; font-weight:700; text-decoration:none;">+91 8013340567</a>.
        </div>
        <hr style="border:none; border-top:1px solid #eeeeee; margin:32px 0;">
        <p style="font-size:11px; color:#aaaaaa; text-align:center; text-transform:uppercase; letter-spacing:0.1em;">&copy; 2026 VAHN. All rights reserved.</p>
      </div>
    </body>
    </html>
    """

    return _send_email(
        to_email=to_email,
        subject="We have received your message - VAHN Support",
        html_content=html_content,
        text_content=f"Dear {name}, thank you for contacting VAHN. We have received your inquiry regarding {subject_topic} and will respond within 24 hours."
    )

