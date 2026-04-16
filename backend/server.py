from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from jose import jwt, JWTError
from passlib.context import CryptContext
import asyncio

ROOT_DIR = Path(__file__).parent
LOCAL_SUPPLIER_PROFILES_PATH = ROOT_DIR / "data" / "supplier_profiles.json"
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480
GOSZAKUP_API_TOKEN = os.environ.get("GOSZAKUP_API_TOKEN")
GOSZAKUP_TIMEOUT_SECONDS = float(os.environ.get("GOSZAKUP_TIMEOUT_SECONDS", "20"))
SEARCH_RESULT_LIMIT = 10

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

GOSZAKUP_API_BASE = "https://ows.goszakup.gov.kz/v3"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
contract_status_cache: Optional[Dict[int, str]] = None

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    full_name: str
    role: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: User

class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    bin: str
    name_ru: str
    name_kz: Optional[str] = None
    roles: List[str] = []
    is_blacklisted: bool = False
    trust_score: int = 0
    risk_level: str = "medium"
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SearchResult(BaseModel):
    companies: List[Company]
    total: int

class Tender(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    number: str
    name_ru: str
    customer: str
    amount: float
    date: str
    status: str
    method: str

class Contract(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    number: str
    name_ru: str
    customer: str
    amount: float
    sign_date: str
    status: str
    execution_percent: int

class Complaint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    number: str
    date: str
    complainant: str
    target: str
    status: str
    decision: str
    description: str

class RegistryRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    registry_type: str
    status: str
    reason: str
    inclusion_date: Optional[str] = None
    exclusion_date: Optional[str] = None
    source: str

class RiskIndicator(BaseModel):
    category: str
    level: str
    description: str
    impact: str

class SupplierProfile(BaseModel):
    company: Company
    summary: Dict[str, Any]
    tenders: List[Tender]
    contracts: List[Contract]
    complaints: List[Complaint]
    registries: List[RegistryRecord]
    risk_indicators: List[RiskIndicator]


def goszakup_enabled() -> bool:
    return bool(GOSZAKUP_API_TOKEN)


def extract_items(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, dict):
        items = payload.get("items")
        if isinstance(items, list):
            return items
        return [payload]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def parse_isoish_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None

    normalized = value.strip().replace("T", " ")
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"

    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        pass

    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue

    return None


def format_date(value: Optional[str]) -> str:
    parsed = parse_isoish_datetime(value)
    if not parsed:
        return value or "-"
    return parsed.date().isoformat()


def coerce_float(value: Any) -> float:
    try:
        if value is None or value == "":
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def build_roles(subject: Dict[str, Any]) -> List[str]:
    roles: List[str] = []

    if subject.get("supplier") == 1 or subject.get("type_supplier") in {1, 2, 3}:
        roles.append("Поставщик")
    if subject.get("customer") == 1:
        roles.append("Заказчик")
    if subject.get("organizer") == 1 or subject.get("is_single_org") == 1:
        roles.append("Организатор")
    if subject.get("mark_small_employer") == 1:
        roles.append("СМП")
    if not roles:
        roles.append("Участник")

    return roles


def compute_trust_score(subject: Dict[str, Any], is_blacklisted: bool, contracts_count: int) -> int:
    if is_blacklisted:
        return 20

    score = 55

    if contracts_count >= 25:
        score += 20
    elif contracts_count >= 5:
        score += 10
    elif contracts_count > 0:
        score += 5

    if subject.get("mark_patronymic_supplyer") == 1:
        score += 10
    if subject.get("mark_patronymic_producer") == 1:
        score += 10
    if subject.get("mark_small_employer") == 1:
        score -= 5

    return max(15, min(95, score))


def compute_risk_level(is_blacklisted: bool, contracts_count: int) -> str:
    if is_blacklisted:
        return "high"
    if contracts_count >= 5:
        return "low"
    if contracts_count > 0:
        return "medium"
    return "medium"


def map_subject_to_company(
    subject: Dict[str, Any],
    is_blacklisted: bool = False,
    contracts_count: int = 0
) -> Company:
    trust_score = compute_trust_score(subject, is_blacklisted, contracts_count)
    risk_level = compute_risk_level(is_blacklisted, contracts_count)

    return Company(
        bin=str(subject.get("bin") or subject.get("iin") or subject.get("supplier_biin") or ""),
        name_ru=subject.get("name_ru") or subject.get("supplier_name_ru") or "Неизвестная компания",
        name_kz=subject.get("name_kz") or subject.get("supplier_name_kz"),
        roles=build_roles(subject),
        is_blacklisted=is_blacklisted,
        trust_score=trust_score,
        risk_level=risk_level,
        last_updated=datetime.now(timezone.utc)
    )


def map_rnu_to_registry(record: Dict[str, Any]) -> RegistryRecord:
    end_date = parse_isoish_datetime(record.get("end_date"))
    is_active = end_date is None or end_date >= datetime.now()

    reason_parts = []
    if record.get("court_decision"):
        reason_parts.append(f"Решение: {record['court_decision']}")
    if record.get("ref_reason_id") is not None:
        reason_parts.append(f"Причина включения #{record['ref_reason_id']}")

    return RegistryRecord(
        registry_type="Реестр недобросовестных поставщиков",
        status="Активен" if is_active else "Истек",
        reason="; ".join(reason_parts) if reason_parts else "Запись в реестре недобросовестных поставщиков",
        inclusion_date=format_date(record.get("start_date")),
        exclusion_date=format_date(record.get("end_date")) if record.get("end_date") else None,
        source="goszakup.gov.kz"
    )


def is_completed_contract_status(status_name: str) -> bool:
    lowered = status_name.lower()
    return any(marker in lowered for marker in ("исполн", "выполн", "заверш", "расторг", "закры"))


def execution_percent_from_status(status_name: str) -> int:
    lowered = status_name.lower()
    if any(marker in lowered for marker in ("исполн", "выполн", "заверш")):
        return 100
    if "расторг" in lowered:
        return 0
    return 50


def map_contract_to_contract(
    contract: Dict[str, Any],
    contract_statuses: Dict[int, str]
) -> Contract:
    status_id = contract.get("ref_contract_status_id")
    status_name = contract_statuses.get(int(status_id), f"Статус #{status_id}") if status_id is not None else "Неизвестно"
    display_name = (
        (contract.get("trd_buy_number_anno") and f"Объявление {contract['trd_buy_number_anno']}")
        or contract.get("contract_number_sys")
        or f"Договор {contract.get('contract_number') or contract.get('id')}"
    )

    return Contract(
        id=str(contract.get("id") or uuid.uuid4()),
        number=str(contract.get("contract_number_sys") or contract.get("contract_number") or contract.get("id") or ""),
        name_ru=display_name,
        customer=str(contract.get("customer_bin") or "Заказчик не указан"),
        amount=coerce_float(contract.get("contract_sum_wnds") or contract.get("contract_sum")),
        sign_date=format_date(contract.get("crdate")),
        status=status_name,
        execution_percent=execution_percent_from_status(status_name)
    )


def map_application_to_tender(application: Dict[str, Any]) -> Tender:
    total_amount = sum(coerce_float(lot.get("amount")) for lot in application.get("app_lots", []) if isinstance(lot, dict))
    buy_id = application.get("buy_id")
    prot_number = application.get("prot_number")

    return Tender(
        id=str(application.get("id") or uuid.uuid4()),
        number=str(prot_number or buy_id or application.get("id") or ""),
        name_ru=f"Закупка #{buy_id}" if buy_id else "Заявка поставщика",
        customer="Не указан в OWS v3",
        amount=total_amount,
        date=format_date(application.get("date_apply")),
        status="Подана заявка" if not prot_number else f"Протокол {prot_number}",
        method="Заявка поставщика"
    )


def build_risk_indicators(
    company: Company,
    contracts: List[Contract],
    registries: List[RegistryRecord]
) -> List[RiskIndicator]:
    indicators: List[RiskIndicator] = []

    if registries:
        indicators.append(
            RiskIndicator(
                category="Комплаенс-риск",
                level="high",
                description="Компания найдена в реестре недобросовестных поставщиков.",
                impact="Высокий"
            )
        )
    else:
        indicators.append(
            RiskIndicator(
                category="Комплаенс-риск",
                level="low",
                description="Записей в реестре недобросовестных поставщиков не найдено.",
                impact="Низкий"
            )
        )

    indicators.append(
        RiskIndicator(
            category="Контрактная история",
            level="low" if len(contracts) >= 5 else "medium",
            description=(
                f"Найдено договоров: {len(contracts)}."
                if contracts
                else "По компании не найдено договоров в доступных сервисах OWS v3."
            ),
            impact="Средний" if contracts else "Низкий"
        )
    )

    indicators.append(
        RiskIndicator(
            category="Итоговая оценка",
            level=company.risk_level,
            description=f"Итоговая оценка построена на основе РНУ и истории договоров. Уровень доверия: {company.trust_score}/100.",
            impact="Высокий" if company.risk_level == "high" else "Средний" if company.risk_level == "medium" else "Низкий"
        )
    )

    return indicators


async def goszakup_get(
    path: str,
    params: Optional[Dict[str, Any]] = None,
    allow_not_found: bool = False
) -> Optional[Any]:
    if not GOSZAKUP_API_TOKEN:
        return None

    headers = {
        "Authorization": f"Bearer {GOSZAKUP_API_TOKEN}",
        "Content-Type": "application/json",
    }
    filtered_params = {key: value for key, value in (params or {}).items() if value not in (None, "")}

    try:
        async with httpx.AsyncClient(timeout=GOSZAKUP_TIMEOUT_SECONDS, follow_redirects=True) as http_client:
            response = await http_client.get(f"{GOSZAKUP_API_BASE}{path}", headers=headers, params=filtered_params)

        if response.status_code == 404 and allow_not_found:
            return None
        if response.status_code in (401, 403):
            raise HTTPException(
                status_code=502,
                detail="Goszakup API отклонил запрос. Проверьте значение GOSZAKUP_API_TOKEN."
            )

        response.raise_for_status()
        return response.json()
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        logger.exception("Goszakup API request failed: %s %s", path, filtered_params)
        raise HTTPException(status_code=502, detail=f"Не удалось получить данные из goszakup.gov.kz: {exc}") from exc


async def get_contract_status_map() -> Dict[int, str]:
    global contract_status_cache

    if contract_status_cache is not None:
        return contract_status_cache

    payload = await goszakup_get("/refs/ref_contract_status")
    contract_status_cache = {}

    for item in extract_items(payload):
        try:
            status_id = int(item["id"])
        except (KeyError, TypeError, ValueError):
            continue
        contract_status_cache[status_id] = item.get("name_ru") or item.get("name_kz") or f"Статус #{status_id}"

    return contract_status_cache


async def search_goszakup_companies(query: str) -> List[Company]:
    query = query.strip()
    if not query:
        return []

    if query.isdigit() and len(query) in {12, 14}:
        subject_payload = await goszakup_get(f"/subject/biin/{query}", allow_not_found=True)
        subject_items = extract_items(subject_payload)
    else:
        subject_payload = await goszakup_get(
            "/subject",
            params={
                "nameOrFullNameRu": f"?{query}",
                "page": 1,
                "limit": SEARCH_RESULT_LIMIT,
            }
        )
        subject_items = extract_items(subject_payload)[:SEARCH_RESULT_LIMIT]

    if not subject_items:
        return []

    rnu_payloads = await asyncio.gather(
        *[
            goszakup_get(f"/rnu/{subject.get('bin') or subject.get('iin')}", allow_not_found=True)
            for subject in subject_items
            if subject.get("bin") or subject.get("iin")
        ]
    )

    rnu_by_bin: Dict[str, List[Dict[str, Any]]] = {}
    for payload in rnu_payloads:
        for item in extract_items(payload):
            supplier_biin = item.get("supplier_biin")
            if supplier_biin:
                rnu_by_bin.setdefault(str(supplier_biin), []).append(item)

    companies: List[Company] = []
    for subject in subject_items:
        bin_value = str(subject.get("bin") or subject.get("iin") or "")
        is_blacklisted = bool(rnu_by_bin.get(bin_value))
        companies.append(map_subject_to_company(subject, is_blacklisted=is_blacklisted))

    return companies


async def build_live_supplier_profile(bin_value: str) -> Optional[SupplierProfile]:
    subject_payload, contracts_payload, rnu_payload, applications_payload, contract_statuses = await asyncio.gather(
        goszakup_get(f"/subject/biin/{bin_value}", allow_not_found=True),
        goszakup_get(f"/contract/supplier/{bin_value}", allow_not_found=True),
        goszakup_get(f"/rnu/{bin_value}", allow_not_found=True),
        goszakup_get("/trd-app", params={"supplier_bin_iin": bin_value}, allow_not_found=True),
        get_contract_status_map(),
    )

    subject_items = extract_items(subject_payload)
    if not subject_items:
        return None

    subject = subject_items[0]
    rnu_items = extract_items(rnu_payload)
    contract_items = extract_items(contracts_payload)
    application_items = extract_items(applications_payload)

    company = map_subject_to_company(
        subject,
        is_blacklisted=bool(rnu_items),
        contracts_count=len(contract_items)
    )

    contracts = [map_contract_to_contract(item, contract_statuses) for item in contract_items[:50]]
    registries = [map_rnu_to_registry(item) for item in rnu_items]
    tenders = [map_application_to_tender(item) for item in application_items[:20]]
    complaints: List[Complaint] = []

    completed_contracts = sum(1 for contract in contracts if is_completed_contract_status(contract.status))
    total_value = sum(contract.amount for contract in contracts)
    regdate = parse_isoish_datetime(subject.get("regdate")) or parse_isoish_datetime(subject.get("crdate"))
    years_active = max(0, datetime.now().year - regdate.year) if regdate else int(subject.get("year") or 0)

    summary = {
        "total_contracts": len(contracts),
        "total_value": total_value,
        "active_contracts": max(0, len(contracts) - completed_contracts),
        "completed_contracts": completed_contracts,
        "complaints_filed": len(complaints),
        "years_active": years_active,
        "average_contract_value": round(total_value / len(contracts)) if contracts else 0,
        "data_source": "goszakup.gov.kz OWS v3"
    }

    risk_indicators = build_risk_indicators(company, contracts, registries)

    return SupplierProfile(
        company=company,
        summary=summary,
        tenders=tenders,
        contracts=contracts,
        complaints=complaints,
        registries=registries,
        risk_indicators=risk_indicators
    )


async def ensure_local_supplier_profiles_seeded():
    await db.supplier_profiles.create_index("company.bin", unique=True)
    await db.supplier_profiles.create_index("company.name_ru")
    await db.supplier_profiles.create_index("company.name_kz")

    existing_count = await db.supplier_profiles.count_documents({})
    if existing_count > 0:
        return

    with LOCAL_SUPPLIER_PROFILES_PATH.open("r", encoding="utf-8") as seed_file:
        profiles = json.load(seed_file)

    prepared_profiles = []
    for profile in profiles:
        prepared_profile = {
            **profile,
            "search_text": " ".join(
                filter(
                    None,
                    [
                        str(profile.get("company", {}).get("bin", "")),
                        profile.get("company", {}).get("name_ru", ""),
                        profile.get("company", {}).get("name_kz", ""),
                    ],
                )
            ).lower(),
        }
        prepared_profiles.append(prepared_profile)

    if prepared_profiles:
        await db.supplier_profiles.insert_many(prepared_profiles)
        logger.info("Seeded %s local supplier profiles", len(prepared_profiles))


async def search_local_companies(query: str) -> List[Company]:
    normalized_query = query.strip()
    if not normalized_query:
        return []

    regex = re.escape(normalized_query)
    search_filter = {
        "$or": [
            {"company.bin": {"$regex": regex}},
            {"company.name_ru": {"$regex": regex, "$options": "i"}},
            {"company.name_kz": {"$regex": regex, "$options": "i"}},
            {"search_text": {"$regex": regex.lower()}},
        ]
    }

    cursor = db.supplier_profiles.find(search_filter, {"_id": 0, "company": 1}).limit(SEARCH_RESULT_LIMIT)
    companies: List[Company] = []
    async for item in cursor:
        company_data = item.get("company")
        if company_data:
            companies.append(Company(**company_data))

    return companies


async def list_local_companies(
    query: Optional[str] = None,
    risk_level: Optional[str] = None,
    is_blacklisted: Optional[bool] = None,
    limit: int = 100
) -> List[Company]:
    filters: List[Dict[str, Any]] = []

    if query:
        normalized_query = query.strip()
        if normalized_query:
            regex = re.escape(normalized_query)
            filters.append(
                {
                    "$or": [
                        {"company.bin": {"$regex": regex}},
                        {"company.name_ru": {"$regex": regex, "$options": "i"}},
                        {"company.name_kz": {"$regex": regex, "$options": "i"}},
                        {"search_text": {"$regex": regex.lower()}},
                    ]
                }
            )

    if risk_level:
        filters.append({"company.risk_level": risk_level})

    if is_blacklisted is not None:
        filters.append({"company.is_blacklisted": is_blacklisted})

    mongo_filter: Dict[str, Any] = {"$and": filters} if filters else {}

    cursor = (
        db.supplier_profiles
        .find(mongo_filter, {"_id": 0, "company": 1})
        .sort("company.name_ru", 1)
        .limit(limit)
    )

    companies: List[Company] = []
    async for item in cursor:
        company_data = item.get("company")
        if company_data:
            companies.append(Company(**company_data))

    return companies


async def get_local_supplier_profile(bin_value: str) -> Optional[SupplierProfile]:
    profile = await db.supplier_profiles.find_one({"company.bin": str(bin_value)}, {"_id": 0, "search_text": 0})
    if not profile:
        return None
    return SupplierProfile(**profile)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
        user = await db.users.find_one({"email": email}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user_data = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    if not user_data:
        if request.password == "demo123":
            role_map = {
                "admin@procurecheck.kz": "admin",
                "analyst@procurecheck.kz": "analyst",
                "viewer@procurecheck.kz": "viewer"
            }
            
            user_dict = {
                "id": str(uuid.uuid4()),
                "email": request.email,
                "full_name": request.email.split('@')[0].title(),
                "role": role_map.get(request.email, "analyst"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user_dict)
            user = User(**user_dict)
        else:
            raise HTTPException(status_code=401, detail="Неверные учетные данные")
    else:
        user = User(**user_data)
    
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )

@api_router.get("/")
async def api_root():
    return {"status": "ok", "message": "ProcureCheck KZ API"}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.get("/companies", response_model=SearchResult)
async def list_companies(
    query: Optional[str] = None,
    risk_level: Optional[str] = None,
    is_blacklisted: Optional[bool] = None,
    current_user: User = Depends(get_current_user)
):
    companies = await list_local_companies(
        query=query,
        risk_level=risk_level,
        is_blacklisted=is_blacklisted,
        limit=200
    )
    return SearchResult(companies=companies, total=len(companies))

@api_router.get("/companies/search")
async def search_companies(
    query: str = Query(..., min_length=2),
    type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if goszakup_enabled():
        live_companies = await search_goszakup_companies(query)
        return SearchResult(companies=live_companies, total=len(live_companies))
    local_companies = await search_local_companies(query)
    return SearchResult(companies=local_companies, total=len(local_companies))

@api_router.get("/companies/{bin}/profile", response_model=SupplierProfile)
async def get_supplier_profile(
    bin: str,
    current_user: User = Depends(get_current_user)
):
    if goszakup_enabled():
        live_profile = await build_live_supplier_profile(bin)
        if live_profile is None:
            raise HTTPException(status_code=404, detail="Поставщик не найден в goszakup.gov.kz")
        return live_profile
    local_profile = await get_local_supplier_profile(bin)
    if local_profile is None:
        raise HTTPException(status_code=404, detail="Поставщик не найден в локальной базе профилей")
    return local_profile

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_seed_local_data():
    await ensure_local_supplier_profiles_seeded()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
