import logging
import os
import re
import time
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

import database
import models

logger = logging.getLogger(__name__)

SHIPROCKET_EMAIL = os.getenv("SHIPROCKET_EMAIL") or "api@vahnsports.com"
SHIPROCKET_PASSWORD = os.getenv("SHIPROCKET_PASSWORD") or "r2IuvPC2KkDnzl@&6Xx!uK3DOpL6rUbZ"
SHIPROCKET_PICKUP_LOCATION = os.getenv("SHIPROCKET_PICKUP_LOCATION") or "Home"
SHIPROCKET_PICKUP_PINCODE = os.getenv("SHIPROCKET_PICKUP_PINCODE") or "110019"
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
        # Prioritize active, phone-verified warehouse (Home), never unverified location without phone
        wh = db.query(models.WarehouseLocation).filter(
            models.WarehouseLocation.is_primary == True,
            models.WarehouseLocation.pickup_location != "Primary",
            models.WarehouseLocation.phone != ""
        ).first()
        if not wh:
            wh = db.query(models.WarehouseLocation).filter(
                models.WarehouseLocation.pickup_location != "Primary",
                models.WarehouseLocation.phone != ""
            ).first()
        if not wh:
            wh = db.query(models.WarehouseLocation).filter_by(is_primary=True).first()
        if not wh:
            wh = db.query(models.WarehouseLocation).first()

        if wh and wh.pickup_location != "Primary" and str(wh.phone).strip():
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
                            valid_addrs = [
                                a for a in addresses
                                if str(a.get("phone", "")).strip()
                                and a.get("status") == 1
                                and a.get("pickup_location") != "Primary"
                            ]
                            if valid_addrs:
                                primary_addr = next((a for a in valid_addrs if a.get("pickup_location") == "Home"), valid_addrs[0])
                            else:
                                primary_addr = None

                            if primary_addr:
                                loc_name = primary_addr.get("pickup_location", "Home")
                                pin = str(primary_addr.get("pin_code", SHIPROCKET_PICKUP_PINCODE or "110019"))

                                # Auto-seed into DB so admin can view and manage
                                new_wh = models.WarehouseLocation(
                                    pickup_location=loc_name,
                                    name=primary_addr.get("name") or "Abhinandan Mitra",
                                    email=primary_addr.get("email") or SHIPROCKET_EMAIL or "abhinandan.mitra@vahnsports.com",
                                    phone=primary_addr.get("phone") or "9310502059",
                                    address=primary_addr.get("address") or "1931/19a, Vishwakarma Mandir Marg, Govindpuri Extension, Kalkaji",
                                    address_2=primary_addr.get("address_2") or "Near Vishwakarma mandir",
                                    city=primary_addr.get("city") or "Delhi",
                                    state=primary_addr.get("state") or "Delhi",
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
                db.rollback()
                logger.warning(f"Could not auto-fetch pickup locations from Shiprocket: {e}")
    finally:
        if close_db:
            db.close()

    return {
        "pickup_location": SHIPROCKET_PICKUP_LOCATION or "Home",
        "name": "VAHN Warehouse",
        "email": SHIPROCKET_EMAIL or "logistics@vahnsports.com",
        "phone": "9310502059",
        "address": "1931/19a, Vishwakarma Mandir Marg, Govindpuri Extension, Kalkaji",
        "address_2": "Near Vishwakarma mandir",
        "city": "Delhi",
        "state": "Delhi",
        "country": "India",
        "pin_code": str(SHIPROCKET_PICKUP_PINCODE or "110019"),
        "is_primary": True
    }


def get_primary_pickup_location(db: Optional[Session] = None) -> str:
    """Returns the primary pickup location nickname."""
    return get_primary_warehouse(db).get("pickup_location", SHIPROCKET_PICKUP_LOCATION or "Home")


def check_serviceability(delivery_pincode: str, weight: float = 0.5, db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Checks delivery PIN code serviceability and estimates transit days dynamically from Shiprocket.
    """
    clean_pincode = str(delivery_pincode).strip()
    if not clean_pincode or len(clean_pincode) != 6 or not clean_pincode.isdigit() or clean_pincode.startswith("0"):
        return {
            "serviceable": False,
            "estimated_days": "N/A",
            "courier_name": None,
            "message": "Invalid PIN code. Indian postal codes must be 6 digits and cannot start with 0.",
            "pincode": clean_pincode,
            "is_cod": False
        }

    token = get_auth_token()
    wh = get_primary_warehouse(db)
    pickup_pin = wh.get("pin_code", SHIPROCKET_PICKUP_PINCODE or "110019")

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
                    res_data = res.json()
                    data = res_data.get("data", {})
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
                        city = best.get("city")
                        state = best.get("state")

                        return {
                            "serviceable": True,
                            "estimated_days": formatted_days,
                            "courier_name": courier_name,
                            "shipping_rate": rate,
                            "etd": etd,
                            "city": city,
                            "state": state,
                            "pincode": clean_pincode,
                            "is_cod": False
                        }
                    else:
                        api_msg = res_data.get("message")
                        return {
                            "serviceable": False,
                            "estimated_days": "N/A",
                            "courier_name": None,
                            "message": api_msg or "Delivery is not serviceable by courier partners to this PIN code.",
                            "pincode": clean_pincode,
                            "is_cod": False
                        }
                else:
                    err_msg = res.json().get("message", "Delivery is not available for this PIN code.")
                    logger.warning(f"Shiprocket serviceability warning ({res.status_code}): {err_msg}")
                    return {
                        "serviceable": False,
                        "estimated_days": "N/A",
                        "courier_name": None,
                        "message": err_msg or "Delivery is not available for this PIN code.",
                        "pincode": clean_pincode,
                        "is_cod": False
                    }
        except Exception as e:
            logger.warning(f"Shiprocket live serviceability check failed: {e}")
            return {
                "serviceable": False,
                "estimated_days": "N/A",
                "courier_name": None,
                "shipping_rate": 0,
                "message": f"Logistics network error: {str(e)}",
                "pincode": clean_pincode,
                "is_cod": False
            }

    # When Shiprocket credentials are not authenticated
    return {
        "serviceable": False,
        "estimated_days": "N/A",
        "courier_name": None,
        "shipping_rate": 0,
        "message": "Logistics verification service is currently offline.",
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


def get_available_couriers_for_order(
    delivery_pincode: str,
    weight: float = 0.5,
    order_id: Optional[str] = None,
    db: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Fetches available courier partners from Shiprocket's serviceability API
    for a given delivery pincode and weight. Returns structured courier list with
    IDs, names, rates, ETD, and pickup date constraints ('within_2_days' vs 'anytime')
    so the admin wizard can display live Shiprocket-sourced options and automatically
    update the pickup calendar.
    """
    token = get_auth_token()
    wh = get_primary_warehouse(db)
    pickup_pin = wh.get("pin_code", SHIPROCKET_PICKUP_PINCODE or "110019")
    clean_pincode = str(delivery_pincode).strip()

    if token:
        params: Dict[str, Any] = {
            "pickup_postcode": pickup_pin,
            "delivery_postcode": clean_pincode,
            "weight": str(round(float(weight), 3)),
            "cod": "0"
        }
        if order_id:
            params["order_id"] = str(order_id).strip()

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(
                    f"{BASE_URL}/courier/serviceability/",
                    params=params,
                    headers={"Authorization": f"Bearer {token}"}
                )
                if res.status_code == 200:
                    companies = res.json().get("data", {}).get("available_courier_companies", [])
                    if companies:
                        result = []
                        for c in companies:
                            est_days_raw = c.get("estimated_delivery_days")
                            est_days = int(est_days_raw) if str(est_days_raw or "").isdigit() else None
                            c_name = str(c.get("courier_name") or "Express Courier")
                            c_name_lower = c_name.lower()

                            # Determine pickup constraint:
                            # Standard Indian road/surface courier SLA requires pickup within 2 days (Today or Tomorrow)
                            # e.g., Shadowfax, Delhivery Surface, Xpressbees, Ekart
                            # Flexible/anytime couriers allow scheduling up to 7 days ahead (e.g. DTDC, Smartr)
                            if any(k in c_name_lower for k in ["dtdc", "smartr", "priority"]):
                                pickup_constraint = "anytime"
                                pickup_days_window = 7
                                pickup_rule_desc = "Flexible: Ship anytime within 7 days"
                            else:
                                pickup_constraint = "within_2_days"
                                pickup_days_window = 2
                                pickup_rule_desc = "Must ship within 2 days (Today or Tomorrow)"

                            raw_rating = c.get("rating")
                            try:
                                rating_val = round(float(raw_rating), 1) if raw_rating is not None else 4.5
                            except Exception:
                                rating_val = 4.5

                            raw_rto = c.get("rto_charges")
                            try:
                                rto_val = round(float(raw_rto), 1) if raw_rto is not None else 70.0
                            except Exception:
                                rto_val = 70.0

                            is_recommended = bool(
                                c.get("recommended_lt") == 1
                                or c.get("recommended") == 1
                                or "recommended" in str(c.get("reason", "")).lower()
                            )

                            result.append({
                                "courier_company_id": c.get("courier_company_id"),
                                "courier_name": c_name,
                                "rate": float(c.get("rate") or 0),
                                "estimated_delivery_days": est_days,
                                "etd": c.get("etd"),
                                "city": c.get("city"),
                                "state": c.get("state"),
                                "rating": rating_val,
                                "rto_charges": rto_val,
                                "cutoff_time": str(c.get("cutoff_time") or "11:00"),
                                "is_recommended": is_recommended,
                                "pickup_constraint": pickup_constraint,
                                "pickup_days_window": pickup_days_window,
                                "pickup_rule_description": pickup_rule_desc,
                                "is_surface": bool(c.get("is_surface")),
                                "min_weight": float(c.get("min_weight") or 0.5),
                                "charge_weight": float(c.get("charge_weight") or weight),
                            })
                        result.sort(key=lambda x: (x["rate"], x["estimated_delivery_days"] or 99))
                        return result
        except Exception as e:
            logger.warning(f"Failed to fetch Shiprocket courier serviceability: {e}")

    # Standard fallback courier options when API is unreachable or returns 0 results
    fallback_couriers = [
        {
            "courier_company_id": 58,
            "courier_name": "Shadowfax Surface",
            "rate": 98.72,
            "estimated_delivery_days": 5,
            "etd": "In 5 Days",
            "city": None,
            "state": None,
            "rating": 4.8,
            "rto_charges": 70.0,
            "cutoff_time": "11:00",
            "is_recommended": True,
            "pickup_constraint": "within_2_days",
            "pickup_days_window": 2,
            "pickup_rule_description": "Must ship within 2 days (Today or Tomorrow)",
            "is_surface": True,
            "min_weight": 0.5,
            "charge_weight": weight,
        },
        {
            "courier_company_id": 51,
            "courier_name": "Xpressbees Surface",
            "rate": 93.72,
            "estimated_delivery_days": 5,
            "etd": "In 5 Days",
            "city": None,
            "state": None,
            "rating": 4.6,
            "rto_charges": 65.0,
            "cutoff_time": "11:00",
            "is_recommended": False,
            "pickup_constraint": "within_2_days",
            "pickup_days_window": 2,
            "pickup_rule_description": "Must ship within 2 days (Today or Tomorrow)",
            "is_surface": True,
            "min_weight": 0.5,
            "charge_weight": weight,
        },
        {
            "courier_company_id": 1,
            "courier_name": "Delhivery Surface",
            "rate": 99.72,
            "estimated_delivery_days": 6,
            "etd": "In 6 Days",
            "city": None,
            "state": None,
            "rating": 4.7,
            "rto_charges": 75.0,
            "cutoff_time": "11:00",
            "is_recommended": False,
            "pickup_constraint": "within_2_days",
            "pickup_days_window": 2,
            "pickup_rule_description": "Must ship within 2 days (Today or Tomorrow)",
            "is_surface": True,
            "min_weight": 0.5,
            "charge_weight": weight,
        },
        {
            "courier_company_id": 4,
            "courier_name": "DTDC Surface",
            "rate": 166.22,
            "estimated_delivery_days": 6,
            "etd": "In 6 Days",
            "city": None,
            "state": None,
            "rating": 4.7,
            "rto_charges": 83.5,
            "cutoff_time": "12:00",
            "is_recommended": False,
            "pickup_constraint": "anytime",
            "pickup_days_window": 7,
            "pickup_rule_description": "Flexible: Ship anytime within 7 days",
            "is_surface": True,
            "min_weight": 0.5,
            "charge_weight": weight,
        },
        {
            "courier_company_id": 2,
            "courier_name": "DTDC Air 500gm",
            "rate": 195.32,
            "estimated_delivery_days": 4,
            "etd": "In 4 Days",
            "city": None,
            "state": None,
            "rating": 4.9,
            "rto_charges": 112.6,
            "cutoff_time": "14:00",
            "is_recommended": False,
            "pickup_constraint": "anytime",
            "pickup_days_window": 7,
            "pickup_rule_description": "Flexible: Ship anytime within 7 days",
            "is_surface": False,
            "min_weight": 0.5,
            "charge_weight": weight,
        }
    ]
    return fallback_couriers



def reassign_courier_awb(
    shipment_id: Any,
    courier_id: Any
) -> Dict[str, Any]:
    """
    Reassigns the AWB to a specific courier company by ID.
    Called when the admin selects a different courier in the pickup wizard.
    """
    token = get_auth_token()
    if not token:
        raise ValueError("Shiprocket authentication failed.")

    clean_shipment_id = str(shipment_id).strip()
    clean_courier_id = int(str(courier_id).strip()) if str(courier_id).isdigit() else courier_id

    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(
                f"{BASE_URL}/courier/assign/awb",
                json={"shipment_id": clean_shipment_id, "courier_id": clean_courier_id},
                headers={"Authorization": f"Bearer {token}"}
            )
            if res.status_code == 200:
                data = res.json().get("response", {}).get("data", {})
                return {
                    "success": True,
                    "awb_code": str(data.get("awb_code", "")),
                    "courier_name": data.get("courier_name", ""),
                    "courier_company_id": data.get("courier_company_id"),
                    "message": "AWB reassigned successfully"
                }
            else:
                try:
                    err = res.json()
                    msg = err.get("message") or str(err)
                except Exception:
                    msg = res.text
                logger.warning(f"Shiprocket AWB reassignment failed ({res.status_code}): {msg}")
                return {"success": False, "awb_code": "", "courier_name": "", "message": msg}
    except Exception as e:
        logger.warning(f"Shiprocket AWB reassignment exception: {e}")
        return {"success": False, "awb_code": "", "courier_name": "", "message": str(e)}


def update_order_package_dims(
    order_id: Any,
    weight: float,
    length: float,
    breadth: float,
    height: float
) -> Dict[str, Any]:
    """
    Updates package weight and dimensions on an existing Shiprocket order.
    This is called before scheduling pickup so the manifest reflects the correct
    package specifications. Uses the PATCH /orders/update endpoint.
    """
    token = get_auth_token()
    if not token:
        return {"success": False, "message": "Shiprocket authentication failed."}

    clean_order_id = str(order_id).strip()
    try:
        with httpx.Client(timeout=12.0) as client:
            res = client.patch(
                f"{BASE_URL}/orders/update/{clean_order_id}",
                json={
                    "weight": round(float(weight), 3),
                    "length": round(float(length), 1),
                    "breadth": round(float(breadth), 1),
                    "height": round(float(height), 1),
                },
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            )
            if res.status_code in (200, 201):
                return {"success": True, "message": "Package dimensions updated in Shiprocket"}
            else:
                try:
                    err = res.json()
                    msg = err.get("message") or str(err)
                except Exception:
                    msg = res.text
                # Non-critical: log and continue — pickup can still be scheduled
                logger.warning(f"Could not update package dims on Shiprocket order {order_id} ({res.status_code}): {msg}")
                return {"success": False, "message": msg}
    except Exception as e:
        logger.warning(f"Shiprocket package dims update failed: {e}")
        return {"success": False, "message": str(e)}



def create_forward_shipment(
    order: Any,
    items: Optional[List[Any]] = None,
    pickup_location: Optional[str] = None,
    db: Optional[Session] = None,
    weight: float = 0.5,
    length: float = 15.0,
    breadth: float = 15.0,
    height: float = 5.0,
    courier_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Creates an ad-hoc order on Shiprocket and assigns an AWB courier code dynamically.
    """
    token = get_auth_token()
    if not token:
        raise ValueError("Cannot dispatch shipment: Shiprocket API authentication is not active.")

    raw_pickup = pickup_location or get_primary_pickup_location(db)
    if not raw_pickup or str(raw_pickup).strip().lower() == "primary":
        pickup = "Home"
    else:
        pickup = str(raw_pickup).strip()

    if items is None:
        items = getattr(order, "items", []) or []

    addr = getattr(order, "shipping_address", None) or {}
    full_name = addr.get("name", (order.guest_name if order.is_guest else (order.user.full_name if order.user else "Customer")))
    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else "Athlete"
    phone = addr.get("phone", (order.guest_phone if order.is_guest else (order.user.phone if order.user else "9876543210")))
    email = order.guest_email if order.is_guest else (order.user.email if order.user else "order@vahnsports.com")

    order_items_payload = []
    for i in items:
        # Include product title and variant details (size / colour)
        item_name = f"{i.product_title} - {i.variant_title}" if getattr(i, "variant_title", None) else i.product_title

        # Clean SKU representation
        raw_sku = getattr(i, "sku", None) or getattr(i, "variant_id", None) or f"VAHN-{i.id[:8]}"
        clean_sku = str(raw_sku).upper().replace(" ", "-")

        # Standard Indian GST HSN Code for activewear / jerseys / apparel (Chapter 61: 610910)
        item_hsn = getattr(i, "hsn", None) or "610910"

        # Standard 12% GST on apparel so Taxable Value and CGST/SGST/IGST compute accurately
        item_tax = 12.0
        if getattr(order, "tax_amount", 0) and getattr(order, "subtotal_amount", 0):
            base_taxable = order.subtotal_amount - order.tax_amount
            if base_taxable > 0:
                item_tax = round((order.tax_amount / base_taxable) * 100, 1)

        order_items_payload.append({
            "name": item_name,
            "sku": clean_sku,
            "units": i.quantity,
            "selling_price": float(i.price_amount),
            "discount": 0.0,
            "tax": item_tax,
            "hsn": item_hsn,
        })

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
        "order_items": order_items_payload,
        "payment_method": "Prepaid",
        "shipping_charges": float(getattr(order, "shipping_amount", 0.0) or 0.0),
        "total_discount": float(getattr(order, "discount_amount", 0.0) or 0.0),
        "sub_total": float(getattr(order, "subtotal_amount", 0.0) or (order.total_amount - (getattr(order, "shipping_amount", 0.0) or 0.0))),
        "length": round(float(length), 1),
        "breadth": round(float(breadth), 1),
        "height": round(float(height), 1),
        "weight": round(float(weight), 3)
    }

    with httpx.Client(timeout=45.0) as client:
        sr_order_id = ""
        sr_shipment_id = ""
        awb_code = ""
        courier_name = "Assigned Courier"

        res = client.post(f"{BASE_URL}/orders/create/adhoc", json=payload, headers={"Authorization": f"Bearer {token}"})
        if res.status_code in (200, 201):
            order_data = res.json()
            sr_order_id = str(order_data.get("order_id", ""))
            sr_shipment_id = str(order_data.get("shipment_id", ""))
        else:
            # If order creation failed (e.g. order already exists in Shiprocket), re-link existing order
            try:
                search_res = client.get(
                    f"{BASE_URL}/orders",
                    params={"search": str(order.id)},
                    headers={"Authorization": f"Bearer {token}"}
                )
                if search_res.status_code == 200:
                    found_orders = search_res.json().get("data", [])
                    matched = next((o for o in found_orders if str(o.get("channel_order_id")) == str(order.id)), None)
                    if matched:
                        sr_order_id = str(matched.get("id", ""))
                        shipments = matched.get("shipments") or []
                        if isinstance(shipments, list) and shipments:
                            sr_shipment_id = str(shipments[0].get("id", ""))
                        elif isinstance(shipments, dict):
                            sr_shipment_id = str(shipments.get("id", ""))
                        awb_code = str(matched.get("awb_code") or "")
                        courier_name = str(matched.get("courier_name") or "Express Courier")
                        logger.info(f"Re-linked existing Shiprocket order {sr_order_id}, shipment {sr_shipment_id} for order {order.id}")
            except Exception as search_err:
                logger.warning(f"Error searching existing Shiprocket order: {search_err}")

            if not sr_order_id or not sr_shipment_id:
                err_msg = res.json().get("message", res.text) if res.text else f"HTTP {res.status_code}"
                raise ValueError(f"Shiprocket order creation failed: {err_msg}")

        # Step 2: If AWB code is not yet assigned, try to assign or fetch from show endpoint
        if sr_shipment_id and not awb_code:
            try:
                awb_payload: Dict[str, Any] = {"shipment_id": sr_shipment_id}
                if courier_id:
                    awb_payload["courier_id"] = int(str(courier_id).strip()) if str(courier_id).isdigit() else courier_id
                awb_res = client.post(
                    f"{BASE_URL}/courier/assign/awb",
                    json=awb_payload,
                    headers={"Authorization": f"Bearer {token}"}
                )
                if awb_res.status_code == 200:
                    awb_data = awb_res.json().get("response", {}).get("data", {})
                    awb_code = str(awb_data.get("awb_code", ""))
                    courier_name = str(awb_data.get("courier_name") or "Express Courier")
                else:
                    logger.warning(f"Shiprocket AWB assignment returned {awb_res.status_code}: {awb_res.text}")
            except (httpx.TimeoutException, httpx.RequestError) as awb_err:
                logger.warning(f"Shiprocket AWB assign timed out or failed on the wire: {awb_err}. Checking order status...")

        # If awb_code is still empty, double check orders/show to see if it was assigned in background
        if sr_order_id and not awb_code:
            try:
                show_res = client.get(
                    f"{BASE_URL}/orders/show/{sr_order_id}",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if show_res.status_code == 200:
                    show_data = show_res.json().get("data", {})
                    s_info = show_data.get("shipments")
                    if isinstance(s_info, dict):
                        awb_code = str(s_info.get("awb") or "")
                        courier_name = str(s_info.get("courier") or courier_name)
                    elif isinstance(s_info, list) and s_info:
                        awb_code = str(s_info[0].get("awb") or "")
                        courier_name = str(s_info[0].get("courier") or courier_name)
            except Exception as show_err:
                logger.warning(f"Error checking Shiprocket order show: {show_err}")

        logger.info(f"Created/linked live Shiprocket forward shipment: Order {sr_order_id}, Shipment {sr_shipment_id}, AWB {awb_code} for order {order.id}")
        return {
            "order_id": sr_order_id,
            "shipment_id": sr_shipment_id,
            "awb_code": awb_code,
            "courier_name": courier_name if awb_code else (order.shiprocket_courier_name or "Select via Pickup Wizard"),
            "shiprocket_order_id": sr_order_id,
            "shiprocket_shipment_id": sr_shipment_id,
            "shiprocket_awb": awb_code,
            "shiprocket_courier_name": courier_name if awb_code else (order.shiprocket_courier_name or "Select via Pickup Wizard"),
            "shipping_status": "MANIFEST_GENERATED" if awb_code else "READY_FOR_PICKUP"
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
                    latest_loc = None
                    if scans_list:
                        raw_loc = (scans_list[-1].get("location") or "").strip()
                        if raw_loc and raw_loc.lower() not in (
                            "in transit", "transit", "unfulfilled", "processing",
                            "manifest generated", "origin facility", "pending", "unknown", "n/a"
                        ):
                            latest_loc = raw_loc

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
        "current_location": None,
        "is_picked_up": False,
        "scans": []
    }


def get_order_status(
    shiprocket_order_id: Optional[Any] = None,
    awb_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Checks the latest status of an order or shipment directly in Shiprocket.
    Detects if the order has been cancelled in Shiprocket via AWB tracking or /orders/show API.
    """
    token = get_auth_token()
    if not token:
        return {"is_cancelled": False, "status": "UNKNOWN", "current_status": "UNKNOWN"}

    # 1. If AWB exists, check live tracking first
    clean_awb = str(awb_code or "").strip()
    if clean_awb:
        try:
            live = track_awb(clean_awb)
            curr = str(live.get("current_status") or "").upper()
            if any(ind in curr for ind in ("CANCEL", "CANCELED", "CANCELLED")):
                return {
                    "is_cancelled": True,
                    "status": "CANCELED",
                    "current_status": curr,
                    "cancellation_reason": f"Cancelled in Shiprocket ({curr})",
                    "raw": live
                }
        except Exception as e:
            logger.warning(f"Failed to check AWB status for {clean_awb}: {e}")

    # 2. Check Shiprocket order details via /orders/show/{id}
    clean_order_id = str(shiprocket_order_id or "").strip()
    if clean_order_id and clean_order_id.isdigit():
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(
                    f"{BASE_URL}/orders/show/{clean_order_id}",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if res.status_code == 200:
                    data = res.json().get("data", {})
                    st = str(data.get("status") or "").upper()
                    st_code = data.get("status_code")
                    is_canc = (
                        st_code in (5, "5")
                        or any(ind in st for ind in ("CANCEL", "CANCELED", "CANCELLED"))
                    )

                    # Also inspect any shipment-level statuses
                    shipments = data.get("shipments") or []
                    if isinstance(shipments, list):
                        for sh in shipments:
                            sh_st = str(sh.get("status") or "").upper()
                            if any(ind in sh_st for ind in ("CANCEL", "CANCELED", "CANCELLED")):
                                is_canc = True
                    elif isinstance(shipments, dict):
                        sh_st = str(shipments.get("status") or "").upper()
                        if any(ind in sh_st for ind in ("CANCEL", "CANCELED", "CANCELLED")):
                            is_canc = True

                    return {
                        "is_cancelled": is_canc,
                        "status": st,
                        "current_status": st,
                        "cancellation_reason": "Cancelled in Shiprocket",
                        "raw": data
                    }
        except Exception as e:
            logger.warning(f"Failed to check Shiprocket order {clean_order_id}: {e}")

    return {"is_cancelled": False, "status": "UNKNOWN", "current_status": "UNKNOWN"}


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


def sanitize_shiprocket_url(url: Optional[str]) -> str:
    """
    Converts raw/internal AWS S3 bucket URLs from Shiprocket to public CDN URLs.
    Shiprocket's direct S3 bucket (shiprocket-db-mum.s3.ap-south-1.amazonaws.com) blocks direct HTTP access
    with AccessDenied (XML error). Public downloads are routed via Shiprocket's CDN (sr-core-cdn.shiprocket.in).
    """
    if not url:
        return ""
    clean = str(url).strip()

    # 1. Invoice S3 URL -> Public CDN
    # E.g.: https://shiprocket-db-mum.s3.ap-south-1.amazonaws.com/9748130/invoices/Retail00004b3753e9e-3e58-4d65-8df0-3ce2b67762e8.pdf
    # -> https://sr-core-cdn.shiprocket.in/multichannel-api-invoice/invoices/9748130/Retail00004b3753e9e-3e58-4d65-8df0-3ce2b67762e8.pdf
    if ("s3" in clean or "shiprocket-db-mum" in clean) and "/invoices/" in clean:
        match = re.search(r"/(\d+)/invoices/([^?#]+)", clean)
        if match:
            return f"https://sr-core-cdn.shiprocket.in/multichannel-api-invoice/invoices/{match.group(1)}/{match.group(2)}"

    # 2. Shipping Label S3 URL -> Public CDN
    # E.g.: https://.../label/s/9748130/01a099ab-0c8f-74c8-aff0-31a235442011.pdf
    if ("s3" in clean or "shiprocket-db-mum" in clean) and ("/label/" in clean or "/labels/" in clean):
        match = re.search(r"/(?:label/s|labels)/(\d+)/([^?#]+)", clean)
        if match:
            return f"https://sr-core-cdn.shiprocket.in/label/s/{match.group(1)}/{match.group(2)}"

    return clean


def generate_shipping_label(shipment_id: Any) -> Dict[str, Any]:
    """Retrieves a downloadable shipping label URL from Shiprocket."""
    token = get_auth_token()
    if not token:
        raise ValueError("Shiprocket authentication failed.")

    clean_id = int(str(shipment_id).strip()) if str(shipment_id).isdigit() else shipment_id
    try:
        with httpx.Client(timeout=12.0) as client:
            res = client.post(
                f"{BASE_URL}/courier/generate/label",
                json={"shipment_id": [clean_id]},
                headers={"Authorization": f"Bearer {token}"}
            )
            if res.status_code == 200:
                data = res.json()
                label_url = sanitize_shiprocket_url(data.get("label_url", ""))
                return {
                    "success": True,
                    "label_url": label_url,
                    "label_created": data.get("label_created", 1),
                    "message": data.get("message") or "Label generated successfully"
                }
            else:
                return {
                    "success": False,
                    "label_url": "",
                    "message": f"Failed to generate label ({res.status_code}): {res.text}"
                }
    except Exception as e:
        logger.warning(f"Failed to fetch live label for shipment {shipment_id}: {e}")
        return {"success": False, "label_url": "", "message": str(e)}


def generate_label(shipment_id: Any) -> Dict[str, Any]:
    """Alias for generate_shipping_label."""
    return generate_shipping_label(shipment_id)


def generate_manifest(shipment_id: Any) -> Dict[str, Any]:
    """
    Generates and retrieves a downloadable manifest PDF URL from Shiprocket.
    The manifest is required for courier handover; it must be generated after
    scheduling pickup and shown to the courier partner on collection.
    """
    token = get_auth_token()
    if not token:
        raise ValueError("Shiprocket authentication failed.")

    clean_id = int(str(shipment_id).strip()) if str(shipment_id).isdigit() else shipment_id
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(
                f"{BASE_URL}/manifests/generate",
                json={"shipment_id": [clean_id]},
                headers={"Authorization": f"Bearer {token}"}
            )
            if res.status_code == 200:
                data = res.json()
                manifest_url = sanitize_shiprocket_url(data.get("manifest_url", ""))
                return {
                    "success": True,
                    "manifest_url": manifest_url,
                    "message": data.get("message") or "Manifest generated successfully"
                }
            else:
                try:
                    err_data = res.json()
                    err_msg = err_data.get("message") or f"Failed to generate manifest ({res.status_code})"
                except Exception:
                    err_msg = f"Failed to generate manifest ({res.status_code}): {res.text}"
                return {"success": False, "manifest_url": "", "message": err_msg}
    except Exception as e:
        logger.warning(f"Failed to generate manifest for shipment {shipment_id}: {e}")
        return {"success": False, "manifest_url": "", "message": str(e)}


def generate_order_invoice(order_id: Any) -> Dict[str, Any]:
    """Generates and retrieves official downloadable Tax Invoice URL from Shiprocket."""
    token = get_auth_token()
    if not token:
        raise ValueError("Shiprocket authentication failed.")

    clean_id = int(str(order_id).strip()) if str(order_id).isdigit() else order_id
    try:
        with httpx.Client(timeout=12.0) as client:
            res = client.post(
                f"{BASE_URL}/orders/print/invoice",
                json={"ids": [clean_id]},
                headers={"Authorization": f"Bearer {token}"}
            )
            if res.status_code == 200:
                data = res.json()
                invoice_url = sanitize_shiprocket_url(data.get("invoice_url", ""))
                if invoice_url:
                    return {
                        "success": True,
                        "invoice_url": invoice_url,
                        "is_invoice_created": True,
                        "message": "Invoice generated successfully"
                    }

            # Fallback: check orders/show details for existing invoice_link
            show_res = client.get(
                f"{BASE_URL}/orders/show/{clean_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            if show_res.status_code == 200:
                show_data = show_res.json().get("data", {})
                shipments = show_data.get("shipments") or {}
                if isinstance(shipments, dict) and shipments.get("invoice_link"):
                    return {
                        "success": True,
                        "invoice_url": sanitize_shiprocket_url(shipments.get("invoice_link")),
                        "is_invoice_created": True,
                        "message": "Invoice retrieved from shipment"
                    }

            return {
                "success": False,
                "invoice_url": "",
                "message": "Invoice is pending generation in Shiprocket."
            }
    except Exception as e:
        logger.warning(f"Failed to fetch live invoice for order {order_id}: {e}")
        return {"success": False, "invoice_url": "", "message": str(e)}


def schedule_courier_pickup(
    shipment_id: Any,
    pickup_date: Optional[str] = None
) -> Dict[str, Any]:
    """Schedules courier doorstep collection in Shiprocket."""
    token = get_auth_token()
    if not token:
        raise ValueError("Shiprocket authentication failed.")

    clean_id = int(str(shipment_id).strip()) if str(shipment_id).isdigit() else shipment_id
    payload: Dict[str, Any] = {"shipment_id": [clean_id]}
    if pickup_date and pickup_date.strip():
        payload["pickup_date"] = [pickup_date.strip()]

    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(
                f"{BASE_URL}/courier/generate/pickup",
                json=payload,
                headers={"Authorization": f"Bearer {token}"}
            )

            # 400 with "Already in Pickup Queue" is considered an active success state
            if res.status_code == 400 and "Already in Pickup Queue" in res.text:
                return {
                    "success": True,
                    "pickup_status": 1,
                    "message": "Shipment is already scheduled in the courier pickup queue.",
                    "already_queued": True
                }

            if res.status_code == 200:
                data = res.json()
                pickup_status = data.get("pickup_status", 0)
                resp_info = data.get("response") or {}
                raw_msg = ""
                if isinstance(resp_info, dict):
                    raw_msg = str(resp_info.get("data") or resp_info.get("message") or "")
                elif isinstance(resp_info, str):
                    raw_msg = resp_info

                is_ok = bool(
                    pickup_status == 1
                    or data.get("pickup_token_number")
                    or (isinstance(resp_info, dict) and resp_info.get("pickup_token_number"))
                    or (isinstance(resp_info, dict) and resp_info.get("status") == 1)
                )

                if not is_ok:
                    clean_err = raw_msg or data.get("message")
                    if not clean_err or "rejected" in clean_err.lower():
                        clean_err = "Courier partner rejected pickup scheduling. Couriers only accept pickups scheduled for Today or Tomorrow (the immediate next business day). Future dates beyond tomorrow are not supported."
                    logger.warning(f"Shiprocket courier rejected pickup for shipment {shipment_id}: {clean_err}")
                    return {
                        "success": False,
                        "pickup_status": 0,
                        "message": clean_err,
                        "data": data
                    }

                pickup_token = (
                    (resp_info.get("pickup_token_number") if isinstance(resp_info, dict) else None)
                    or data.get("pickup_token_number")
                    or (f"ID: {resp_info.get('pickup_id')}" if isinstance(resp_info, dict) and resp_info.get("pickup_id") else None)
                )
                pickup_sched_date = (
                    (resp_info.get("pickup_scheduled_date") if isinstance(resp_info, dict) else None)
                    or data.get("pickup_scheduled_date")
                )

                return {
                    "success": True,
                    "pickup_status": 1,
                    "pickup_token": pickup_token,
                    "pickup_scheduled_date": pickup_sched_date,
                    "courier_name": resp_info.get("base_courier_company_name") if isinstance(resp_info, dict) else "Assigned Courier",
                    "message": raw_msg or data.get("message") or "Pickup scheduled with courier partner successfully.",
                    "data": data
                }
            else:
                try:
                    err_json = res.json()
                    err_msg = err_json.get("message") or str(err_json)
                except Exception:
                    err_msg = res.text
                if "already canceled" in str(err_msg).lower():
                    clean_err = "This shipment was cancelled in Shiprocket. Please re-dispatch or assign a new courier AWB before scheduling pickup."
                elif "pickup_date" in str(err_msg).lower() or "date" in str(err_msg).lower():
                    clean_err = "Courier partners only accept pickup scheduling for Today or Tomorrow (the immediate next business day)."
                else:
                    clean_err = f"Failed to schedule pickup ({res.status_code}): {err_msg}"
                return {
                    "success": False,
                    "pickup_status": 0,
                    "message": clean_err
                }
    except Exception as e:
        logger.warning(f"Failed to schedule pickup for shipment {shipment_id}: {e}")
        return {"success": False, "pickup_status": 0, "message": str(e)}


def cancel_shipment(
    shiprocket_order_id: Optional[Any] = None,
    awb_code: Optional[str] = None,
    order_id: Optional[Any] = None
) -> Dict[str, Any]:
    """Cancels courier order and shipment in Shiprocket."""
    token = get_auth_token()
    if not token:
        return {"success": False, "message": "Shiprocket authentication failed."}

    target_sr_id = shiprocket_order_id or order_id
    ids_list: List[int] = []
    if target_sr_id:
        s_id = str(target_sr_id).strip()
        if s_id.isdigit():
            ids_list.append(int(s_id))

    awbs_list = [str(awb_code).strip()] if awb_code else []

    if not ids_list and not awbs_list:
        return {"success": False, "message": "No Shiprocket order ID or AWB provided for cancellation."}

    try:
        with httpx.Client(timeout=12.0) as client:
            res = client.post(
                f"{BASE_URL}/orders/cancel",
                json={"ids": ids_list, "awbs": awbs_list},
                headers={"Authorization": f"Bearer {token}"}
            )
            try:
                data = res.json()
            except Exception:
                data = {}

            if res.status_code in (200, 201):
                return {
                    "success": True,
                    "status_code": res.status_code,
                    "message": data.get("message") or "Shipment cancelled successfully in Shiprocket.",
                    "data": data
                }
            else:
                return {
                    "success": False,
                    "status_code": res.status_code,
                    "message": data.get("message") or f"Shiprocket cancellation returned status {res.status_code}.",
                    "data": data
                }
    except Exception as e:
        logger.warning(f"Error cancelling shipment in Shiprocket: {e}")
        return {"success": False, "message": str(e)}

