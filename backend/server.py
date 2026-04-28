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
DEMO_USERS = {
    "admin@procurecheck.kz": {"full_name": "Admin", "role": "admin"},
    "user@procurecheck.kz": {"full_name": "Пользователь", "role": "user"},
}
VALID_APP_ROLES = {"admin", "user"}

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
    pid: Optional[int] = None
    bin: str
    name_ru: str
    name_kz: Optional[str] = None
    full_name_ru: Optional[str] = None
    full_name_kz: Optional[str] = None
    type_supplier: Optional[int] = None
    customer: int = 0
    organizer: int = 0
    supplier: int = 1
    roles: List[str] = []
    is_blacklisted: bool = False
    trust_score: int = 0
    risk_level: str = "medium"
    regdate: Optional[str] = None
    crdate: Optional[str] = None
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SearchResult(BaseModel):
    companies: List[Company]
    total: int


class DashboardStats(BaseModel):
    total_companies: int
    total_announcements: int
    blacklisted_companies: int
    total_contract_value: float
    average_trust_score: int


class ContractRegistryItem(BaseModel):
    id: int
    contract_number: str
    contract_number_sys: str
    contract_date: Optional[str] = None
    supplier_name: str
    supplier_biin: str
    customer_name: str
    customer_bin: str
    amount: float
    status: str
    status_bucket: str
    procurement_method: str
    tender_number: Optional[str] = None
    tender_id: Optional[int] = None


class ContractRegistryResponse(BaseModel):
    items: List[ContractRegistryItem]
    total: int
    page: int
    page_size: int


class ContractTimelineEvent(BaseModel):
    date: Optional[str] = None
    title: str
    description: str
    event_type: str


class ContractPartyInfo(BaseModel):
    name: str
    bin: Optional[str] = None
    region: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None


class ContractDetail(BaseModel):
    item: ContractRegistryItem
    contract: "ContractRecord"
    tender: Optional["TrdBuyRecord"] = None
    units: List["ContractUnitRecord"]
    acts: List["ActRecord"]
    history: List[ContractTimelineEvent]
    execution_status: Dict[str, Any]
    supplier_party: Optional[ContractPartyInfo] = None
    customer_party: Optional[ContractPartyInfo] = None


class ComplaintRegistryItem(BaseModel):
    id: str
    complaint_number: str
    date_submitted: Optional[str] = None
    applicant_name: str
    applicant_identifier: Optional[str] = None
    supplier_name: Optional[str] = None
    customer_name: Optional[str] = None
    object_type: str
    object_name: str
    status: str
    short_description: str
    full_text: Optional[str] = None
    tender_number: Optional[str] = None
    related_tender_id: Optional[int] = None
    related_contract_id: Optional[int] = None
    decision: Optional[str] = None
    supplier_biin: Optional[str] = None


class ComplaintRegistryResponse(BaseModel):
    items: List[ComplaintRegistryItem]
    total: int
    page: int
    page_size: int


class ComplaintDetail(BaseModel):
    item: ComplaintRegistryItem


class AnnouncementLotItem(BaseModel):
    lot_number: str
    lot_id: int
    name_ru: str
    quantity: float
    amount: float
    status: str
    contract_number: Optional[str] = None
    winner_name: Optional[str] = None


class AnnouncementBidItem(BaseModel):
    application_id: str
    bid_number: str
    buy_id: int
    supplier_name: str
    supplier_bin: str
    offered_amount: float
    date_apply: Optional[str] = None
    status: str
    place: Optional[int] = None
    result: Optional[str] = None


class AnnouncementDetail(BaseModel):
    announcement: TrdBuyRecord
    lots: List[AnnouncementLotItem]
    bids: List[AnnouncementBidItem]


class BidDetail(BaseModel):
    bid: AnnouncementBidItem
    announcement: Optional[TrdBuyRecord] = None
    supplier: Optional[Company] = None
    lots: List[AnnouncementLotItem]


class LotDetail(BaseModel):
    lot: AnnouncementLotItem
    announcement: Optional[TrdBuyRecord] = None
    bids: List[AnnouncementBidItem]


class SubjectRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    pid: int
    bin: str
    iin: Optional[str] = None
    inn: Optional[str] = None
    unp: Optional[str] = None
    parent_subject: Optional[str] = None
    parent_name_kz: Optional[str] = None
    parent_name_ru: Optional[str] = None
    regdate: Optional[str] = None
    crdate: Optional[str] = None
    index_date: Optional[str] = None
    number_reg: Optional[str] = None
    series: Optional[str] = None
    name_ru: str
    name_kz: Optional[str] = None
    full_name_ru: Optional[str] = None
    full_name_kz: Optional[str] = None
    country_code: Optional[int] = 398
    customer: int = 0
    organizer: int = 0
    mark_national_company: int = 0
    ref_kopf_code: Optional[str] = None
    mark_assoc_with_disab: int = 0
    system_id: int = 3
    supplier: int = 1
    type_supplier: int = 1
    krp_code: Optional[str] = None
    oked_list: List[str] = []
    kse_code: Optional[str] = None
    mark_resident: int = 1


class SubjectAddress(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    pid: int
    ref_source_code: int
    address_type: int
    address: str
    kato_code: Optional[str] = None
    phone: Optional[str] = None
    country_code: Optional[int] = 398
    date_create: Optional[str] = None
    edit_date: Optional[str] = None
    index_date: Optional[str] = None


class SubjectEmployee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    pid: int
    iin: Optional[str] = None
    resident: int = 1
    fio: str
    disabled: int = 0
    role: int = 0
    sys_role_id: int = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    edit_date: Optional[str] = None
    index_date: Optional[str] = None


class RnuEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    pid: int
    supplier_biin: str
    supplier_innunp: Optional[str] = None
    supplier_name_ru: str
    supplier_name_kz: Optional[str] = None
    kato_list: List[str] = []
    index_date: Optional[str] = None
    customer_name_ru: Optional[str] = None
    customer_name_kz: Optional[str] = None
    customer_biin: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    ref_reason_id: Optional[int] = None
    court_decision: Optional[str] = None


class TrdBuyRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    number_anno: str
    name_ru: str
    name_kz: Optional[str] = None
    total_sum: float
    count_lots: int
    ref_trade_methods_id: int
    ref_subject_type_id: int
    customer_bin: str
    customer_pid: int
    customer_name_ru: str
    customer_name_kz: Optional[str] = None
    org_bin: str
    org_pid: int
    org_name_ru: str
    org_name_kz: Optional[str] = None
    publish_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    ref_buy_status_id: int
    system_id: int = 3
    index_date: Optional[str] = None


class TrdAppLot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    lot_id: int
    lot_number: str
    name_ru: str
    quantity: float
    price: float
    price_offer: float
    amount: float
    ref_lot_status_id: int


class TrdAppRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    buy_id: int
    supplier_id: int
    cr_fio: Optional[str] = None
    mod_fio: Optional[str] = None
    supplier_bin_iin: str
    prot_id: Optional[int] = None
    prot_number: Optional[str] = None
    date_apply: Optional[str] = None
    app_lots: List[TrdAppLot] = []


class ContractRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    parent_id: Optional[int] = None
    root_id: int
    trd_buy_id: int
    trd_buy_number_anno: str
    ref_amendm_agreem_justif_id: Optional[int] = None
    ref_contract_status_id: int
    deleted: int = 0
    crdate: Optional[str] = None
    last_update_date: Optional[str] = None
    supplier_id: int
    supplier_biin: str
    supplier_bik: Optional[str] = None
    supplier_iik: Optional[str] = None
    supplier_bank_name_kz: Optional[str] = None
    supplier_bank_name_ru: Optional[str] = None
    contract_number: str
    sign_reason_doc_name: Optional[str] = None
    sign_reason_doc_date: Optional[str] = None
    trd_buy_itogi_date_public: Optional[str] = None
    customer_id: int
    customer_bin: str
    customer_bik: Optional[str] = None
    customer_iik: Optional[str] = None
    customer_bank_name_kz: Optional[str] = None
    customer_bank_name_ru: Optional[str] = None
    customer_name_ru: Optional[str] = None
    customer_name_kz: Optional[str] = None
    contract_number_sys: str
    fin_year: int
    ref_contract_agr_form_id: Optional[int] = None
    ref_contract_year_type_id: Optional[int] = None
    ref_contract_type_id: Optional[int] = None
    contract_sum: float = 0
    contract_sum_wnds: float = 0
    system_id: int = 3
    index_date: Optional[str] = None


class ContractUnitRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    contract_id: int
    lot_id: int
    pln_point_id: int
    item_price: float
    item_price_wnds: float
    quantity: float
    total_sum: float
    total_sum_wnds: float
    fact_sum: float
    fact_sum_wnds: float
    ks_proc: float
    name_ru: Optional[str] = None


class ActRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    akt_date: Optional[str] = None
    number_act: str
    approve_date: Optional[str] = None
    create_date_act: Optional[str] = None
    contract_root_id: int
    contract_id: int
    status_id: int
    is_deleted: int = 0
    day_overdue: Optional[int] = None
    sum_avans: Optional[float] = None
    sum_beginning: Optional[float] = None
    sum_fine: Optional[float] = None
    sum_previously: Optional[float] = None
    sum_transfer: Optional[float] = None
    create_date_gen_info: Optional[str] = None
    status_name_ru: Optional[str] = None
    status_name_kz: Optional[str] = None
    supplier_id: int
    customer_id: int
    is_gu: int = 0
    type_act: int = 1
    ref_subject_type_id: int = 3
    parent_id: Optional[int] = None
    system_id: int = 3
    index_date: Optional[str] = None


class ComplaintRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    complaint_number: str
    date: Optional[str] = None
    applicant_name: str
    applicant_bin: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_bin: Optional[str] = None
    supplier_name: Optional[str] = None
    customer_name: Optional[str] = None
    related_tender_id: Optional[int] = None
    related_contract_id: Optional[int] = None
    subject: str
    description: str
    status: str
    decision: Optional[str] = None


class RiskIndicator(BaseModel):
    category: str
    level: str
    description: str
    impact: str


class SupplierProfile(BaseModel):
    company: Company
    summary: Dict[str, Any]
    subject: SubjectRecord
    subject_addresses: List[SubjectAddress]
    subject_employees: List[SubjectEmployee]
    trd_buys: List[TrdBuyRecord]
    trd_apps: List[TrdAppRecord]
    contracts: List[ContractRecord]
    contract_units: List[ContractUnitRecord]
    acts: List[ActRecord]
    complaints: List[ComplaintRecord]
    rnu_entries: List[RnuEntry]
    risk_indicators: List[RiskIndicator]


ContractDetail.model_rebuild()


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


LOCAL_CONTRACT_STATUS_LABELS = {
    320: "На исполнении",
    350: "Исполнен",
    390: "Расторгнут",
}

LOCAL_BUY_STATUS_LABELS = {
    310: "Опубликовано",
    320: "Прием заявок",
    340: "Итоги подведены",
}

LOCAL_TRADE_METHOD_LABELS = {
    1: "Открытый конкурс",
    2: "Из одного источника",
    7: "Аукцион",
    31: "Запрос ценовых предложений",
}

TYPE_SUPPLIER_LABELS = {
    1: "Юридическое лицо",
    2: "Физическое лицо",
    3: "ИП",
}

ADDRESS_TYPE_LABELS = {
    1: "Юридический адрес",
    2: "Фактический адрес",
    3: "Почтовый адрес",
}

EMPLOYEE_ROLE_LABELS = {
    1: "Руководитель",
    2: "Сотрудник",
}


def normalize_subject_payload(subject_data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "pid": subject_data.get("pid"),
        "bin": str(subject_data.get("bin") or subject_data.get("iin") or subject_data.get("supplier_biin") or ""),
        "name_ru": subject_data.get("name_ru") or subject_data.get("supplier_name_ru") or "Неизвестная компания",
        "name_kz": subject_data.get("name_kz") or subject_data.get("supplier_name_kz"),
        "full_name_ru": subject_data.get("full_name_ru") or subject_data.get("name_ru") or subject_data.get("supplier_name_ru"),
        "full_name_kz": subject_data.get("full_name_kz") or subject_data.get("name_kz") or subject_data.get("supplier_name_kz"),
        "type_supplier": subject_data.get("type_supplier"),
        "customer": int(subject_data.get("customer") or 0),
        "organizer": int(subject_data.get("organizer") or 0),
        "supplier": int(subject_data.get("supplier") or 1),
        "roles": build_roles(subject_data),
        "regdate": format_date(subject_data.get("regdate")) if subject_data.get("regdate") else None,
        "crdate": format_date(subject_data.get("crdate")) if subject_data.get("crdate") else None,
        "last_updated": parse_isoish_datetime(subject_data.get("index_date")) or datetime.now(timezone.utc),
    }


def get_contract_status_name(contract: ContractRecord) -> str:
    return LOCAL_CONTRACT_STATUS_LABELS.get(contract.ref_contract_status_id, f"Статус #{contract.ref_contract_status_id}")


def get_buy_status_name(trd_buy: TrdBuyRecord) -> str:
    return LOCAL_BUY_STATUS_LABELS.get(trd_buy.ref_buy_status_id, f"Статус #{trd_buy.ref_buy_status_id}")


def get_trade_method_name(method_id: int) -> str:
    return LOCAL_TRADE_METHOD_LABELS.get(method_id, f"Способ #{method_id}")


def get_contract_status_bucket(contract: ContractRecord) -> str:
    if is_terminated_contract(contract):
        return "terminated"
    if is_completed_contract(contract):
        return "completed"
    return "in_progress"


def map_contract_bucket_to_label(bucket: str) -> str:
    return {
        "completed": "Исполнен",
        "in_progress": "В процессе",
        "terminated": "Расторгнут",
    }.get(bucket, "Неизвестно")


def get_lot_status_label(status_id: int) -> str:
    return {
        310: "Прием заявок",
        320: "Итоги подведены",
    }.get(int(status_id or 0), f"Статус #{status_id or '-'}")


def is_active_rnu_entry(entry: RnuEntry) -> bool:
    end_date = parse_isoish_datetime(entry.end_date)
    return end_date is None or end_date >= datetime.now()


def is_terminated_contract(contract: ContractRecord) -> bool:
    return "расторг" in get_contract_status_name(contract).lower()


def is_completed_contract(contract: ContractRecord) -> bool:
    return any(marker in get_contract_status_name(contract).lower() for marker in ("исполн", "выполн", "заверш"))


def is_overdue_act(act: ActRecord) -> bool:
    return (act.day_overdue or 0) > 0 or (act.sum_fine or 0) > 0


def complaint_status_bucket(complaint: ComplaintRecord) -> str:
    normalized = complaint.status.lower()
    if "удовлетвор" in normalized:
        return "satisfied"
    if "отклон" in normalized or "отказ" in normalized:
        return "rejected"
    return "pending"


def is_contract_related_complaint(complaint: ComplaintRecord) -> bool:
    haystack = " ".join(
        [
            complaint.subject or "",
            complaint.description or "",
            complaint.decision or "",
        ]
    ).lower()
    return bool(complaint.related_contract_id) or any(marker in haystack for marker in ("договор", "исполн", "акт", "поставка", "срок"))


def compute_company_assessment(
    subject_data: Dict[str, Any],
    applications: List[TrdAppRecord],
    contracts: List[ContractRecord],
    acts: List[ActRecord],
    rnu_entries: List[RnuEntry],
    complaints: Optional[List[ComplaintRecord]] = None,
) -> Dict[str, Any]:
    complaints = complaints or []
    active_rnu_entries = [entry for entry in rnu_entries if is_active_rnu_entry(entry)]
    terminated_contracts = [contract for contract in contracts if is_terminated_contract(contract)]
    completed_contracts = [contract for contract in contracts if is_completed_contract(contract)]
    overdue_acts = [act for act in acts if is_overdue_act(act)]
    satisfied_complaints = [complaint for complaint in complaints if complaint_status_bucket(complaint) == "satisfied"]
    pending_complaints = [complaint for complaint in complaints if complaint_status_bucket(complaint) == "pending"]
    contract_related_complaints = [complaint for complaint in complaints if is_contract_related_complaint(complaint)]

    total_announcements = max(len(applications), len({application.buy_id for application in applications if application.buy_id}))
    total_contracts = len(contracts)
    applications_count = len(applications)
    completed_contracts_count = len(completed_contracts)
    terminated_contracts_count = len(terminated_contracts)
    active_rnu_count = len(active_rnu_entries)
    overdue_acts_count = len(overdue_acts)
    total_complaints = len(complaints)
    satisfied_complaints_count = len(satisfied_complaints)
    pending_complaints_count = len(pending_complaints)
    contract_related_complaints_count = len(contract_related_complaints)

    total_contract_value = sum(contract.contract_sum_wnds or contract.contract_sum for contract in contracts)
    total_overdue_days = sum(max(0, int(act.day_overdue or 0)) for act in overdue_acts)
    total_fine_sum = sum(float(act.sum_fine or 0) for act in overdue_acts)
    years_active = max(
        0,
        datetime.now().year - (parse_isoish_datetime(subject_data.get("regdate")) or parse_isoish_datetime(subject_data.get("crdate")) or datetime.now()).year,
    )
    completion_rate = (completed_contracts_count / total_contracts) if total_contracts else 0.0
    application_coverage = (applications_count / total_announcements) if total_announcements else 0.0

    positive_points = 0.0
    positive_points += min(18.0, completion_rate * 18.0)
    positive_points += min(12.0, total_contract_value / 1_500_000.0)
    positive_points += min(8.0, years_active * 0.7)
    positive_points += min(4.0, applications_count * 1.1)
    positive_points += min(3.0, max(0.0, application_coverage - 1.0) * 6.0)
    positive_points += min(2.0, len(subject_data.get("oked_list") or []))

    if int(subject_data.get("mark_national_company") or 0) == 1:
        positive_points += 3.0
    if int(subject_data.get("mark_assoc_with_disab") or 0) == 1:
        positive_points += 2.0

    negative_points = 0.0
    negative_points += active_rnu_count * 42.0
    negative_points += min(24.0, terminated_contracts_count * 16.0)
    negative_points += min(16.0, overdue_acts_count * 6.0)
    negative_points += min(10.0, total_overdue_days / 3.0)
    negative_points += min(8.0, total_fine_sum / 50_000.0)
    negative_points += min(18.0, satisfied_complaints_count * 9.0)
    negative_points += min(8.0, pending_complaints_count * 2.5)
    negative_points += min(10.0, contract_related_complaints_count * 5.0)

    if total_contracts == 0:
        negative_points += 10.0
    if applications_count == 0:
        negative_points += 6.0

    trust_score = round(max(5.0, min(95.0, 58.0 + positive_points - negative_points)))

    if (
        active_rnu_count > 0
        or terminated_contracts_count >= 2
        or overdue_acts_count >= 2
        or satisfied_complaints_count >= 2
        or trust_score < 45
    ):
        risk_level = "high"
    elif (
        terminated_contracts_count == 1
        or overdue_acts_count == 1
        or satisfied_complaints_count == 1
        or pending_complaints_count > 0
        or trust_score < 75
    ):
        risk_level = "medium"
    else:
        risk_level = "low"

    risk_indicators: List[RiskIndicator] = []
    risk_factors: List[str] = []

    if active_rnu_count > 0:
        risk_indicators.append(
            RiskIndicator(
                category="РНУ",
                level="high",
                description=f"В локальной OWS-модели найдено активных записей в РНУ: {active_rnu_count}.",
                impact="Высокий",
            )
        )
        risk_factors.append(f"Активных записей в РНУ: {active_rnu_count}.")

    if terminated_contracts_count > 0:
        risk_indicators.append(
            RiskIndicator(
                category="Договоры",
                level="high" if terminated_contracts_count >= 2 else "medium",
                description=f"Расторгнутых договоров: {terminated_contracts_count}.",
                impact="Высокий" if terminated_contracts_count >= 2 else "Средний",
            )
        )
        risk_factors.append(f"Расторгнутых договоров: {terminated_contracts_count}.")

    if overdue_acts_count > 0:
        risk_indicators.append(
            RiskIndicator(
                category="Электронные акты",
                level="high" if overdue_acts_count >= 2 else "medium",
                description=(
                    f"Актов с просрочкой или штрафами: {overdue_acts_count}. "
                    f"Суммарная просрочка: {total_overdue_days} дн., штрафы: {round(total_fine_sum, 2)}."
                ),
                impact="Высокий" if overdue_acts_count >= 2 else "Средний",
            )
        )
        risk_factors.append(
            f"Актов с просрочкой или штрафами: {overdue_acts_count}, суммарная просрочка: {total_overdue_days} дн., штрафы: {round(total_fine_sum, 2)} ₸."
        )

    if satisfied_complaints_count > 0:
        risk_indicators.append(
            RiskIndicator(
                category="Жалобы",
                level="high" if satisfied_complaints_count >= 2 else "medium",
                description=(
                    f"Подтвержденных жалоб по участнику: {satisfied_complaints_count}. "
                    f"Из них связанных с исполнением договора: {contract_related_complaints_count}."
                ),
                impact="Высокий" if satisfied_complaints_count >= 2 or contract_related_complaints_count > 0 else "Средний",
            )
        )
        risk_factors.append(f"Есть удовлетворённые жалобы по участнику: {satisfied_complaints_count}.")
        if contract_related_complaints_count > 0:
            risk_factors.append(f"Есть жалоба, связанная с исполнением договора: {contract_related_complaints_count}.")
    elif total_complaints > 0:
        risk_indicators.append(
            RiskIndicator(
                category="Жалобы",
                level="low",
                description=(
                    f"Жалоб в профиле: {total_complaints}. Подтвержденных нарушений не найдено, "
                    f"отклоненные или неподтвержденные обращения не усиливают риск."
                ),
                impact="Низкий",
            )
        )
        risk_factors.append("Жалобы отсутствуют или не подтверждены как нарушение.")
    else:
        risk_indicators.append(
            RiskIndicator(
                category="Жалобы",
                level="low",
                description="Жалобы по участнику в локальной базе не найдены.",
                impact="Низкий",
            )
        )
        risk_factors.append("Жалобы отсутствуют или не подтверждены.")

    history_level = "low"
    history_impact = "Низкий"
    if total_contracts == 0:
        history_level = "medium"
        history_impact = "Средний"
        history_description = "Подтвержденной истории договоров в локальной модели нет."
        risk_factors.append("Подтвержденной истории договоров нет.")
    else:
        history_description = (
            f"Исполнено договоров: {completed_contracts_count} из {total_contracts}. "
            f"Доля исполнения: {round(completion_rate * 100)}%."
        )
        if completed_contracts_count < max(1, total_contracts // 2):
            history_level = "medium"
            history_impact = "Средний"
        risk_factors.append(history_description)

    if total_contracts > 0:
        risk_factors.append(
            f"Общая сумма договоров: {round(total_contract_value, 2)} ₸, лет активности участника: {years_active}."
        )

    risk_indicators.append(
        RiskIndicator(
            category="История исполнения",
            level=history_level,
            description=history_description,
            impact=history_impact,
        )
    )
    risk_indicators.append(
        RiskIndicator(
            category="Итоговая оценка доверия",
            level=risk_level,
            description=(
                "Уровень доверия рассчитан по РНУ, статусам договоров, электронным актам и общей истории участия. "
                f"Текущее значение: {trust_score}/100."
            ),
            impact="Высокий" if risk_level == "high" else "Средний" if risk_level == "medium" else "Низкий",
        )
    )

    if not risk_factors:
        risk_factors.append("Существенных негативных факторов по OWS-подобным данным не найдено.")

    if risk_level == "high":
        headline = "Оценка риска высокая: в истории участника есть критичные сигналы."
    elif risk_level == "medium":
        headline = "Оценка риска средняя: по данным OWS-модели требуется дополнительная проверка."
    else:
        headline = "Оценка риска низкая: существенных негативных факторов не найдено."

    company = Company(
        **normalize_subject_payload(subject_data),
        is_blacklisted=active_rnu_count > 0,
        trust_score=trust_score,
        risk_level=risk_level,
    )

    return {
        "company": company,
        "risk_indicators": risk_indicators,
        "risk_assessment": {
            "headline": headline,
            "factors": risk_factors,
            "terminated_contracts": terminated_contracts_count,
            "active_rnu_entries": active_rnu_count,
            "overdue_acts": overdue_acts_count,
            "overdue_days": total_overdue_days,
            "fine_sum": round(total_fine_sum, 2),
            "total_complaints": total_complaints,
            "satisfied_complaints": satisfied_complaints_count,
            "pending_complaints": pending_complaints_count,
            "contract_related_complaints": contract_related_complaints_count,
            "applications": applications_count,
            "total_announcements": total_announcements,
            "completed_contracts": completed_contracts_count,
            "total_contracts": total_contracts,
            "completion_rate": round(completion_rate * 100),
            "contract_value": round(total_contract_value, 2),
            "years_active": years_active,
            "positive_points": round(positive_points, 2),
            "negative_points": round(negative_points, 2),
        },
    }


def map_subject_to_company(subject: Dict[str, Any], is_blacklisted: bool = False) -> Company:
    return Company(
        **normalize_subject_payload(subject),
        is_blacklisted=is_blacklisted,
        trust_score=0,
        risk_level="medium",
    )


def map_rnu_to_entry(record: Dict[str, Any]) -> RnuEntry:
    return RnuEntry(
        id=str(record.get("id") or uuid.uuid4()),
        pid=int(record.get("pid") or 0),
        supplier_biin=str(record.get("supplier_biin") or ""),
        supplier_innunp=record.get("supplier_innunp"),
        supplier_name_ru=record.get("supplier_name_ru") or "Неизвестный поставщик",
        supplier_name_kz=record.get("supplier_name_kz"),
        kato_list=[str(value) for value in record.get("kato_list", []) if value is not None],
        index_date=record.get("index_date"),
        customer_name_ru=record.get("customer_name_ru"),
        customer_name_kz=record.get("customer_name_kz"),
        customer_biin=record.get("customer_biin"),
        start_date=record.get("start_date"),
        end_date=record.get("end_date"),
        ref_reason_id=record.get("ref_reason_id"),
        court_decision=record.get("court_decision"),
    )


def map_contract_to_record(contract: Dict[str, Any], contract_statuses: Dict[int, str]) -> ContractRecord:
    return ContractRecord(
        id=int(contract.get("id") or 0),
        parent_id=contract.get("parent_id"),
        root_id=int(contract.get("root_id") or contract.get("id") or 0),
        trd_buy_id=int(contract.get("trd_buy_id") or 0),
        trd_buy_number_anno=str(contract.get("trd_buy_number_anno") or ""),
        ref_amendm_agreem_justif_id=contract.get("ref_amendm_agreem_justif_id"),
        ref_contract_status_id=int(contract.get("ref_contract_status_id") or 0),
        deleted=int(contract.get("deleted") or 0),
        crdate=contract.get("crdate"),
        last_update_date=contract.get("last_update_date"),
        supplier_id=int(contract.get("supplier_id") or 0),
        supplier_biin=str(contract.get("supplier_biin") or ""),
        supplier_bik=contract.get("supplier_bik"),
        supplier_iik=contract.get("supplier_iik"),
        supplier_bank_name_kz=contract.get("supplier_bank_name_kz"),
        supplier_bank_name_ru=contract.get("supplier_bank_name_ru"),
        contract_number=str(contract.get("contract_number") or contract.get("contract_number_sys") or ""),
        sign_reason_doc_name=contract.get("sign_reason_doc_name"),
        sign_reason_doc_date=contract.get("sign_reason_doc_date"),
        trd_buy_itogi_date_public=contract.get("trd_buy_itogi_date_public"),
        customer_id=int(contract.get("customer_id") or 0),
        customer_bin=str(contract.get("customer_bin") or ""),
        customer_bik=contract.get("customer_bik"),
        customer_iik=contract.get("customer_iik"),
        customer_bank_name_kz=contract.get("customer_bank_name_kz"),
        customer_bank_name_ru=contract.get("customer_bank_name_ru"),
        customer_name_ru=contract.get("customer_name_ru"),
        customer_name_kz=contract.get("customer_name_kz"),
        contract_number_sys=str(contract.get("contract_number_sys") or contract.get("contract_number") or ""),
        fin_year=int(contract.get("fin_year") or datetime.now().year),
        ref_contract_agr_form_id=contract.get("ref_contract_agr_form_id"),
        ref_contract_year_type_id=contract.get("ref_contract_year_type_id"),
        ref_contract_type_id=contract.get("ref_contract_type_id"),
        contract_sum=coerce_float(contract.get("contract_sum")),
        contract_sum_wnds=coerce_float(contract.get("contract_sum_wnds") or contract.get("contract_sum")),
        system_id=int(contract.get("system_id") or 3),
        index_date=contract.get("index_date"),
    )


def map_application_to_record(application: Dict[str, Any]) -> TrdAppRecord:
    lots = [
        TrdAppLot(
            id=str(lot.get("id") or lot.get("lot_id") or uuid.uuid4()),
            lot_id=int(lot.get("lot_id") or 0),
            lot_number=str(lot.get("lot_number") or lot.get("lot_id") or ""),
            name_ru=lot.get("name_ru") or "Лот",
            quantity=coerce_float(lot.get("quantity") or 1),
            price=coerce_float(lot.get("price")),
            price_offer=coerce_float(lot.get("price_offer") or lot.get("price")),
            amount=coerce_float(lot.get("amount")),
            ref_lot_status_id=int(lot.get("ref_lot_status_id") or 0),
        )
        for lot in application.get("app_lots", [])
        if isinstance(lot, dict)
    ]

    return TrdAppRecord(
        id=str(application.get("id") or uuid.uuid4()),
        buy_id=int(application.get("buy_id") or 0),
        supplier_id=int(application.get("supplier_id") or 0),
        cr_fio=application.get("cr_fio"),
        mod_fio=application.get("mod_fio"),
        supplier_bin_iin=str(application.get("supplier_bin_iin") or ""),
        prot_id=application.get("prot_id"),
        prot_number=application.get("prot_number"),
        date_apply=application.get("date_apply"),
        app_lots=lots,
    )


def map_complaint_to_record(raw: Dict[str, Any]) -> ComplaintRecord:
    return ComplaintRecord(
        id=str(raw.get("id") or uuid.uuid4()),
        complaint_number=str(raw.get("complaint_number") or raw.get("number") or raw.get("id") or ""),
        date=raw.get("date") or raw.get("date_submitted") or raw.get("created_at") or raw.get("crdate"),
        applicant_name=raw.get("applicant_name") or raw.get("supplier_name") or raw.get("supplier_name_ru") or "Не указан",
        applicant_bin=raw.get("applicant_bin") or raw.get("applicant_identifier") or raw.get("supplier_bin") or raw.get("supplier_biin"),
        supplier_id=raw.get("supplier_id"),
        supplier_bin=raw.get("supplier_bin") or raw.get("supplier_biin"),
        supplier_name=raw.get("supplier_name") or raw.get("supplier_name_ru"),
        customer_name=raw.get("customer_name") or raw.get("customer_name_ru"),
        related_tender_id=raw.get("related_tender_id") or raw.get("tender_id") or raw.get("trd_buy_id"),
        related_contract_id=raw.get("related_contract_id") or raw.get("contract_id"),
        subject=raw.get("subject") or raw.get("short_description") or "Жалоба",
        description=raw.get("description") or raw.get("full_text") or raw.get("subject") or "Описание не указано",
        status=raw.get("status") or "Статус не указан",
        decision=raw.get("decision"),
    )


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
        rnu_entries = [map_rnu_to_entry(item) for item in rnu_by_bin.get(bin_value, [])]
        assessment = compute_company_assessment(subject, [], [], [], rnu_entries, [])
        companies.append(assessment["company"])

    return companies


async def build_live_supplier_profile(bin_value: str) -> Optional[SupplierProfile]:
    (
        subject_payload,
        addresses_payload,
        employees_payload,
        contracts_payload,
        rnu_payload,
        applications_payload,
        contract_statuses,
    ) = await asyncio.gather(
        goszakup_get(f"/subject/biin/{bin_value}", allow_not_found=True),
        goszakup_get(f"/subject/biin/{bin_value}/address", allow_not_found=True),
        goszakup_get(f"/subject/biin/{bin_value}/employees", allow_not_found=True),
        goszakup_get(f"/contract/supplier/{bin_value}", allow_not_found=True),
        goszakup_get(f"/rnu/{bin_value}", allow_not_found=True),
        goszakup_get("/trd-app", params={"supplier_bin_iin": bin_value}, allow_not_found=True),
        get_contract_status_map(),
    )

    subject_items = extract_items(subject_payload)
    if not subject_items:
        return None

    subject = subject_items[0]
    subject_record = SubjectRecord(**subject)
    subject_addresses = [SubjectAddress(**item) for item in extract_items(addresses_payload)]
    subject_employees = [SubjectEmployee(**item) for item in extract_items(employees_payload)]
    rnu_entries = [map_rnu_to_entry(item) for item in extract_items(rnu_payload)]
    contracts = [map_contract_to_record(item, contract_statuses) for item in extract_items(contracts_payload)[:50]]
    trd_apps = [map_application_to_record(item) for item in extract_items(applications_payload)[:20]]
    trd_buys: List[TrdBuyRecord] = []
    contract_units: List[ContractUnitRecord] = []
    acts: List[ActRecord] = []

    assessment = compute_company_assessment(subject, trd_apps, contracts, acts, rnu_entries, [])
    company = assessment["company"]

    completed_contracts = sum(1 for contract in contracts if is_completed_contract(contract))
    total_value = sum(contract.contract_sum_wnds or contract.contract_sum for contract in contracts)
    regdate = parse_isoish_datetime(subject.get("regdate")) or parse_isoish_datetime(subject.get("crdate"))
    years_active = max(0, datetime.now().year - regdate.year) if regdate else int(subject.get("year") or 0)

    summary = {
        "total_contracts": len(contracts),
        "total_announcements": len(trd_buys),
        "total_applications": len(trd_apps),
        "total_acts": len(acts),
        "total_complaints": 0,
        "total_value": total_value,
        "active_contracts": max(0, len(contracts) - completed_contracts),
        "completed_contracts": completed_contracts,
        "years_active": years_active,
        "average_contract_value": round(total_value / len(contracts)) if contracts else 0,
        "data_source": "goszakup.gov.kz OWS v3",
        "risk_assessment": assessment["risk_assessment"],
    }

    return SupplierProfile(
        company=company,
        summary=summary,
        subject=subject_record,
        subject_addresses=subject_addresses,
        subject_employees=subject_employees,
        trd_buys=trd_buys,
        trd_apps=trd_apps,
        contracts=contracts,
        contract_units=contract_units,
        acts=acts,
        complaints=[],
        rnu_entries=rnu_entries,
        risk_indicators=assessment["risk_indicators"]
    )


async def ensure_local_supplier_profiles_seeded():
    existing_indexes = await db.supplier_profiles.index_information()
    if "company.bin_1" in existing_indexes:
        await db.supplier_profiles.drop()

    legacy_profile_exists = await db.supplier_profiles.count_documents(
        {"$or": [{"company": {"$exists": True}}, {"subject.bin": None}]},
        limit=1,
    )
    if legacy_profile_exists:
        await db.supplier_profiles.drop()

    await db.supplier_profiles.create_index("subject.bin", unique=True)
    await db.supplier_profiles.create_index("subject.name_ru")
    await db.supplier_profiles.create_index("subject.name_kz")

    with LOCAL_SUPPLIER_PROFILES_PATH.open("r", encoding="utf-8") as seed_file:
        profiles = json.load(seed_file)

    prepared_profiles = []
    for profile in profiles:
        subject_payload = profile.get("subject", {})
        prepared_profile = {
            **profile,
            "search_text": " ".join(
                filter(
                    None,
                    [
                        str(subject_payload.get("bin", "")),
                        subject_payload.get("name_ru", ""),
                        subject_payload.get("name_kz", ""),
                        subject_payload.get("full_name_ru", ""),
                        subject_payload.get("full_name_kz", ""),
                    ],
                )
            ).lower(),
        }
        prepared_profiles.append(prepared_profile)

    await db.supplier_profiles.delete_many({})
    if prepared_profiles:
        await db.supplier_profiles.insert_many(prepared_profiles)
        logger.info("Seeded %s local supplier profiles in OWS-like format", len(prepared_profiles))


def read_local_supplier_profiles_seed() -> List[Dict[str, Any]]:
    with LOCAL_SUPPLIER_PROFILES_PATH.open("r", encoding="utf-8") as seed_file:
        return json.load(seed_file)


async def get_local_profiles_snapshot() -> List[Dict[str, Any]]:
    documents = await db.supplier_profiles.find({}, {"_id": 0, "search_text": 0}).to_list(length=None)
    if documents:
        return documents
    logger.warning("Mongo collection supplier_profiles is empty, fallback to local seed file")
    return read_local_supplier_profiles_seed()


async def search_local_companies(query: str) -> List[Company]:
    normalized_query = query.strip()
    if not normalized_query:
        return []

    regex = re.escape(normalized_query)
    search_filter = {
        "$or": [
            {"subject.bin": {"$regex": regex}},
            {"subject.name_ru": {"$regex": regex, "$options": "i"}},
            {"subject.name_kz": {"$regex": regex, "$options": "i"}},
            {"search_text": {"$regex": regex.lower()}},
        ]
    }

    cursor = db.supplier_profiles.find(
        search_filter,
        {"_id": 0, "subject": 1, "trd_apps": 1, "contracts": 1, "acts": 1, "complaints": 1, "rnu_entries": 1}
    ).limit(SEARCH_RESULT_LIMIT)
    companies: List[Company] = []
    async for item in cursor:
        subject = item.get("subject")
        if subject:
            trd_apps = [TrdAppRecord(**application) for application in item.get("trd_apps", [])]
            contracts = [ContractRecord(**contract) for contract in item.get("contracts", [])]
            acts = [ActRecord(**act) for act in item.get("acts", [])]
            rnu_entries = [RnuEntry(**entry) for entry in item.get("rnu_entries", [])]
            complaints = [map_complaint_to_record(raw) for raw in item.get("complaints", [])]
            assessment = compute_company_assessment(subject, trd_apps, contracts, acts, rnu_entries, complaints)
            companies.append(assessment["company"])

    return companies


async def list_local_companies(
    query: Optional[str] = None,
    risk_level: Optional[str] = None,
    is_blacklisted: Optional[bool] = None,
    limit: int = 100
) -> List[Company]:
    mongo_filters: List[Dict[str, Any]] = []

    if query:
        normalized_query = query.strip()
        if normalized_query:
            regex = re.escape(normalized_query)
            mongo_filters.append(
                {
                    "$or": [
                        {"subject.bin": {"$regex": regex}},
                        {"subject.name_ru": {"$regex": regex, "$options": "i"}},
                        {"subject.name_kz": {"$regex": regex, "$options": "i"}},
                        {"search_text": {"$regex": regex.lower()}},
                    ]
                }
            )

    mongo_filter: Dict[str, Any] = {"$and": mongo_filters} if mongo_filters else {}

    cursor = (
        db.supplier_profiles
        .find(mongo_filter, {"_id": 0, "subject": 1, "trd_apps": 1, "contracts": 1, "acts": 1, "complaints": 1, "rnu_entries": 1})
        .sort("subject.name_ru", 1)
        .limit(limit)
    )

    companies: List[Company] = []
    async for item in cursor:
        subject = item.get("subject")
        if subject:
            trd_apps = [TrdAppRecord(**application) for application in item.get("trd_apps", [])]
            contracts = [ContractRecord(**contract) for contract in item.get("contracts", [])]
            acts = [ActRecord(**act) for act in item.get("acts", [])]
            rnu_entries = [RnuEntry(**entry) for entry in item.get("rnu_entries", [])]
            complaints = [map_complaint_to_record(raw) for raw in item.get("complaints", [])]
            assessment = compute_company_assessment(subject, trd_apps, contracts, acts, rnu_entries, complaints)
            company = assessment["company"]
            if risk_level and company.risk_level != risk_level:
                continue
            if is_blacklisted is not None and company.is_blacklisted != is_blacklisted:
                continue
            companies.append(company)

    return companies


async def get_local_supplier_profile(bin_value: str) -> Optional[SupplierProfile]:
    profile = await db.supplier_profiles.find_one({"subject.bin": str(bin_value)}, {"_id": 0, "search_text": 0})
    if not profile:
        seed_profiles = read_local_supplier_profiles_seed()
        profile = next((item for item in seed_profiles if str(item.get("subject", {}).get("bin")) == str(bin_value)), None)
    if not profile:
        return None
    subject = SubjectRecord(**profile.get("subject", {}))
    subject_addresses = [SubjectAddress(**item) for item in profile.get("subject_addresses", [])]
    subject_employees = [SubjectEmployee(**item) for item in profile.get("subject_employees", [])]
    trd_buys = [TrdBuyRecord(**item) for item in profile.get("trd_buys", [])]
    trd_apps = [TrdAppRecord(**item) for item in profile.get("trd_apps", [])]
    contracts = [ContractRecord(**item) for item in profile.get("contracts", [])]
    contract_units = [ContractUnitRecord(**item) for item in profile.get("contract_units", [])]
    acts = [ActRecord(**item) for item in profile.get("acts", [])]
    complaints = [map_complaint_to_record(raw) for raw in profile.get("complaints", [])]
    rnu_entries = [RnuEntry(**item) for item in profile.get("rnu_entries", [])]

    assessment = compute_company_assessment(subject.model_dump(), trd_apps, contracts, acts, rnu_entries, complaints)
    completed_contracts = sum(1 for contract in contracts if is_completed_contract(contract))
    total_value = sum(contract.contract_sum_wnds or contract.contract_sum for contract in contracts)
    regdate = parse_isoish_datetime(subject.regdate) or parse_isoish_datetime(subject.crdate)

    summary = {
        **profile.get("summary", {}),
        "total_contracts": len(contracts),
        "total_announcements": len(trd_buys),
        "total_applications": len(trd_apps),
        "total_acts": len(acts),
        "total_complaints": len(complaints),
        "total_value": total_value,
        "active_contracts": max(0, len(contracts) - completed_contracts),
        "completed_contracts": completed_contracts,
        "years_active": max(0, datetime.now().year - regdate.year) if regdate else 0,
        "average_contract_value": round(total_value / len(contracts)) if contracts else 0,
        "risk_assessment": assessment["risk_assessment"],
    }

    return SupplierProfile(
        company=assessment["company"],
        summary=summary,
        subject=subject,
        subject_addresses=subject_addresses,
        subject_employees=subject_employees,
        trd_buys=trd_buys,
        trd_apps=trd_apps,
        contracts=contracts,
        contract_units=contract_units,
        acts=acts,
        complaints=complaints,
        rnu_entries=rnu_entries,
        risk_indicators=assessment["risk_indicators"],
    )


async def get_local_dashboard_stats() -> DashboardStats:
    cursor = db.supplier_profiles.find(
        {},
        {"_id": 0, "subject": 1, "trd_buys": 1, "trd_apps": 1, "contracts": 1, "acts": 1, "complaints": 1, "rnu_entries": 1}
    )

    total_companies = 0
    total_announcements = 0
    blacklisted_companies = 0
    total_contract_value = 0.0
    trust_score_sum = 0

    async for item in cursor:
        total_companies += 1

        trd_buys = [TrdBuyRecord(**item_data) for item_data in item.get("trd_buys", [])]
        trd_apps = [TrdAppRecord(**application) for application in item.get("trd_apps", [])]
        contracts = [ContractRecord(**contract) for contract in item.get("contracts", [])]
        acts = [ActRecord(**act) for act in item.get("acts", [])]
        rnu_entries = [RnuEntry(**entry) for entry in item.get("rnu_entries", [])]
        complaints = [map_complaint_to_record(raw) for raw in item.get("complaints", [])]
        assessment = compute_company_assessment(item.get("subject", {}), trd_apps, contracts, acts, rnu_entries, complaints)
        company = assessment["company"]

        total_announcements += len(trd_buys)
        total_contract_value += sum(contract.contract_sum_wnds or contract.contract_sum for contract in contracts)
        trust_score_sum += company.trust_score

        if company.is_blacklisted:
            blacklisted_companies += 1

    average_trust_score = round(trust_score_sum / total_companies) if total_companies else 0

    return DashboardStats(
        total_companies=total_companies,
        total_announcements=total_announcements,
        blacklisted_companies=blacklisted_companies,
        total_contract_value=round(total_contract_value, 2),
        average_trust_score=average_trust_score,
    )


def build_contract_registry_item(
    contract: ContractRecord,
    supplier_name: str,
    tender: Optional[TrdBuyRecord] = None,
) -> ContractRegistryItem:
    status_bucket = get_contract_status_bucket(contract)
    return ContractRegistryItem(
        id=contract.id,
        contract_number=contract.contract_number,
        contract_number_sys=contract.contract_number_sys,
        contract_date=contract.crdate,
        supplier_name=supplier_name or "Не указан",
        supplier_biin=contract.supplier_biin,
        customer_name=contract.customer_name_ru or "Не указан",
        customer_bin=contract.customer_bin,
        amount=round(contract.contract_sum_wnds or contract.contract_sum or 0, 2),
        status=get_contract_status_name(contract),
        status_bucket=status_bucket,
        procurement_method=get_trade_method_name(tender.ref_trade_methods_id) if tender else "Не указан",
        tender_number=tender.number_anno if tender else (contract.trd_buy_number_anno or None),
        tender_id=tender.id if tender else (contract.trd_buy_id or None),
    )


def contract_matches_filters(
    item: ContractRegistryItem,
    query: Optional[str],
    status_bucket: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    amount_from: Optional[float],
    amount_to: Optional[float],
) -> bool:
    if query:
        needle = query.strip().lower()
        haystack = " ".join(
            [
                item.contract_number,
                item.contract_number_sys,
                item.supplier_name,
                item.customer_name,
                item.tender_number or "",
            ]
        ).lower()
        if needle not in haystack:
            return False

    if status_bucket and item.status_bucket != status_bucket:
        return False

    contract_date = parse_isoish_datetime(item.contract_date)
    parsed_from = parse_isoish_datetime(date_from)
    parsed_to = parse_isoish_datetime(date_to)

    if parsed_from and contract_date and contract_date.date() < parsed_from.date():
        return False
    if parsed_to and contract_date and contract_date.date() > parsed_to.date():
        return False

    if amount_from is not None and item.amount < amount_from:
        return False
    if amount_to is not None and item.amount > amount_to:
        return False

    return True


def sort_contract_registry_items(items: List[ContractRegistryItem], sort_by: str, sort_order: str) -> List[ContractRegistryItem]:
    reverse = sort_order == "desc"

    def sort_key(item: ContractRegistryItem):
        if sort_by == "contract_date":
            return parse_isoish_datetime(item.contract_date) or datetime.min
        if sort_by == "amount":
            return item.amount
        if sort_by == "supplier_name":
            return item.supplier_name.lower()
        if sort_by == "customer_name":
            return item.customer_name.lower()
        if sort_by == "status":
            return item.status.lower()
        if sort_by == "procurement_method":
            return item.procurement_method.lower()
        if sort_by == "tender_number":
            return (item.tender_number or "").lower()
        return item.contract_number.lower()

    return sorted(items, key=sort_key, reverse=reverse)


async def list_local_contract_registry(
    query: Optional[str] = None,
    status_bucket: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    amount_from: Optional[float] = None,
    amount_to: Optional[float] = None,
    sort_by: str = "contract_date",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> ContractRegistryResponse:
    items: List[ContractRegistryItem] = []
    profiles = await get_local_profiles_snapshot()
    for profile in profiles:
        supplier_name = profile.get("subject", {}).get("name_ru") or profile.get("subject", {}).get("full_name_ru") or "Не указан"
        trd_buys = [TrdBuyRecord(**raw) for raw in profile.get("trd_buys", [])]
        buy_by_id = {buy.id: buy for buy in trd_buys}
        for raw_contract in profile.get("contracts", []):
            contract = ContractRecord(**raw_contract)
            tender = buy_by_id.get(contract.trd_buy_id)
            item = build_contract_registry_item(contract, supplier_name, tender)
            if contract_matches_filters(item, query, status_bucket, date_from, date_to, amount_from, amount_to):
                items.append(item)

    sorted_items = sort_contract_registry_items(items, sort_by, sort_order)
    total = len(sorted_items)
    start = max(0, (page - 1) * page_size)
    end = start + page_size

    return ContractRegistryResponse(
        items=sorted_items[start:end],
        total=total,
        page=page,
        page_size=page_size,
    )


def build_contract_history(contract: ContractRecord, acts: List[ActRecord]) -> List[ContractTimelineEvent]:
    history: List[ContractTimelineEvent] = []

    history.append(
        ContractTimelineEvent(
            date=contract.crdate,
            title="Создание договора",
            description=f"Договор зарегистрирован со статусом «{get_contract_status_name(contract)}».",
            event_type="contract_created",
        )
    )

    if contract.trd_buy_itogi_date_public:
        history.append(
            ContractTimelineEvent(
                date=contract.trd_buy_itogi_date_public,
                title="Публикация итогов закупки",
                description=f"Связанное объявление {contract.trd_buy_number_anno or 'без номера'} перешло в стадию итогов.",
                event_type="tender_results",
            )
        )

    if contract.sign_reason_doc_date or contract.sign_reason_doc_name:
        history.append(
            ContractTimelineEvent(
                date=contract.sign_reason_doc_date,
                title="Основание подписания",
                description=contract.sign_reason_doc_name or "Документ-основание не указан.",
                event_type="sign_reason",
            )
        )

    if contract.last_update_date and contract.last_update_date != contract.crdate:
        history.append(
            ContractTimelineEvent(
                date=contract.last_update_date,
                title="Последнее обновление карточки",
                description=f"Карточка договора обновлена. Текущий статус: «{get_contract_status_name(contract)}».",
                event_type="contract_updated",
            )
        )

    for act in acts:
        overdue = max(0, int(act.day_overdue or 0))
        fine_sum = round(float(act.sum_fine or 0), 2)
        fragments = [act.status_name_ru or f"Статус #{act.status_id}"]
        if overdue:
            fragments.append(f"просрочка {overdue} дн.")
        if fine_sum:
            fragments.append(f"штраф {fine_sum} ₸")
        if act.sum_transfer:
            fragments.append(f"к перечислению {round(float(act.sum_transfer), 2)} ₸")

        history.append(
            ContractTimelineEvent(
                date=act.create_date_act or act.akt_date or act.approve_date,
                title=f"Электронный акт {act.number_act}",
                description=", ".join(fragments),
                event_type="act",
            )
        )

    return sorted(
        history,
        key=lambda event: parse_isoish_datetime(event.date) or datetime.min,
        reverse=True,
    )


async def get_local_contract_detail(contract_id: int) -> Optional[ContractDetail]:
    profiles = await get_local_profiles_snapshot()
    for profile in profiles:
        contracts = [ContractRecord(**raw) for raw in profile.get("contracts", [])]
        target = next((contract for contract in contracts if contract.id == contract_id), None)
        if not target:
            continue

        trd_buys = [TrdBuyRecord(**raw) for raw in profile.get("trd_buys", [])]
        supplier_name = profile.get("subject", {}).get("name_ru") or profile.get("subject", {}).get("full_name_ru") or "Не указан"
        supplier_addresses = [SubjectAddress(**raw) for raw in profile.get("subject_addresses", [])]
        primary_supplier_address = next(
            (address for address in supplier_addresses if address.address_type == 1),
            supplier_addresses[0] if supplier_addresses else None,
        )
        supplier_party = ContractPartyInfo(
            name=supplier_name,
            bin=profile.get("subject", {}).get("bin") or target.supplier_biin,
            region=profile.get("summary", {}).get("region_name"),
            address=primary_supplier_address.address if primary_supplier_address else None,
            status="Активный",
        )
        customer_party = ContractPartyInfo(
            name=target.customer_name_ru or "Не указан",
            bin=target.customer_bin or None,
            region=None,
            address=None,
            status="Действующий заказчик" if target.customer_bin else None,
        )
        buy_by_id = {buy.id: buy for buy in trd_buys}
        tender = buy_by_id.get(target.trd_buy_id)
        units = [ContractUnitRecord(**raw) for raw in profile.get("contract_units", []) if int(raw.get("contract_id") or 0) == target.id]
        acts = [
            ActRecord(**raw)
            for raw in profile.get("acts", [])
            if int(raw.get("contract_id") or 0) == target.id or int(raw.get("contract_root_id") or 0) == target.root_id
        ]
        history = build_contract_history(target, acts)
        overdue_acts = [act for act in acts if is_overdue_act(act)]
        total_transferred = round(sum(float(act.sum_transfer or 0) for act in acts), 2)
        amount = round(target.contract_sum_wnds or target.contract_sum or 0, 2)
        execution_status = {
            "label": get_contract_status_name(target),
            "status_bucket": get_contract_status_bucket(target),
            "total_acts": len(acts),
            "overdue_acts": len(overdue_acts),
            "total_transferred": total_transferred,
            "total_fines": round(sum(float(act.sum_fine or 0) for act in acts), 2),
            "completion_percent": round(min(100.0, (total_transferred / amount) * 100), 1) if amount > 0 else 0.0,
        }

        return ContractDetail(
            item=build_contract_registry_item(target, supplier_name, tender),
            contract=target,
            tender=tender,
            units=units,
            acts=sorted(acts, key=lambda act: parse_isoish_datetime(act.akt_date) or datetime.min, reverse=True),
            history=history,
            execution_status=execution_status,
            supplier_party=supplier_party,
            customer_party=customer_party,
        )

    return None


def normalize_complaint_status(value: Optional[str]) -> str:
    normalized = (value or "").strip()
    if not normalized:
        return "Статус не указан"
    return normalized


def map_raw_complaint(profile: Dict[str, Any], raw: Dict[str, Any]) -> ComplaintRegistryItem:
    subject = profile.get("subject", {})
    complaint_number = str(
        raw.get("complaint_number")
        or raw.get("number")
        or raw.get("id")
        or raw.get("complaint_id")
        or ""
    )
    object_name = (
        raw.get("object_name")
        or raw.get("customer_name")
        or raw.get("customer_name_ru")
        or raw.get("trd_buy_name")
        or raw.get("tender_name")
        or "Не указан"
    )
    short_description = (
        raw.get("short_description")
        or raw.get("description")
        or raw.get("reason")
        or raw.get("summary")
        or "Описание не указано"
    )
    full_text = (
        raw.get("full_text")
        or raw.get("text")
        or raw.get("description")
        or raw.get("content")
        or short_description
    )
    applicant_name = (
        raw.get("applicant_name")
        or raw.get("supplier_name")
        or raw.get("supplier_name_ru")
        or subject.get("name_ru")
        or "Не указан"
    )
    object_type = raw.get("object_type") or ("Тендер" if raw.get("tender_number") or raw.get("trd_buy_number_anno") else "Заказчик")

    return ComplaintRegistryItem(
        id=str(raw.get("id") or complaint_number or uuid.uuid4()),
        complaint_number=complaint_number or str(raw.get("id") or ""),
        date_submitted=raw.get("date") or raw.get("date_submitted") or raw.get("submitted_at") or raw.get("created_at") or raw.get("crdate"),
        applicant_name=applicant_name,
        applicant_identifier=raw.get("applicant_identifier") or raw.get("applicant_bin") or raw.get("supplier_biin") or raw.get("supplier_bin"),
        supplier_name=raw.get("supplier_name") or raw.get("supplier_name_ru") or subject.get("name_ru"),
        customer_name=raw.get("customer_name") or raw.get("customer_name_ru"),
        object_type=object_type,
        object_name=object_name,
        status=normalize_complaint_status(raw.get("status")),
        short_description=short_description,
        full_text=full_text,
        tender_number=raw.get("tender_number") or raw.get("trd_buy_number_anno") or raw.get("announcement_number"),
        related_tender_id=raw.get("related_tender_id") or raw.get("tender_id") or raw.get("trd_buy_id"),
        related_contract_id=raw.get("related_contract_id") or raw.get("contract_id"),
        decision=raw.get("decision") or raw.get("resolution") or raw.get("result"),
        supplier_biin=raw.get("supplier_biin") or raw.get("supplier_bin") or subject.get("bin"),
    )


def complaint_matches_filters(
    item: ComplaintRegistryItem,
    query: Optional[str],
    status: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> bool:
    if query:
        needle = query.strip().lower()
        haystack = " ".join(
            [
                item.complaint_number,
                item.applicant_name,
                item.object_name,
                item.short_description,
                item.tender_number or "",
            ]
        ).lower()
        if needle not in haystack:
            return False

    if status and item.status != status:
        return False

    submitted_at = parse_isoish_datetime(item.date_submitted)
    parsed_from = parse_isoish_datetime(date_from)
    parsed_to = parse_isoish_datetime(date_to)

    if parsed_from and submitted_at and submitted_at.date() < parsed_from.date():
        return False
    if parsed_to and submitted_at and submitted_at.date() > parsed_to.date():
        return False

    return True


async def list_local_complaints(
    query: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> ComplaintRegistryResponse:
    items: List[ComplaintRegistryItem] = []
    profiles = await get_local_profiles_snapshot()
    for profile in profiles:
        complaint_lists = []
        for key in ("complaints", "complaint_entries", "complaint_registry"):
            value = profile.get(key)
            if isinstance(value, list):
                complaint_lists.extend(value)

        for raw in complaint_lists:
            if not isinstance(raw, dict):
                continue
            item = map_raw_complaint(profile, raw)
            if complaint_matches_filters(item, query, status, date_from, date_to):
                items.append(item)

    items = sorted(items, key=lambda item: parse_isoish_datetime(item.date_submitted) or datetime.min, reverse=True)
    total = len(items)
    start = max(0, (page - 1) * page_size)
    end = start + page_size

    return ComplaintRegistryResponse(
        items=items[start:end],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_local_complaint_detail(complaint_id: str) -> Optional[ComplaintDetail]:
    registry = await list_local_complaints(page=1, page_size=10000)
    item = next((entry for entry in registry.items if entry.id == complaint_id), None)
    if not item:
        return None
    return ComplaintDetail(item=item)


def build_global_ows_indexes(profiles: List[Dict[str, Any]]) -> Dict[str, Any]:
    buy_by_id: Dict[int, TrdBuyRecord] = {}
    apps_by_buy_id: Dict[int, List[Dict[str, Any]]] = {}
    lot_entries_by_id: Dict[int, List[Dict[str, Any]]] = {}
    contract_by_buy_id: Dict[int, ContractRecord] = {}
    contract_unit_by_lot_id: Dict[int, ContractUnitRecord] = {}
    company_by_bin: Dict[str, Company] = {}

    for profile in profiles:
        subject = profile.get("subject", {})
        company_by_bin[str(subject.get("bin") or "")] = map_subject_to_company(subject)

        for raw_buy in profile.get("trd_buys", []):
            buy = TrdBuyRecord(**raw_buy)
            buy_by_id[buy.id] = buy

        contracts = [ContractRecord(**raw) for raw in profile.get("contracts", [])]
        acts = [ActRecord(**raw) for raw in profile.get("acts", [])]
        complaints = [map_complaint_to_record(raw) for raw in profile.get("complaints", [])]
        trd_apps = [TrdAppRecord(**raw) for raw in profile.get("trd_apps", [])]
        rnu_entries = [RnuEntry(**raw) for raw in profile.get("rnu_entries", [])]
        assessment = compute_company_assessment(subject, trd_apps, contracts, acts, rnu_entries, complaints)
        company_by_bin[str(subject.get("bin") or "")] = assessment["company"]

        for contract in contracts:
            contract_by_buy_id[contract.trd_buy_id] = contract

        for raw_unit in profile.get("contract_units", []):
            unit = ContractUnitRecord(**raw_unit)
            contract_unit_by_lot_id[unit.lot_id] = unit

        for raw_app in profile.get("trd_apps", []):
            app = TrdAppRecord(**raw_app)
            app_profile = {
                "profile": profile,
                "app": app,
            }
            apps_by_buy_id.setdefault(app.buy_id, []).append(app_profile)
            for lot in app.app_lots:
                lot_entries_by_id.setdefault(lot.lot_id, []).append(
                    {
                        "profile": profile,
                        "app": app,
                        "lot": lot,
                    }
                )

    return {
        "buy_by_id": buy_by_id,
        "apps_by_buy_id": apps_by_buy_id,
        "lot_entries_by_id": lot_entries_by_id,
        "contract_by_buy_id": contract_by_buy_id,
        "contract_unit_by_lot_id": contract_unit_by_lot_id,
        "company_by_bin": company_by_bin,
    }


def derive_bid_status(buy: Optional[TrdBuyRecord], linked_contract: Optional[ContractRecord]) -> Dict[str, Any]:
    if linked_contract:
        return {"status": "Победила", "place": 1, "result": "Победитель"}
    if buy and int(buy.ref_buy_status_id or 0) == 320:
        return {"status": "Подана", "place": None, "result": "На рассмотрении"}
    return {"status": "Отклонена", "place": None, "result": "Проиграл"}


def build_announcement_bid_item(
    app: TrdAppRecord,
    supplier_name: str,
    buy: Optional[TrdBuyRecord],
    linked_contract: Optional[ContractRecord],
) -> AnnouncementBidItem:
    offered_amount = get_application_amount = sum(float(lot.amount or 0) for lot in app.app_lots)
    status_payload = derive_bid_status(buy, linked_contract)
    return AnnouncementBidItem(
        application_id=app.id,
        bid_number=app.prot_number or app.id,
        buy_id=app.buy_id,
        supplier_name=supplier_name,
        supplier_bin=app.supplier_bin_iin,
        offered_amount=round(offered_amount, 2),
        date_apply=app.date_apply,
        status=status_payload["status"],
        place=status_payload["place"],
        result=status_payload["result"],
    )


def build_announcement_lot_item(
    lot: TrdAppLot,
    contract_unit: Optional[ContractUnitRecord],
    linked_contract: Optional[ContractRecord],
    winner_name: Optional[str],
) -> AnnouncementLotItem:
    return AnnouncementLotItem(
        lot_number=lot.lot_number or str(lot.lot_id),
        lot_id=lot.lot_id,
        name_ru=lot.name_ru,
        quantity=lot.quantity,
        amount=round(float((contract_unit.total_sum_wnds if contract_unit else 0) or lot.amount or 0), 2),
        status=get_lot_status_label(lot.ref_lot_status_id),
        contract_number=linked_contract.contract_number if linked_contract else None,
        winner_name=winner_name,
    )


async def get_local_announcement_detail(announcement_id: int) -> Optional[AnnouncementDetail]:
    profiles = await get_local_profiles_snapshot()
    indexes = build_global_ows_indexes(profiles)
    buy = indexes["buy_by_id"].get(announcement_id)
    if not buy:
        return None

    app_entries = indexes["apps_by_buy_id"].get(announcement_id, [])
    linked_contract = indexes["contract_by_buy_id"].get(announcement_id)

    bids: List[AnnouncementBidItem] = []
    lots: List[AnnouncementLotItem] = []
    for entry in app_entries:
        profile = entry["profile"]
        app = entry["app"]
        supplier_name = profile.get("subject", {}).get("name_ru") or "Не указан"
        bid_item = build_announcement_bid_item(app, supplier_name, buy, linked_contract)
        bids.append(bid_item)

        for lot in app.app_lots:
            contract_unit = indexes["contract_unit_by_lot_id"].get(lot.lot_id)
            lots.append(build_announcement_lot_item(lot, contract_unit, linked_contract, supplier_name if linked_contract else None))

    return AnnouncementDetail(announcement=buy, lots=lots, bids=bids)


async def get_local_bid_detail(application_id: str) -> Optional[BidDetail]:
    profiles = await get_local_profiles_snapshot()
    indexes = build_global_ows_indexes(profiles)

    for profile in profiles:
        supplier_name = profile.get("subject", {}).get("name_ru") or "Не указан"
        subject = profile.get("subject", {})
        company = indexes["company_by_bin"].get(str(subject.get("bin") or ""))
        for raw_app in profile.get("trd_apps", []):
            app = TrdAppRecord(**raw_app)
            if app.id != application_id:
                continue
            buy = indexes["buy_by_id"].get(app.buy_id)
            linked_contract = indexes["contract_by_buy_id"].get(app.buy_id)
            bid_item = build_announcement_bid_item(app, supplier_name, buy, linked_contract)
            lots = [
                build_announcement_lot_item(
                    lot,
                    indexes["contract_unit_by_lot_id"].get(lot.lot_id),
                    linked_contract,
                    supplier_name if linked_contract else None,
                )
                for lot in app.app_lots
            ]
            return BidDetail(
                bid=bid_item,
                announcement=buy,
                supplier=company,
                lots=lots,
            )

    return None


async def get_local_lot_detail(lot_id: int) -> Optional[LotDetail]:
    profiles = await get_local_profiles_snapshot()
    indexes = build_global_ows_indexes(profiles)
    lot_entries = indexes["lot_entries_by_id"].get(lot_id, [])
    if not lot_entries:
        return None

    primary = lot_entries[0]
    app = primary["app"]
    lot = primary["lot"]
    buy = indexes["buy_by_id"].get(app.buy_id)
    linked_contract = indexes["contract_by_buy_id"].get(app.buy_id)
    contract_unit = indexes["contract_unit_by_lot_id"].get(lot_id)

    bids: List[AnnouncementBidItem] = []
    for entry in lot_entries:
        profile = entry["profile"]
        entry_app = entry["app"]
        supplier_name = profile.get("subject", {}).get("name_ru") or "Не указан"
        bids.append(
            build_announcement_bid_item(
                entry_app,
                supplier_name,
                buy,
                linked_contract if entry_app.buy_id == app.buy_id else None,
            )
        )

    lot_item = build_announcement_lot_item(
        lot,
        contract_unit,
        linked_contract,
        bids[0].supplier_name if linked_contract and bids else None,
    )
    return LotDetail(lot=lot_item, announcement=buy, bids=bids)

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
        if user.get("role") not in VALID_APP_ROLES:
            raise HTTPException(status_code=401, detail="Unsupported user role")
        return User(**user)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user_data = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    if not user_data:
        demo_user = DEMO_USERS.get(request.email)
        if request.password == "demo123" and demo_user:
            user_dict = {
                "id": str(uuid.uuid4()),
                "email": request.email,
                "full_name": demo_user["full_name"],
                "role": demo_user["role"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user_dict)
            user = User(**user_dict)
        else:
            raise HTTPException(status_code=401, detail="Неверные учетные данные")
    else:
        demo_user = DEMO_USERS.get(request.email)
        if user_data.get("role") not in VALID_APP_ROLES or not demo_user:
            await db.users.delete_one({"email": request.email})
            raise HTTPException(
                status_code=401,
                detail="Устаревшая демо-учетная запись удалена. Используйте admin@procurecheck.kz или user@procurecheck.kz."
            )

        desired_role = demo_user["role"]
        desired_name = demo_user["full_name"]

        if user_data.get("role") != desired_role or user_data.get("full_name") != desired_name:
            await db.users.update_one(
                {"email": request.email},
                {"$set": {"role": desired_role, "full_name": desired_name}},
            )
            user_data["role"] = desired_role
            user_data["full_name"] = desired_name
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

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    return await get_local_dashboard_stats()

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


@api_router.get("/contracts", response_model=ContractRegistryResponse)
async def get_contract_registry(
    query: Optional[str] = None,
    status: Optional[str] = Query(default=None, pattern="^(in_progress|completed|terminated)$"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    amount_from: Optional[float] = None,
    amount_to: Optional[float] = None,
    sort_by: str = Query(default="contract_date", pattern="^(contract_number|contract_date|supplier_name|customer_name|amount|status|procurement_method|tender_number)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    return await list_local_contract_registry(
        query=query,
        status_bucket=status,
        date_from=date_from,
        date_to=date_to,
        amount_from=amount_from,
        amount_to=amount_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


@api_router.get("/contracts/{contract_id}", response_model=ContractDetail)
async def get_contract_detail(
    contract_id: int,
    current_user: User = Depends(get_current_user)
):
    detail = await get_local_contract_detail(contract_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Договор не найден в локальной базе")
    return detail


@api_router.get("/complaints", response_model=ComplaintRegistryResponse)
async def get_complaints_registry(
    query: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    return await list_local_complaints(
        query=query,
        status=status,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


@api_router.get("/complaints/{complaint_id}", response_model=ComplaintDetail)
async def get_complaint_detail(
    complaint_id: str,
    current_user: User = Depends(get_current_user)
):
    detail = await get_local_complaint_detail(complaint_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Жалоба не найдена в локальной базе")
    return detail


@api_router.get("/announcements/{announcement_id}", response_model=AnnouncementDetail)
async def get_announcement_detail(
    announcement_id: int,
    current_user: User = Depends(get_current_user)
):
    detail = await get_local_announcement_detail(announcement_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Объявление не найдено в локальной базе")
    return detail


@api_router.get("/bids/{application_id}", response_model=BidDetail)
async def get_bid_detail(
    application_id: str,
    current_user: User = Depends(get_current_user)
):
    detail = await get_local_bid_detail(application_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Заявка не найдена в локальной базе")
    return detail


@api_router.get("/lots/{lot_id}", response_model=LotDetail)
async def get_lot_detail(
    lot_id: int,
    current_user: User = Depends(get_current_user)
):
    detail = await get_local_lot_detail(lot_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Лот не найден в локальной базе")
    return detail

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
