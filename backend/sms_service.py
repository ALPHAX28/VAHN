"""
Amazon SNS SMS Service for VAHN OTP delivery.

Set these env vars to activate real SMS sending:
  AWS_ACCESS_KEY_ID=...
  AWS_SECRET_ACCESS_KEY=...
  AWS_SNS_REGION=ap-south-1   (or your preferred region)

Without those keys, OTPs are printed to console (dev mode).
"""
import os
import logging

logger = logging.getLogger(__name__)

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_SNS_REGION = os.getenv("AWS_SNS_REGION", "ap-south-1")


def send_otp_sms(phone: str, otp: str) -> None:
    """
    Send OTP to a phone number via Amazon SNS.

    Falls back to console logging if AWS credentials are not configured
    (useful during local development).

    Args:
        phone: E.164 format phone number e.g. +919876543210
        otp: 6-digit OTP string
    """
    message = f"Your VAHN verification code is: {otp}. Valid for 5 minutes. Do not share this code."

    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
        # Dev fallback — log OTP to console so development works without SNS keys
        logger.warning(
            f"[DEV MODE] AWS SNS not configured. OTP for {phone}: {otp}"
        )
        print(f"\n{'='*50}")
        print(f"[VAHN DEV] OTP for {phone}: {otp}")
        print(f"{'='*50}\n")
        return

    try:
        import boto3
        from botocore.exceptions import ClientError

        client = boto3.client(
            "sns",
            region_name=AWS_SNS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )

        client.publish(
            PhoneNumber=phone,
            Message=message,
            MessageAttributes={
                "AWS.SNS.SMS.SMSType": {
                    "DataType": "String",
                    "StringValue": "Transactional",  # Highest delivery priority
                },
                "AWS.SNS.SMS.SenderID": {
                    "DataType": "String",
                    "StringValue": "VAHN",  # Sender ID (supported in most regions)
                },
            },
        )
        logger.info(f"SNS OTP SMS sent to {phone}")

    except ImportError:
        logger.error("boto3 not installed. Run: pip install boto3")
        raise RuntimeError(
            "boto3 is required for SMS OTP. Install it with: pip install boto3"
        )
    except Exception as e:
        logger.error(f"Failed to send SNS SMS to {phone}: {e}")
        raise RuntimeError(f"Failed to send OTP SMS: {str(e)}")
