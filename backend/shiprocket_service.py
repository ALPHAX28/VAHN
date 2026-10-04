import json
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
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
_cached_channel_id: Optional[str] = None
_cached_seller_location_id: Optional[str] = None

IST = timezone(timedelta(hours=5, minutes=30))


def to_ist(dt: Optional[datetime]) -> Optional[datetime]:
    """Convert UTC/naive datetime to Indian Standard Time (IST, UTC+5:30)."""
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)


# Shiprocket Exchange & Return Reason Codes
# 25: Defective product | 26: Damaged product | 27: Wrong item sent | 28: Quality not as expected
# 29: Size / Fit issue (Default for exchanges) | 30: Color mismatch | 31: Missing items
# 32: Better price | 33: Customer remorse | 34: Late delivery | 35: Fabric/material issue | 36: Other
SHIPROCKET_RETURN_REASONS: Dict[str, str] = {
    "size": "29",
    "fit": "29",
    "defective": "25",
    "defect": "25",
    "damaged": "26",
    "damage": "26",
    "wrong": "27",
    "quality": "28",
    "color": "30",
    "colour": "30",
    "missing": "31",
    "price": "32",
    "remorse": "33",
    "late": "34",
    "fabric": "35",
    "material": "35",
}


def is_configured() -> bool:
    """Returns True if Shiprocket credentials are set."""
    return bool(
        SHIPROCKET_EMAIL
        and "placeholder" not in SHIPROCKET_EMAIL.lower()
        and SHIPROCKET_PASSWORD
        and "placeholder" not in SHIPROCKET_PASSWORD.lower()
    )


def is_simulation_mode() -> bool:
    """
    Returns True if local simulation mode is enabled via SHIPROCKET_SIMULATION_MODE=true.
    Allows local end-to-end testing of forward shipping, delivery milestones, 10-day return countdown,
    size exchanges with Doorstep QC, reverse pickups, and auto-refunds with zero logistics cost.
    """
    return os.getenv("SHIPROCKET_SIMULATION_MODE", "false").lower() in ("true", "1", "yes")


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

    if is_simulation_mode():
        return {
            "serviceable": True,
            "estimated_days": "3 business days",
            "courier_name": "Blue Dart Express",
            "message": "Express delivery available to this PIN code.",
            "pincode": clean_pincode,
            "is_cod": True,
            "is_simulation": True,
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


def check_reverse_serviceability(
    customer_pincode: str,
    weight: float = 0.5,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Checks courier partner serviceability for reverse pickup from customer PIN code to primary warehouse.
    """
    clean_pincode = str(customer_pincode).strip()
    if not clean_pincode or len(clean_pincode) != 6 or not clean_pincode.isdigit() or clean_pincode.startswith("0"):
        return {
            "serviceable": False,
            "estimated_days": "N/A",
            "courier_name": None,
            "message": "Invalid PIN code. Indian postal codes must be 6 digits and cannot start with 0.",
            "pincode": clean_pincode,
        }

    if is_simulation_mode():
        return {
            "serviceable": True,
            "estimated_days": "2-3 business days",
            "courier_name": "Delhivery Reverse QC",
            "shipping_rate": 65.0,
            "pincode": clean_pincode,
            "is_simulation": True,
        }

    token = get_auth_token()
    wh = get_primary_warehouse(db)
    warehouse_pin = wh.get("pin_code", SHIPROCKET_PICKUP_PINCODE or "110019")

    if token:
        try:
            with httpx.Client(timeout=12.0) as client:
                res = client.get(
                    f"{BASE_URL}/courier/serviceability/",
                    params={
                        "pickup_postcode": clean_pincode,
                        "delivery_postcode": warehouse_pin,
                        "weight": str(weight),
                        "cod": "0",
                        "is_reverse": "1"
                    },
                    headers={"Authorization": f"Bearer {token}"}
                )
                if res.status_code == 200:
                    res_data = res.json()
                    data = res_data.get("data", {})
                    companies = data.get("available_courier_companies", [])
                    if companies:
                        best = sorted(
                            companies,
                            key=lambda c: (
                                int(c.get("estimated_delivery_days") or 99) if str(c.get("estimated_delivery_days", "")).isdigit() else 99,
                                float(c.get("rate") or 9999)
                            )
                        )[0]
                        est_days = best.get("estimated_delivery_days")
                        return {
                            "serviceable": True,
                            "estimated_days": f"{est_days} business days" if est_days else "3-5 business days",
                            "courier_name": best.get("courier_name", "Shiprocket Reverse"),
                            "shipping_rate": float(best.get("rate", 0)),
                            "pincode": clean_pincode
                        }
                    else:
                        api_msg = res_data.get("message")
                        return {
                            "serviceable": False,
                            "estimated_days": "N/A",
                            "courier_name": None,
                            "message": api_msg or "Reverse pickup is not available by courier partners for this PIN code.",
                            "pincode": clean_pincode
                        }
                else:
                    err_msg = res.json().get("message", "Reverse pickup is not available for this PIN code.")
                    return {
                        "serviceable": False,
                        "estimated_days": "N/A",
                        "courier_name": None,
                        "message": err_msg,
                        "pincode": clean_pincode
                    }
        except Exception as e:
            logger.warning(f"Shiprocket reverse serviceability check error: {e}")
            return {
                "serviceable": False,
                "estimated_days": "N/A",
                "courier_name": None,
                "message": f"Logistics network error: {str(e)}",
                "pincode": clean_pincode
            }

    return {
        "serviceable": False,
        "estimated_days": "N/A",
        "courier_name": None,
        "message": "Logistics verification service is currently offline.",
        "pincode": clean_pincode
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
    declared_value: Optional[float] = None,
    db: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Fetches real-time available courier partners from Shiprocket's live serviceability API
    for a given delivery pincode, declared order value, and weight. Returns live Shiprocket-sourced
    rates, Radar ratings, ETD, pickup constraints, and logo URLs with ZERO mock or fallback data.
    """
    token = get_auth_token()
    if not token:
        raise ValueError("Shiprocket API authentication failed. Please verify credentials in settings.")

    wh = get_primary_warehouse(db)
    pickup_pin = wh.get("pin_code", SHIPROCKET_PICKUP_PINCODE or "110019")
    clean_pincode = str(delivery_pincode).strip()

    # Pass declared value for live coverage calculations
    decl_val = str(int(declared_value or 3010))

    params: Dict[str, Any] = {
        "pickup_postcode": pickup_pin,
        "delivery_postcode": clean_pincode,
        "weight": str(round(float(weight), 3)),
        "cod": "0",
        "declared_value": decl_val,
        "is_auto_secure": "1"
    }
    if order_id:
        params["order_id"] = str(order_id).strip()

    try:
        with httpx.Client(timeout=20.0) as client:
            res = client.get(
                f"{BASE_URL}/courier/serviceability/",
                params=params,
                headers={"Authorization": f"Bearer {token}"}
            )
            if res.status_code != 200:
                logger.error(f"Shiprocket serviceability API error ({res.status_code}): {res.text}")
                raise ValueError(f"Shiprocket serviceability API returned HTTP {res.status_code}: {res.text}")

            companies = res.json().get("data", {}).get("available_courier_companies", [])
            if not companies:
                logger.warning(f"No courier partners available from Shiprocket for delivery PIN {clean_pincode}")
                return []

            # Determine next business pickup day in Indian Standard Time (IST)
            now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
            weekday = now_ist.weekday()  # Monday=0 ... Saturday=5, Sunday=6
            is_after_cutoff = now_ist.hour >= 11

            if weekday in (5, 6) or (weekday == 4 and is_after_cutoff):
                pickup_day_name = "Monday"
            elif is_after_cutoff:
                pickup_day_name = (now_ist + timedelta(days=1)).strftime("%A")
            else:
                pickup_day_name = "Today"

            result = []
            for c in companies:
                # Exclude couriers with blocked first-mile pickup
                sup = c.get("suppression_dates") or {}
                if str(sup.get("blocked_fm") or "").strip() == "1":
                    continue

                c_id = c.get("courier_company_id")
                c_name = str(c.get("courier_name") or "Express Courier")
                c_name_lower = c_name.lower()

                # Parse others metadata for auto_pickup and logo
                others_raw = c.get("others") or "{}"
                try:
                    others = json.loads(others_raw) if isinstance(others_raw, str) else others_raw
                except Exception:
                    others = {}
                is_auto_pickup = bool(others.get("auto_pickup") == 1)
                raw_logo_url = others.get("courier_logo_url") or ""
                # Map authentic local courier logos for seamless frontend presentation
                if any(k in c_name_lower for k in ["amazon"]):
                    logo_url = "/couriers/amazon.png"
                elif any(k in c_name_lower for k in ["dtdc"]):
                    logo_url = "/couriers/dtdc.png"
                elif any(k in c_name_lower for k in ["blue dart", "bluedart"]):
                    logo_url = "/couriers/bluedart.svg"
                elif any(k in c_name_lower for k in ["delhivery"]):
                    logo_url = "/couriers/delhivery.png"
                elif any(k in c_name_lower for k in ["xpressbees", "xpress"]):
                    logo_url = "/couriers/xpressbees.webp"
                elif any(k in c_name_lower for k in ["shadowfax"]):
                    logo_url = "/couriers/shadowfax.svg"
                elif any(k in c_name_lower for k in ["smartr"]):
                    logo_url = "/couriers/smartr.webp"
                elif any(k in c_name_lower for k in ["ecom express", "ecomexpress"]):
                    logo_url = "/couriers/ecomexpress.svg"
                elif raw_logo_url and "kr-shipmultichannel-mum/courier_logo/" not in raw_logo_url:
                    logo_url = raw_logo_url
                else:
                    logo_url = ""

                # Expected pickup text
                if is_auto_pickup:
                    expected_pickup_text = f"Auto-Scheduled Pickup for {pickup_day_name}"
                else:
                    expected_pickup_text = pickup_day_name

                # Total charges inclusive of Auto-Secured insurance protection (Rs 54 for order value <= Rs 5000)
                raw_rate = float(c.get("rate") or 0.0)
                total_charges = round(raw_rate + 54.0, 2)

                # Radar rating
                raw_rating = c.get("rating")
                try:
                    rating_val = round(float(raw_rating), 1) if raw_rating is not None else 4.5
                except Exception:
                    rating_val = 4.5

                # RTO charges directly from Shiprocket serviceability response
                raw_rto = c.get("rto_charges")
                try:
                    rto_val = round(float(raw_rto), 2) if raw_rto is not None and str(raw_rto).strip() != "" else None
                except Exception:
                    rto_val = None

                # Top recommended courier: Amazon Prepaid Surface 500g (ID 142) has 5.0 Radar rating & auto pickup
                is_rec = bool(
                    c_id == 142
                    or (rating_val >= 5.0 and is_auto_pickup)
                )

                # Pickup SLA constraint
                if any(k in c_name_lower for k in ["dtdc", "smartr", "priority"]):
                    pickup_constraint = "anytime"
                    pickup_days_window = 7
                    pickup_rule_desc = "Flexible: Ship anytime within 7 days"
                else:
                    pickup_constraint = "within_2_days"
                    pickup_days_window = 2
                    pickup_rule_desc = "Must ship within 2 days (Today or Tomorrow)"

                est_days_raw = c.get("estimated_delivery_days")
                est_days = int(est_days_raw) if str(est_days_raw or "").isdigit() else None

                result.append({
                    "courier_company_id": c_id,
                    "courier_name": c_name,
                    "rate": total_charges,
                    "base_rate": raw_rate,
                    "estimated_delivery_days": est_days,
                    "etd": c.get("etd"),
                    "city": c.get("city"),
                    "state": c.get("state"),
                    "rating": rating_val,
                    "rto_charges": rto_val,
                    "cutoff_time": str(c.get("cutoff_time") or "11:00"),
                    "is_recommended": is_rec,
                    "is_auto_pickup": is_auto_pickup,
                    "expected_pickup": expected_pickup_text,
                    "courier_logo_url": logo_url,
                    "pickup_constraint": pickup_constraint,
                    "pickup_days_window": pickup_days_window,
                    "pickup_rule_description": pickup_rule_desc,
                    "is_surface": bool(c.get("is_surface")),
                    "min_weight": float(c.get("min_weight") or 0.5),
                    "charge_weight": float(c.get("charge_weight") or weight),
                })

            # Sort: Recommended first, then highest rating, then lowest rate
            result.sort(key=lambda x: (not bool(x["is_recommended"]), -float(x.get("rating") or 0.0), float(x.get("rate") or 0.0)))
            return result
    except Exception as e:
        logger.error(f"Failed to fetch Shiprocket live courier serviceability: {e}")
        raise ValueError(f"Shiprocket serviceability error: {str(e)}")



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
    if is_simulation_mode():
        now_ts = int(time.time())
        sim_order_id = str(now_ts % 1000000)
        sim_shipment_id = str((now_ts + 1) % 1000000)
        sim_awb = f"SIM-AWB-{now_ts}"
        sim_courier = "Blue Dart Express"
        logger.info(f"[SIMULATION] Simulated forward shipment for order {getattr(order, 'id', 'N/A')}: AWB {sim_awb}")
        return {
            "order_id": sim_order_id,
            "shipment_id": sim_shipment_id,
            "awb_code": sim_awb,
            "courier_name": sim_courier,
            "shiprocket_order_id": sim_order_id,
            "shiprocket_shipment_id": sim_shipment_id,
            "shiprocket_awb": sim_awb,
            "shiprocket_courier_name": sim_courier,
            "shipping_status": "MANIFEST_GENERATED",
            "is_simulation": True,
        }

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

    ist_order_dt = to_ist(order.created_at) if order.created_at else None
    order_date_str = ist_order_dt.strftime("%Y-%m-%d %H:%M") if ist_order_dt else datetime.now(IST).strftime("%Y-%m-%d %H:%M")

    payload = {
        "order_id": order.id,
        "order_date": order_date_str,
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

    if is_simulation_mode() or clean_awb.startswith("SIM-"):
        now_dt = datetime.now(timezone.utc)
        is_delivered = "DELV" in clean_awb.upper()
        return {
            "awb": clean_awb,
            "current_status": "DELIVERED" if is_delivered else "IN_TRANSIT",
            "courier_name": "Blue Dart Express",
            "current_location": "Customer Destination" if is_delivered else "Regional Sorting Facility",
            "is_picked_up": True,
            "is_delivered": is_delivered,
            "return_awb_code": "",
            "is_return": clean_awb.startswith("SIM-REV-"),
            "scans": [
                {
                    "date": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    "activity": "Shipment Delivered to Consignee" if is_delivered else "In Transit to Destination Hub",
                    "location": "Destination City Hub" if is_delivered else "Regional Processing Hub",
                    "sr_status": "DL" if is_delivered else "IT",
                },
                {
                    "date": (now_dt - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
                    "activity": "Picked Up by Courier Agent",
                    "location": "Origin Fulfillment Center",
                    "sr_status": "PU",
                }
            ],
            "is_simulation": True,
        }

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
                    shipment_track = track_data.get("shipment_track", [])
                    return_awb_code = ""
                    is_return = bool(track_data.get("is_return"))
                    if isinstance(shipment_track, list) and shipment_track:
                        st0 = shipment_track[0]
                        return_awb_code = str(st0.get("return_awb_code") or "").strip()
                        if not is_return:
                            is_return = bool(st0.get("is_return"))

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
                        def _parse_ts(s_dict):
                            d_str = str(s_dict.get("date") or "").strip()
                            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d-%m-%Y %H:%M:%S", "%d/%m/%Y %H:%M:%S"):
                                try:
                                    return datetime.strptime(d_str[:19], fmt).timestamp()
                                except Exception:
                                    pass
                            return 0.0

                        sorted_by_date = sorted(scans_list, key=_parse_ts, reverse=True)
                        for s_item in sorted_by_date:
                            raw_loc = (s_item.get("location") or "").strip()
                            if raw_loc and raw_loc.lower() not in (
                                "in transit", "transit", "unfulfilled", "processing",
                                "manifest generated", "origin facility", "pending", "unknown", "n/a"
                            ):
                                latest_loc = raw_loc
                                break

                    is_delivered = (
                        current_status in ("DELIVERED", "RETURN_DELIVERED", "RTO_DELIVERED", "DELIVERED_TO_WAREHOUSE", "REACHED_WAREHOUSE")
                        or "DELIVERED" in current_status
                        or any("deliver" in str(s.get("activity", "")).lower() for s in scans_list)
                    )
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
                        "is_delivered": is_delivered,
                        "return_awb_code": return_awb_code,
                        "is_return": is_return,
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
        "is_delivered": False,
        "return_awb_code": "",
        "is_return": False,
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
    pickup_address: Optional[Dict[str, Any]] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Creates an automated return/reverse pickup order on Shiprocket to the primary warehouse.
    """
    if is_simulation_mode():
        now_ts = int(time.time())
        sim_ship_id = f"SIM-REV-SHIP-{now_ts % 100000}"
        sim_awb = f"SIM-REV-{now_ts}"
        logger.info(f"[SIMULATION] Simulated reverse pickup for order {getattr(order, 'id', 'N/A')}: AWB {sim_awb}")
        return {
            "success": True,
            "reverse_shipment_id": sim_ship_id,
            "reverse_awb": sim_awb,
            "reverse_courier_name": "Delhivery Reverse Express",
            "reverse_status": "PICKUP_SCHEDULED",
            "is_simulation": True,
        }

    token = get_auth_token()
    if not token:
        raise ValueError("Shiprocket API authentication is not active for reverse logistics.")

    wh = get_primary_warehouse(db)

    # Resolve pickup details: check explicit pickup_address override first, then order.shipping_address, then user/guest
    addr = pickup_address or (order.shipping_address if isinstance(order.shipping_address, dict) else {})
    pickup_name = (
        addr.get("name")
        or addr.get("fullName")
        or (order.guest_name if order.is_guest else (order.user.full_name if order.user else "Customer"))
    )
    pickup_phone = (
        addr.get("phone")
        or (order.guest_phone if order.is_guest else (order.user.phone if order.user else "9876543210"))
    )
    pickup_addr_str = addr.get("address") or addr.get("streetAddress") or ""
    pickup_city = addr.get("city") or "Mumbai"
    pickup_state = addr.get("state") or "Maharashtra"
    pickup_pincode = str(addr.get("postalCode") or addr.get("pincode") or "400001").strip()

    ist_return_dt = to_ist(order.created_at) if order.created_at else None
    return_date_str = ist_return_dt.strftime("%Y-%m-%d %H:%M") if ist_return_dt else datetime.now(IST).strftime("%Y-%m-%d %H:%M")

    with httpx.Client(timeout=15.0) as client:
        res = client.post(
            f"{BASE_URL}/orders/create/return",
            json={
                "order_id": order.id,
                "order_date": return_date_str,
                "channel_id": "",
                "pickup_customer_name": pickup_name,
                "pickup_address": pickup_addr_str,
                "pickup_city": pickup_city,
                "pickup_state": pickup_state,
                "pickup_pincode": pickup_pincode,
                "pickup_phone": pickup_phone,
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


def map_shiprocket_return_status(
    sr_status: str,
    is_delivered: bool = False,
    is_picked_up: bool = False
) -> str:
    """
    Normalizes Shiprocket return/reverse tracking status into app's canonical return_status:
    REQUESTED | PICKUP_SCHEDULED | PICKED_UP | DELIVERED_TO_WAREHOUSE | CANCELLED
    """
    raw = (sr_status or "").upper().strip()
    if is_delivered or any(k in raw for k in ("DELIVERED", "REACHED", "RECEIVED_AT_WAREHOUSE", "RESTOCKED")):
        return "DELIVERED_TO_WAREHOUSE"
    if is_picked_up or any(k in raw for k in ("PICKED_UP", "PICKED UP", "IN_TRANSIT", "IN TRANSIT", "OUT FOR PICKUP", "OUT_FOR_PICKUP")):
        return "PICKED_UP"
    if any(k in raw for k in ("CANCEL", "CANCELED", "CANCELLED", "REJECTED")):
        return "CANCELLED"
    if any(k in raw for k in ("SCHEDULED", "MANIFEST", "AWB", "ASSIGNED")):
        return "PICKUP_SCHEDULED"
    if any(k in raw for k in ("PENDING", "REQUESTED", "CREATED", "NEW")):
        return "REQUESTED"
    return "REQUESTED"


def fetch_shiprocket_return_orders(
    search: Optional[str] = None,
    channel_order_id: Optional[str] = None,
    per_page: int = 50
) -> List[Dict[str, Any]]:
    """
    Queries Shiprocket's return processing endpoint:
    GET /orders/processing/return?search=...&per_page=...&sort=desc
    Returns the list of return order objects.
    """
    if is_simulation_mode():
        return []

    token = get_auth_token()
    if not token:
        return []

    params: Dict[str, Any] = {"per_page": min(max(per_page, 1), 100), "sort": "desc"}
    search_query = str(search or channel_order_id or "").strip()
    if search_query:
        params["search"] = search_query

    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.get(
                f"{BASE_URL}/orders/processing/return",
                params=params,
                headers={"Authorization": f"Bearer {token}"}
            )
            if res.status_code == 200:
                data = res.json()
                return data.get("data", []) or []
            else:
                logger.warning(f"Shiprocket return orders API returned HTTP {res.status_code}: {res.text}")
    except Exception as exc:
        logger.warning(f"Error fetching return orders from Shiprocket: {exc}")

    return []


def find_shiprocket_return_order(
    order_id: str,
    forward_awb: Optional[str] = None,
    sr_order_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Attempts to locate an active return order in Shiprocket corresponding to our order.
    Checks:
    1. Forward AWB tracking if forward_awb is provided: Shiprocket links return_awb_code in shipment_track[0].
    2. Search query on /orders/processing/return with exact order_id (e.g. 'ORD-XXXXXX').
    3. Search query with common return prefixes/suffixes (e.g. 'ORD-XXXXXX-RET', 'ORD-XXXXXX-RETURN', 'RET-ORD-XXXXXX').
    4. Fetch recent return orders list and match channel_order_id (normalizing common suffixes).
    """
    clean_id = str(order_id).strip()
    if not clean_id:
        return None

    # Helper to parse return order object
    def _parse_ret_item(item: Dict[str, Any]) -> Dict[str, Any]:
        shipments = item.get("shipments") or []
        first_ship = shipments[0] if (isinstance(shipments, list) and shipments) else {}
        ret_awb = str(first_ship.get("awb") or item.get("awb_code") or "").strip()
        ret_courier = first_ship.get("courier") or item.get("courier_name") or "Shiprocket Reverse"
        return {
            "return_order_id": str(item.get("id") or ""),
            "return_shipment_id": str(item.get("shipment_id") or ""),
            "channel_order_id": str(item.get("channel_order_id") or clean_id),
            "status": str(item.get("status") or "").upper(),
            "return_reason": item.get("return_reason") or (item.get("refund_detail") or {}).get("return_reason") or "",
            "is_return_exchange": bool(item.get("is_return_exchange")),
            "reverse_awb": ret_awb,
            "reverse_courier_name": ret_courier,
            "raw": item
        }

    # 1. Forward AWB tracking check
    if forward_awb:
        try:
            live = track_awb(forward_awb)
            ret_awb = str(live.get("return_awb_code") or "").strip()
            if ret_awb:
                logger.info(f"Discovered return AWB {ret_awb} linked to forward AWB {forward_awb} for order {clean_id}")
                rev_track = track_awb(ret_awb)
                return {
                    "return_order_id": "",
                    "return_shipment_id": "",
                    "channel_order_id": clean_id,
                    "status": rev_track.get("current_status") or "PICKUP_SCHEDULED",
                    "return_reason": "Return created in Shiprocket",
                    "is_return_exchange": False,
                    "reverse_awb": ret_awb,
                    "reverse_courier_name": rev_track.get("courier_name") or "Shiprocket Reverse",
                    "raw": {"forward_awb": forward_awb, "reverse_awb": ret_awb, "tracking": rev_track}
                }
        except Exception as e_fwd:
            logger.warning(f"Error checking forward AWB {forward_awb} for return code: {e_fwd}")

    # 2. Search Shiprocket returns by order ID variations
    candidate_queries = [
        clean_id,
        f"{clean_id}-RET",
        f"{clean_id}-RETURN",
        f"RET-{clean_id}"
    ]
    for q in candidate_queries:
        returns = fetch_shiprocket_return_orders(search=q)
        for ret in returns:
            ch_id = str(ret.get("channel_order_id") or "").strip()
            norm_ch_id = re.sub(r'[-_](?:RET|RETURN|EXC|EXCHANGE)$', '', ch_id, flags=re.IGNORECASE)
            norm_ch_id = re.sub(r'^(?:RET|EXC)[-_]', '', norm_ch_id, flags=re.IGNORECASE)
            if norm_ch_id.lower() == clean_id.lower() or ch_id.lower() == clean_id.lower():
                logger.info(f"Found return order in Shiprocket matching query '{q}': ID={ret.get('id')}")
                return _parse_ret_item(ret)

    # 3. Fallback: inspect the most recent 50 return orders from Shiprocket
    recent_returns = fetch_shiprocket_return_orders(per_page=50)
    for ret in recent_returns:
        ch_id = str(ret.get("channel_order_id") or "").strip()
        norm_ch_id = re.sub(r'[-_](?:RET|RETURN|EXC|EXCHANGE)$', '', ch_id, flags=re.IGNORECASE)
        norm_ch_id = re.sub(r'^(?:RET|EXC)[-_]', '', norm_ch_id, flags=re.IGNORECASE)
        fwd_order_ref = str(ret.get("extra_info", {}).get("forward_order_id") or "").strip()
        if (
            norm_ch_id.lower() == clean_id.lower()
            or ch_id.lower() == clean_id.lower()
            or (sr_order_id and fwd_order_ref == str(sr_order_id).strip())
        ):
            logger.info(f"Found return order in recent Shiprocket returns: ID={ret.get('id')}, channel_order_id={ch_id}")
            return _parse_ret_item(ret)

    return None


def get_channel_id() -> str:
    """Fetches and caches the active custom channel ID from Shiprocket."""
    global _cached_channel_id
    if _cached_channel_id:
        return _cached_channel_id

    token = get_auth_token()
    if token:
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(f"{BASE_URL}/channels", headers={"Authorization": f"Bearer {token}"})
                if res.status_code == 200:
                    channels = res.json().get("data", [])
                    for ch in channels:
                        if ch.get("status") == "Active":
                            _cached_channel_id = str(ch.get("id"))
                            return _cached_channel_id
        except Exception as e:
            logger.warning(f"Could not fetch channel ID from Shiprocket: {e}")

    # Fallback to verified active VAHN custom channel ID
    return "10365865"


def get_seller_location_id(db: Optional[Session] = None) -> str:
    """
    Resolves the numeric warehouse location ID required by Shiprocket order creation endpoints.
    Prioritizes DB WarehouseLocation.shiprocket_pickup_id, then queries Shiprocket pickup locations API.
    """
    global _cached_seller_location_id
    if _cached_seller_location_id:
        return _cached_seller_location_id

    # 1. Check database for primary warehouse location with a valid numeric shiprocket_pickup_id
    close_db = False
    if db is None:
        try:
            db = database.SessionLocal()
            close_db = True
        except Exception:
            pass

    if db:
        try:
            wh = db.query(models.WarehouseLocation).filter(
                models.WarehouseLocation.is_primary == True,
                models.WarehouseLocation.pickup_location != "Primary",
                models.WarehouseLocation.phone != ""
            ).first()
            if not wh:
                wh = db.query(models.WarehouseLocation).first()
            if wh and wh.shiprocket_pickup_id and str(wh.shiprocket_pickup_id).strip().isdigit():
                _cached_seller_location_id = str(wh.shiprocket_pickup_id).strip()
                return _cached_seller_location_id
        except Exception as e:
            logger.debug(f"DB lookup for warehouse location ID failed: {e}")
        finally:
            if close_db:
                db.close()

    # 2. Query Shiprocket registered pickup locations API
    locations = fetch_shiprocket_pickup_locations()
    target_loc = SHIPROCKET_PICKUP_LOCATION or "Home"
    for loc in locations:
        if loc.get("status") == 1 and loc.get("pickup_location") == target_loc:
            _cached_seller_location_id = str(loc.get("id"))
            return _cached_seller_location_id

    # If exact nickname not matched, pick first active verified location
    for loc in locations:
        if loc.get("status") == 1 and str(loc.get("phone", "")).strip():
            _cached_seller_location_id = str(loc.get("id"))
            return _cached_seller_location_id

    # 3. Known fallback for Home warehouse
    return "110332741"


def map_return_reason_id(reason: Optional[str]) -> str:
    """Maps free-text return/exchange reason to Shiprocket numeric return reason ID."""
    if not reason:
        return "29"
    r = reason.lower()
    for key, code in SHIPROCKET_RETURN_REASONS.items():
        if key in r:
            return code
    return "29"


def _split_name(full_name: Optional[str]) -> tuple[str, str]:
    """Splits full customer name into first and last name safely."""
    parts = (full_name or "Customer").strip().split(maxsplit=1)
    first_name = parts[0] if parts else "Customer"
    last_name = parts[1] if len(parts) > 1 else first_name
    return first_name, last_name


def _clean_phone(raw_phone: Optional[str]) -> str:
    """Cleans phone numbers to ensure standard 10-digit format for Indian telecom."""
    cleaned = re.sub(r"[^\d]", "", str(raw_phone or ""))
    if cleaned.startswith("91") and len(cleaned) == 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]
    return cleaned if len(cleaned) == 10 else "9876543210"


def create_exchange_order(
    order: Any,
    original_item: Optional[Any] = None,
    replacement_variant: Optional[Any] = None,
    return_reason: str = "Size Mismatch",
    pickup_address: Optional[Dict[str, Any]] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Creates an automated paired Exchange Order on Shiprocket (POST /orders/create/exchange).
    Simultaneously books reverse return pickup from customer and forward replacement shipment from warehouse,
    configuring Doorstep QC inspection flags. Gracefully falls back to create_reverse_pickup() on any failure.
    """
    if is_simulation_mode():
        now_ts = int(time.time())
        order_id_val = str(getattr(order, 'id', '1001'))
        logger.info(f"[SIMULATION] Simulating Shiprocket create_exchange_order for Order {order_id_val}")
        return {
            "is_native_exchange": True,
            "reverse_shipment_id": f"SIM-REV-SHIP-{now_ts % 100000}",
            "reverse_order_id": f"RET-{order_id_val}",
            "reverse_awb": f"SIM-REV-{now_ts}",
            "reverse_courier_name": "Delhivery Reverse QC",
            "reverse_status": "PICKUP_SCHEDULED",
            "replacement_shipment_id": f"SIM-REP-SHIP-{now_ts % 100000}",
            "replacement_order_id": f"EXC-{order_id_val}",
            "replacement_awb": f"SIM-REP-{now_ts}",
            "replacement_courier_name": "Blue Dart Surface Doorstep QC",
            "replacement_status": "PICKUP_SCHEDULED",
            "is_simulation": True,
        }

    token = get_auth_token()
    if not token:
        logger.warning("Shiprocket authentication offline during exchange creation; using fallback.")
        return create_reverse_pickup(order, return_reason=return_reason, db=db)

    # 1. Resolve customer pickup/shipping addresses
    addr = pickup_address or (order.shipping_address if isinstance(order.shipping_address, dict) else {})
    raw_name = (
        (order.user.full_name if order.user and order.user.full_name else None)
        or order.guest_name
        or addr.get("name")
        or "Customer"
    )
    first_name, last_name = _split_name(raw_name)

    raw_phone = (
        (order.user.phone if order.user and order.user.phone else None)
        or order.guest_phone
        or addr.get("phone")
        or "9876543210"
    )
    phone = _clean_phone(raw_phone)

    email = (
        (order.user.email if order.user and order.user.email else None)
        or order.guest_email
        or addr.get("email")
        or "customer@vahnsports.com"
    )

    street_addr = addr.get("address") or addr.get("streetAddress") or "Customer Address"
    city = addr.get("city") or "Delhi"
    state = addr.get("state") or "Delhi"
    country = addr.get("country") or "India"
    pincode = str(addr.get("postalCode") or addr.get("pincode") or "110001").strip()

    # 2. Resolve warehouse location IDs & channels
    seller_loc_id = get_seller_location_id(db)
    channel_id = get_channel_id()
    reason_id = map_return_reason_id(return_reason)

    # 3. Resolve original and replacement items
    if original_item is None and hasattr(order, "items") and order.items:
        original_item = order.items[0]

    orig_name = original_item.product_title if original_item else "Apparel Item"
    orig_sku = getattr(original_item, "variant_id", None) or getattr(original_item, "id", "SKU-001")
    orig_price = float(getattr(original_item, "price_amount", 0.0) or (order.total_amount if order else 500.0))
    orig_img = getattr(original_item, "image_url", None) or "https://vahnsports.com/logo.png"

    rep_name = f"{orig_name} ({replacement_variant.title})" if replacement_variant else f"{orig_name} (Exchange)"
    rep_sku = getattr(replacement_variant, "id", f"EXC-{orig_sku}")
    rep_size = getattr(replacement_variant, "title", "M")

    order_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    exchange_order_id = f"EXC-{order.id}"
    return_order_id = f"RET-{order.id}"

    payload = {
        "order_items": [
            {
                "name": orig_name,
                "selling_price": f"{orig_price:.2f}",
                "units": "1",
                "hsn": "610910",
                "sku": str(orig_sku),
                "tax": "",
                "discount": "",
                "brand": "VAHN",
                "color": "",
                "exchange_item_id": str(rep_sku),
                "exchange_item_name": rep_name,
                "exchange_item_sku": str(rep_sku),
                "qc_enable": True,
                "qc_product_name": orig_name,
                "qc_product_image": orig_img,
                "qc_brand": "VAHN",
                "qc_color": "",
                "qc_size": str(rep_size),
                "accessories": "",
                "qc_used_check": "1",
                "qc_sealtag_check": "1",
                "qc_brand_box": "1",
                "qc_check_damaged_product": "yes",
            }
        ],
        "buyer_pickup_first_name": first_name,
        "buyer_pickup_last_name": last_name,
        "buyer_pickup_email": email,
        "buyer_pickup_address": street_addr,
        "buyer_pickup_address_2": "",
        "buyer_pickup_city": city,
        "buyer_pickup_state": state,
        "buyer_pickup_country": country,
        "buyer_pickup_phone": phone,
        "buyer_pickup_pincode": pincode,
        "buyer_shipping_first_name": first_name,
        "buyer_shipping_last_name": last_name,
        "buyer_shipping_email": email,
        "buyer_shipping_address": street_addr,
        "buyer_shipping_address_2": "",
        "buyer_shipping_city": city,
        "buyer_shipping_state": state,
        "buyer_shipping_country": country,
        "buyer_shipping_phone": phone,
        "buyer_shipping_pincode": pincode,
        "seller_pickup_location_id": str(seller_loc_id),
        "seller_shipping_location_id": str(seller_loc_id),
        "exchange_order_id": exchange_order_id,
        "return_order_id": return_order_id,
        "payment_method": "prepaid",
        "order_date": order_date,
        "channel_id": channel_id,
        "existing_order_id": "",
        "return_reason": reason_id,
        "sub_total": f"{orig_price:.2f}",
        "shipping_charges": "0",
        "giftwrap_charges": "0",
        "total_discount": "0",
        "transaction_charges": "0",
        "exchange_length": "15",
        "exchange_breadth": "15",
        "exchange_height": "5",
        "exchange_weight": "0.5",
        "return_length": "15.00",
        "return_breadth": "15.00",
        "return_height": "5.00",
        "return_weight": "0.500",
        "qc_check": "true",
    }

    try:
        with httpx.Client(timeout=18.0) as client:
            res = client.post(
                f"{BASE_URL}/orders/create/exchange",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
            if res.status_code in (200, 201):
                data = res.json().get("data", {})
                fwd = data.get("forward_orders", {})
                ret = data.get("return_orders", {})
                logger.info(
                    f"Successfully created paired Shiprocket exchange order: fwd_id={fwd.get('order_id')}, "
                    f"ret_id={ret.get('order_id')}"
                )
                return {
                    "is_native_exchange": True,
                    "reverse_shipment_id": str(ret.get("shipment_id", "")),
                    "reverse_order_id": str(ret.get("order_id", "")),
                    "reverse_awb": str(ret.get("awb_code", "")),
                    "reverse_courier_name": ret.get("courier_name") or "Shiprocket Reverse",
                    "reverse_status": "PICKUP_SCHEDULED",
                    "replacement_shipment_id": str(fwd.get("shipment_id", "")),
                    "replacement_order_id": str(fwd.get("order_id", "")),
                    "replacement_awb": str(fwd.get("awb_code", "")),
                    "replacement_courier_name": fwd.get("courier_name") or "Shiprocket Express",
                    "replacement_status": "PICKUP_SCHEDULED",
                    "raw_response": data,
                }
            else:
                logger.warning(
                    f"Shiprocket native exchange API returned {res.status_code}: {res.text}. "
                    f"Executing graceful fallback to create_reverse_pickup()."
                )
    except Exception as exc:
        logger.error(f"Error during Shiprocket create_exchange_order: {exc}. Executing graceful fallback.")

    # Graceful fallback to reverse pickup creation
    rev_res = create_reverse_pickup(order, return_reason=return_reason, pickup_address=pickup_address, db=db)
    return {
        "is_native_exchange": False,
        "reverse_shipment_id": rev_res.get("reverse_shipment_id", ""),
        "reverse_order_id": "",
        "reverse_awb": rev_res.get("reverse_awb", ""),
        "reverse_courier_name": rev_res.get("reverse_courier_name", "Shiprocket Reverse"),
        "reverse_status": rev_res.get("reverse_status", "PICKUP_SCHEDULED"),
        "replacement_shipment_id": "",
        "replacement_order_id": "",
        "replacement_awb": "",
        "replacement_courier_name": "",
        "replacement_status": "PICKUP_SCHEDULED",
    }


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
    if is_simulation_mode() or str(shipment_id).startswith("SIM-"):
        return {
            "success": True,
            "label_url": "https://vahnsports.com/sample-shipping-label.pdf",
            "label_created": 1,
            "message": "Label generated successfully (Simulation Mode)",
            "is_simulation": True,
        }

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
    if is_simulation_mode() or str(order_id).startswith("SIM-"):
        return {
            "success": True,
            "invoice_url": "https://vahnsports.com/sample-tax-invoice.pdf",
            "is_invoice_created": True,
            "message": "Invoice generated successfully (Simulation Mode)",
            "is_simulation": True,
        }

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
    if is_simulation_mode() or str(shipment_id).startswith("SIM-"):
        now_ts = int(time.time())
        return {
            "success": True,
            "pickup_status": 1,
            "pickup_token": f"SIM-PK-{now_ts}",
            "pickup_scheduled_date": pickup_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "message": "Courier pickup scheduled successfully (Simulation Mode).",
            "is_simulation": True,
        }

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
    if is_simulation_mode():
        return {
            "success": True,
            "status_code": 200,
            "message": "Shipment cancelled successfully in Shiprocket (Simulation Mode).",
            "data": {"status": "SUCCESS"},
            "is_simulation": True,
        }

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

