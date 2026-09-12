import os
import time
import logging
from typing import Optional, Dict, Any, List
import httpx
from sqlalchemy.orm import Session
import models
import database

logger = logging.getLogger(__name__)

SHIPROCKET_EMAIL = os.getenv("SHIPROCKET_EMAIL", "")
SHIPROCKET_PASSWORD = os.getenv("SHIPROCKET_PASSWORD", "")
SHIPROCKET_PICKUP_LOCATION = os.getenv("SHIPROCKET_PICKUP_LOCATION", "Primary")
SHIPROCKET_PICKUP_PINCODE = os.getenv("SHIPROCKET_PICKUP_PINCODE", "400001")
BASE_URL = "https://apiv2.shiprocket.in/v1/external"

_cached_token: Optional[str] = None
_token_expiry: float = 0.0


def is_configured() -> bool:
    """Returns True if Shiprocket credentials are set."""
    return bool(
        SHIPROCKET_EMAIL
        and "placeholder" not in SHIPROCKET_EMAIL.lower()
        and SHIPROCKET_PASSWORD
        and "placeholder" not in SHIPROCKET_PASSWORD.lower()
    )


def get_auth_token() -> Optional[str]:
    """Authenticates with Shiprocket and caches the JWT token for 24 hours."""
    global _cached_token, _token_expiry
    if not is_configured():
        return None

    now = time.time()
    if _cached_token and now < _token_expiry:
        return _cached_token

    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(
                f"{BASE_URL}/auth/login",
                json={"email": SHIPROCKET_EMAIL, "password": SHIPROCKET_PASSWORD},
                headers={"Content-Type": "application/json"}
            )
            if res.status_code == 200:
                data = res.json()
                _cached_token = data.get("token")
                _token_expiry = now + 86400
                logger.info("Successfully authenticated with Shiprocket live API.")
                return _cached_token
            else:
                logger.warning(f"Shiprocket auth returned HTTP {res.status_code}: {res.text}")
                return None
    except Exception as e:
        logger.error(f"Shiprocket auth exception: {e}")
        return None


def get_primary_warehouse(db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Fetches the configured primary warehouse / pickup location.
    Prioritizes DB warehouse_locations; falls back to Shiprocket API, then environment config.
    """
    close_db = False
    if db is None:
        db = database.SessionLocal()
        close_db = True

    try:
        wh = db.query(models.WarehouseLocation).filter_by(is_primary=True).first()
        if not wh:
            wh = db.query(models.WarehouseLocation).first()

        if wh:
            return {
                "id": wh.id,
                "pickup_location": wh.pickup_location,
                "name": wh.name,
                "email": wh.email,
                "phone": wh.phone,
                "address": wh.address,
                "address_2": wh.address_2,
                "city": wh.city,
                "state": wh.state,
                "country": wh.country or "India",
                "pin_code": str(wh.pin_code),
                "is_primary": wh.is_primary
            }

        # If no warehouse in DB yet, query Shiprocket registered pickup locations
        token = get_auth_token()
        if token:
            try:
                with httpx.Client(timeout=10.0) as client:
                    res = client.get(
                        f"{BASE_URL}/settings/company/pickup",
                        headers={"Authorization": f"Bearer {token}"}
                    )
                    if res.status_code == 200:
                        addresses = res.json().get("data", {}).get("shipping_address", [])
                        if addresses:
                            primary_addr = next((a for a in addresses if a.get("is_primary_location")), addresses[0])
                            loc_name = primary_addr.get("pickup_location", "Primary")
                            pin = str(primary_addr.get("pin_code", SHIPROCKET_PICKUP_PINCODE or "400001"))

                            # Auto-seed into DB so admin can view and manage
                            new_wh = models.WarehouseLocation(
                                pickup_location=loc_name,
                                name=primary_addr.get("name", "VAHN Warehouse Manager"),
                                email=primary_addr.get("email", SHIPROCKET_EMAIL),
                                phone=primary_addr.get("phone", "9876543210"),
                                address=primary_addr.get("address", "VAHN Logistics Hub"),
                                address_2=primary_addr.get("address_2", ""),
                                city=primary_addr.get("city", "Mumbai"),
                                state=primary_addr.get("state", "Maharashtra"),
                                country="India",
                                pin_code=pin,
                                is_primary=True,
                                shiprocket_pickup_id=str(primary_addr.get("id", ""))
                            )
                            db.add(new_wh)
                            db.commit()
                            db.refresh(new_wh)
                            return {
                                "id": new_wh.id,
                                "pickup_location": new_wh.pickup_location,
                                "name": new_wh.name,
                                "email": new_wh.email,
                                "phone": new_wh.phone,
                                "address": new_wh.address,
                                "address_2": new_wh.address_2,
                                "city": new_wh.city,
                                "state": new_wh.state,
                                "country": "India",
                                "pin_code": pin,
                                "is_primary": True
                            }
            except Exception as e:
                logger.warning(f"Could not auto-fetch pickup locations from Shiprocket: {e}")
    finally:
        if close_db:
            db.close()

    return {
        "pickup_location": SHIPROCKET_PICKUP_LOCATION or "Primary",
        "name": "VAHN Warehouse",
        "email": SHIPROCKET_EMAIL or "logistics@vahnsports.com",
        "phone": "9876543210",
        "address": "VAHN Central Fulfillment",
        "address_2": "",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pin_code": str(SHIPROCKET_PICKUP_PINCODE or "400001"),
        "is_primary": True
    }


def get_primary_pickup_location(db: Optional[Session] = None) -> str:
    """Returns the primary pickup location nickname."""
    return get_primary_warehouse(db).get("pickup_location", SHIPROCKET_PICKUP_LOCATION or "Primary")


def check_serviceability(delivery_pincode: str, weight: float = 0.5, db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Checks delivery PIN code serviceability and estimates transit days dynamically from Shiprocket.
    """
    clean_pincode = str(delivery_pincode).strip()
    token = get_auth_token()
    wh = get_primary_warehouse(db)
    pickup_pin = wh.get("pin_code", "400001")

    if token:
        try:
            with httpx.Client(timeout=12.0) as client:
                res = client.get(
                    f"{BASE_URL}/courier/serviceability/",
                    params={
                        "pickup_postcode": pickup_pin,
                        "delivery_postcode": clean_pincode,
                        "weight": str(weight),
                        "cod": "0"
                    },
                    headers={"Authorization": f"Bearer {token}"}
                )
                if res.status_code == 200:
                    data = res.json().get("data", {})
                    companies = data.get("available_courier_companies", [])
                    if companies:
                        # Sort by estimated delivery days (fastest first), then by rate
                        companies_sorted = sorted(
                            companies,
                            key=lambda c: (
                                int(c.get("estimated_delivery_days") or 99) if str(c.get("estimated_delivery_days", "")).isdigit() else 99,
                                float(c.get("rate") or 9999)
                            )
                        )
                        best = companies_sorted[0]
                        est_days = best.get("estimated_delivery_days")
                        formatted_days = f"{est_days} business days" if est_days else "3-5 business days"
                        courier_name = best.get("courier_name", "Express Courier")
                        rate = float(best.get("rate", 0))
                        etd = best.get("etd")

                        return {
                            "serviceable": True,
                            "estimated_days": formatted_days,
                            "courier_name": courier_name,
                            "shipping_rate": rate,
                            "etd": etd,
                            "pincode": clean_pincode,
                            "is_cod": False
                        }
                    else:
                        return {
                            "serviceable": False,
                            "estimated_days": "N/A",
                            "courier_name": None,
                            "message": "Delivery is not serviceable by courier partners to this PIN code.",
                            "pincode": clean_pincode,
                            "is_cod": False
                        }
                else:
                    err_msg = res.json().get("message", "Serviceability check error from courier partner.")
                    return {
                        "serviceable": False,
                        "estimated_days": "N/A",
                        "courier_name": None,
                        "message": err_msg,
                        "pincode": clean_pincode,
                        "is_cod": False
                    }
        except Exception as e:
            logger.warning(f"Shiprocket live serviceability check failed: {e}")
            return {
                "serviceable": False,
                "estimated_days": "N/A",
                "courier_name": None,
                "message": f"Logistics network error: {str(e)}",
                "pincode": clean_pincode,
                "is_cod": False
            }

    # When Shiprocket credentials are not yet authenticated
    return {
        "serviceable": False,
        "estimated_days": "N/A",
        "courier_name": None,
        "message": "Shiprocket account authentication pending. Please verify email and API access in Shiprocket Settings.",
        "pincode": clean_pincode,
        "is_cod": False
    }


def add_warehouse_to_shiprocket(wh_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Registers a new warehouse / pickup location on Shiprocket.
    """
    token = get_auth_token()
    if not token:
        raise ValueError("Shiprocket API is not authenticated. Please check your credentials.")

    payload = {
        "pickup_location": wh_data["pickup_location"],
        "name": wh_data["name"],
        "email": wh_data["email"],
        "phone": str(wh_data["phone"]).replace("+91", "").replace(" ", "")[-10:],
        "address": wh_data["address"],
        "address_2": wh_data.get("address_2", ""),
        "city": wh_data["city"],
        "state": wh_data["state"],
        "country": wh_data.get("country", "India"),
        "pin_code": str(wh_data["pin_code"]),
        "lat": wh_data.get("lat", ""),
        "long": wh_data.get("long", "")
    }

    with httpx.Client(timeout=15.0) as client:
        res = client.post(
            f"{BASE_URL}/settings/company/addpickup",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        )
        if res.status_code in (200, 201):
            return res.json()
        else:
            err_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
            err_text = err_data.get("message") or res.text
            raise ValueError(f"Shiprocket rejected warehouse creation: {err_text}")


def fetch_shiprocket_pickup_locations() -> List[Dict[str, Any]]:
    """Fetches all registered pickup locations from Shiprocket."""
    token = get_auth_token()
    if not token:
        return []

    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.get(
                f"{BASE_URL}/settings/company/pickup",
                headers={"Authorization": f"Bearer {token}"}
            )
            if res.status_code == 200:
                return res.json().get("data", {}).get("shipping_address", [])
    except Exception as e:
        logger.warning(f"Failed to fetch Shiprocket pickup locations: {e}")
    return []


def create_forward_shipment(
    order: Any,
    items: Optional[List[Any]] = None,
    pickup_location: Optional[str] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Creates an ad-hoc order on Shiprocket and assigns an AWB courier code dynamically.
    """
    token = get_auth_token()
    if not token:
        raise ValueError("Cannot dispatch shipment: Shiprocket API authentication is not active.")

    addr = order.shipping_address or {}
    pickup = pickup_location or get_primary_pickup_location(db)

    if items is None:
        items = getattr(order, "items", []) or []

    full_name = addr.get("name", (order.guest_name if order.is_guest else (order.user.full_name if order.user else "Customer")))
    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else "Athlete"
    phone = addr.get("phone", (order.guest_phone if order.is_guest else (order.user.phone if order.user else "9876543210")))
    email = order.guest_email if order.is_guest else (order.user.email if order.user else "order@vahnsports.com")

    payload = {
        "order_id": order.id,
        "order_date": order.created_at.strftime("%Y-%m-%d %H:%M"),
        "pickup_location": pickup,
        "billing_customer_name": first_name,
        "billing_last_name": last_name,
        "billing_address": addr.get("address", "Customer Address"),
        "billing_city": addr.get("city", "Mumbai"),
        "billing_pincode": addr.get("postalCode", addr.get("pincode", "400001")),
        "billing_state": addr.get("state", "Maharashtra"),
        "billing_country": "India",
        "billing_email": email or "support@vahnsports.com",
        "billing_phone": phone.replace("+91", "").replace(" ", "")[-10:] if phone else "9876543210",
        "shipping_is_billing": True,
        "order_items": [
            {
                "name": i.product_title,
                "sku": i.variant_id or f"VAHN-{i.id[:8]}",
                "units": i.quantity,
                "selling_price": i.price_amount
            }
            for i in items
        ],
        "payment_method": "Prepaid",
        "sub_total": order.total_amount,
        "length": 15,
        "breadth": 15,
        "height": 5,
        "weight": 0.5
    }

    with httpx.Client(timeout=20.0) as client:
        res = client.post(f"{BASE_URL}/orders/create/adhoc", json=payload, headers={"Authorization": f"Bearer {token}"})
        if res.status_code not in (200, 201):
            err_msg = res.json().get("message", res.text) if res.text else f"HTTP {res.status_code}"
            raise ValueError(f"Shiprocket order creation failed: {err_msg}")

        order_data = res.json()
        sr_order_id = str(order_data.get("order_id", ""))
        sr_shipment_id = str(order_data.get("shipment_id", ""))

        # Assign live courier AWB
        awb_res = client.post(
            f"{BASE_URL}/courier/assign/awb",
            json={"shipment_id": sr_shipment_id},
            headers={"Authorization": f"Bearer {token}"}
        )
        awb_code = ""
        courier_name = "Assigned Courier"
        if awb_res.status_code == 200:
            awb_data = awb_res.json().get("response", {}).get("data", {})
            awb_code = str(awb_data.get("awb_code", ""))
            courier_name = awb_data.get("courier_name", "Express Courier")
        else:
            logger.warning(f"Shiprocket AWB assignment returned {awb_res.status_code}: {awb_res.text}")

        logger.info(f"Created live Shiprocket forward shipment: AWB {awb_code} for order {order.id}")
        return {
            "order_id": sr_order_id,
            "shipment_id": sr_shipment_id,
            "awb_code": awb_code,
            "courier_name": courier_name,
            "shiprocket_order_id": sr_order_id,
            "shiprocket_shipment_id": sr_shipment_id,
            "shiprocket_awb": awb_code,
            "shiprocket_courier_name": courier_name,
            "shipping_status": "MANIFEST_GENERATED"
        }


def track_awb(awb_code: str) -> Dict[str, Any]:
    """
    Retrieves live milestone scan history for an AWB from Shiprocket.
    """
    token = get_auth_token()
    clean_awb = str(awb_code).strip()

    if token and clean_awb:
        try:
            with httpx.Client(timeout=12.0) as client:
                res = client.get(
                    f"{BASE_URL}/courier/track/awb/{clean_awb}",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if res.status_code == 200:
                    data = res.json()
                    track_data = data.get("tracking_data", {})
                    scans = track_data.get("shipment_track_activities", []) or []
                    current_status = str(track_data.get("current_status", "IN_TRANSIT")).upper()
                    courier_name = track_data.get("courier_name") or "Express Courier"

                    scans_list = [
                        {
                            "date": s.get("date"),
                            "activity": s.get("activity"),
                            "location": s.get("location")
                        }
                        for s in scans
                    ]
                    latest_loc = scans_list[-1].get("location") if scans_list else "In Transit"
                    is_picked_up = (
                        any("pick" in str(s.get("activity", "")).lower() for s in scans_list)
                        or current_status in ("PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED")
                    )

                    return {
                        "awb": clean_awb,
                        "current_status": current_status,
                        "courier_name": courier_name,
                        "current_location": latest_loc,
                        "is_picked_up": is_picked_up,
                        "scans": scans_list
                    }
        except Exception as e:
            logger.warning(f"Failed to fetch live tracking for AWB {clean_awb}: {e}")

    return {
        "awb": clean_awb,
        "current_status": "MANIFEST_GENERATED",
        "courier_name": "Assigned Courier",
        "current_location": "Origin Facility",
        "is_picked_up": False,
        "scans": []
    }


def create_reverse_pickup(
    order: Any,
    return_reason: str,
    pickup_location: Optional[str] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Creates an automated return/reverse pickup order on Shiprocket to the primary warehouse.
    """
    token = get_auth_token()
    if not token:
        raise ValueError("Shiprocket API authentication is not active for reverse logistics.")

    wh = get_primary_warehouse(db)

    with httpx.Client(timeout=15.0) as client:
        res = client.post(
            f"{BASE_URL}/orders/create/return",
            json={
                "order_id": order.id,
                "order_date": order.created_at.strftime("%Y-%m-%d %H:%M"),
                "channel_id": "",
                "pickup_customer_name": (order.guest_name if order.is_guest else (order.user.full_name if order.user else "Customer")),
                "pickup_address": (order.shipping_address or {}).get("address", ""),
                "pickup_city": (order.shipping_address or {}).get("city", "Mumbai"),
                "pickup_state": (order.shipping_address or {}).get("state", "Maharashtra"),
                "pickup_pincode": (order.shipping_address or {}).get("postalCode", "400001"),
                "pickup_phone": (order.guest_phone if order.is_guest else (order.user.phone if order.user else "9876543210")),
                "return_reason": return_reason,
                "warehouse_id": wh.get("id"),
                "delivery_address": wh.get("address", ""),
                "delivery_city": wh.get("city", "Mumbai"),
                "delivery_state": wh.get("state", "Maharashtra"),
                "delivery_pincode": wh.get("pin_code", "400001"),
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        if res.status_code in (200, 201):
            data = res.json()
            return {
                "reverse_shipment_id": str(data.get("shipment_id", "")),
                "reverse_awb": str(data.get("awb_code", "")),
                "reverse_courier_name": data.get("courier_name", "Shiprocket Reverse"),
                "reverse_status": "PICKUP_SCHEDULED"
            }
        else:
            raise ValueError(f"Shiprocket reverse pickup failed: {res.text}")


def generate_shipping_label(shipment_id: str) -> str:
    """Retrieves a downloadable shipping label URL."""
    token = get_auth_token()
    if token:
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(
                    f"{BASE_URL}/courier/generate/label",
                    json={"shipment_id": [shipment_id]},
                    headers={"Authorization": f"Bearer {token}"}
                )
                if res.status_code == 200:
                    return res.json().get("label_url", "")
        except Exception as e:
            logger.warning(f"Failed to fetch live label: {e}")
    return ""


def cancel_shipment(awb_code: Optional[str] = None, order_id: Optional[str] = None) -> bool:
    """Cancels courier pickup for an order in Shiprocket."""
    token = get_auth_token()
    if token and (awb_code or order_id):
        try:
            with httpx.Client(timeout=10.0) as client:
                client.post(
                    f"{BASE_URL}/orders/cancel",
                    json={"ids": [order_id] if order_id else [], "awbs": [awb_code] if awb_code else []},
                    headers={"Authorization": f"Bearer {token}"}
                )
                return True
        except Exception as e:
            logger.warning(f"Error cancelling shipment in Shiprocket: {e}")
    return False
