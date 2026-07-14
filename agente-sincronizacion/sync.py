#!/usr/bin/env python3
"""
Agente de sincronización SAP Business One → Backend Render.

Corre dentro de la red de la empresa (cron diario).
Empuja datos por HTTPS saliente; no requiere puertos entrantes.
"""

import json
import logging
import os
import sys
from datetime import datetime
from urllib.parse import urljoin

import requests
import urllib3
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("sync-agent")

SAP_FIELDS = [
    "CardCode",
    "CardName",
    "U_CollectionDate",
    "U_JobName",
    "U_JobType",
    "U_Product",
    "U_Sub",
    "U_Fat",
    "U_Protein",
    "U_Lactose",
    "U_TS",
    "U_FPD",
    "U_Casein",
    "U_Urea",
    "U_Remarks",
]

SELECT_CLAUSE = ",".join(SAP_FIELDS)


def env(name: str, required: bool = True) -> str:
    value = os.getenv(name, "").strip()
    if required and not value:
        log.error("Variable de entorno requerida: %s", name)
        sys.exit(1)
    return value


def sap_session() -> requests.Session:
    base_url = env("SAP_BASE_URL").rstrip("/")
    verify = os.getenv("SAP_VERIFY_SSL", "false").lower() == "true"

    if not verify:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    session = requests.Session()
    session.verify = verify

    login_url = f"{base_url}/Login"
    payload = {
        "CompanyDB": env("SAP_COMPANY_DB"),
        "UserName": env("SAP_USER"),
        "Password": env("SAP_PASSWORD"),
    }

    log.info("Login SAP Service Layer…")
    resp = session.post(login_url, json=payload, timeout=60)
    resp.raise_for_status()
    log.info("Sesión SAP OK")
    return session, base_url


def backend_headers() -> dict:
    return {"X-Api-Key": env("INGEST_API_KEY"), "Content-Type": "application/json"}


def get_sync_from_date() -> str | None:
    override = os.getenv("SYNC_FROM_DATE", "").strip()
    if override:
        return override

    backend_url = env("BACKEND_URL").rstrip("/")
    url = f"{backend_url}/internal/sync-status"

    log.info("Consultando sync-status en backend…")
    resp = requests.get(url, headers=backend_headers(), timeout=60)
    resp.raise_for_status()
    data = resp.json()
    last_date = data.get("last_collection_date")

    if last_date:
        log.info("Última fecha sincronizada: %s — corrida incremental", last_date)
        return last_date

    log.info("Sin datos previos — corrida histórica completa")
    return "2000-01-01"


def transform_record(sap_row: dict) -> dict:
    return {
        "card_code": sap_row.get("CardCode"),
        "card_name": sap_row.get("CardName"),
        "collection_date": sap_row.get("U_CollectionDate"),
        "job_name": sap_row.get("U_JobName") or "",
        "job_type": sap_row.get("U_JobType"),
        "product": sap_row.get("U_Product"),
        "sub": sap_row.get("U_Sub"),
        "fat": sap_row.get("U_Fat"),
        "protein": sap_row.get("U_Protein"),
        "lactose": sap_row.get("U_Lactose"),
        "ts": sap_row.get("U_TS"),
        "fpd": sap_row.get("U_FPD"),
        "casein": sap_row.get("U_Casein"),
        "urea": sap_row.get("U_Urea"),
        "remarks": sap_row.get("U_Remarks"),
    }


def fetch_sap_records(session: requests.Session, base_url: str, from_date: str | None) -> list[dict]:
    records: list[dict] = []

    if from_date:
        filter_expr = f"U_CollectionDate ge '{from_date}'"
        url = (
            f"{base_url}/sml.svc/CALIDAD_COMPOSICION"
            f"?$select={SELECT_CLAUSE}&$filter={filter_expr}"
        )
    else:
        url = f"{base_url}/sml.svc/CALIDAD_COMPOSICION?$select={SELECT_CLAUSE}"

    page = 0
    while url:
        page += 1
        log.info("SAP página %d: %s", page, url[:120])
        resp = session.get(url, timeout=120)
        resp.raise_for_status()
        body = resp.json()

        batch = body.get("value", [])
        records.extend(transform_record(row) for row in batch)
        log.info("  → %d registros (acumulado: %d)", len(batch), len(records))

        next_link = body.get("@odata.nextLink") or body.get("odata.nextLink")
        if next_link:
            if next_link.startswith("http"):
                url = next_link
            else:
                url = urljoin(base_url + "/", next_link.lstrip("/"))
        else:
            url = None

    return records


def push_to_backend(records: list[dict]) -> tuple[int, int]:
    backend_url = env("BACKEND_URL").rstrip("/")
    ingest_url = f"{backend_url}/internal/ingest/calidad-composicion"
    batch_size = int(os.getenv("BATCH_SIZE", "500"))

    total_inserted = 0
    total_updated = 0

    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        log.info("Enviando lote %d–%d de %d al backend…", i + 1, i + len(batch), len(records))

        resp = requests.post(
            ingest_url,
            headers=backend_headers(),
            json=batch,
            timeout=300,
        )
        resp.raise_for_status()
        result = resp.json()
        total_inserted += result.get("inserted", 0)
        total_updated += result.get("updated", 0)

    return total_inserted, total_updated


def main() -> None:
    started = datetime.now()
    log.info("=== Inicio sincronización CALIDAD_COMPOSICION ===")

    session, base_url = sap_session()
    from_date = get_sync_from_date()

    try:
        records = fetch_sap_records(session, base_url, from_date)
        log.info("Total registros obtenidos de SAP: %d", len(records))

        if not records:
            log.info("Nada que sincronizar.")
            return

        inserted, updated = push_to_backend(records)
        elapsed = (datetime.now() - started).total_seconds()
        log.info(
            "=== Sincronización OK — insertados: %d, actualizados: %d, tiempo: %.1fs ===",
            inserted,
            updated,
            elapsed,
        )
    except requests.HTTPError as exc:
        log.error("Error HTTP: %s — %s", exc, exc.response.text if exc.response else "")
        sys.exit(1)
    except Exception as exc:
        log.error("Error: %s", exc)
        sys.exit(1)
    finally:
        try:
            logout_url = f"{base_url}/Logout"
            session.post(logout_url, timeout=30)
        except Exception:
            pass


if __name__ == "__main__":
    main()
