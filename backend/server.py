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
    rnu_entries: List[RnuEntry]
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


def is_active_rnu_entry(entry: RnuEntry) -> bool:
    end_date = parse_isoish_datetime(entry.end_date)
    return end_date is None or end_date >= datetime.now()


def is_terminated_contract(contract: ContractRecord) -> bool:
    return "расторг" in get_contract_status_name(contract).lower()


def is_completed_contract(contract: ContractRecord) -> bool:
    return any(marker in get_contract_status_name(contract).lower() for marker in ("исполн", "выполн", "заверш"))


def is_overdue_act(act: ActRecord) -> bool:
    return (act.day_overdue or 0) > 0 or (act.sum_fine or 0) > 0


def compute_company_assessment(
    subject_data: Dict[str, Any],
    applications: List[TrdAppRecord],
    contracts: List[ContractRecord],
    acts: List[ActRecord],
    rnu_entries: List[RnuEntry]
) -> Dict[str, Any]:
    active_rnu_entries = [entry for entry in rnu_entries if is_active_rnu_entry(entry)]
    terminated_contracts = [contract for contract in contracts if is_terminated_contract(contract)]
    completed_contracts = [contract for contract in contracts if is_completed_contract(contract)]
    overdue_acts = [act for act in acts if is_overdue_act(act)]

    total_announcements = max(len(applications), len({application.buy_id for application in applications if application.buy_id}))
    total_contracts = len(contracts)
    applications_count = len(applications)
    completed_contracts_count = len(completed_contracts)
    terminated_contracts_count = len(terminated_contracts)
    active_rnu_count = len(active_rnu_entries)
    overdue_acts_count = len(overdue_acts)

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

    if total_contracts == 0:
        negative_points += 10.0
    if applications_count == 0:
        negative_points += 6.0

    trust_score = round(max(5.0, min(95.0, 58.0 + positive_points - negative_points)))

    if active_rnu_count > 0 or terminated_contracts_count >= 2 or overdue_acts_count >= 2 or trust_score < 45:
        risk_level = "high"
    elif terminated_contracts_count == 1 or overdue_acts_count == 1 or trust_score < 75:
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
        assessment = compute_company_assessment(subject, [], [], [], rnu_entries)
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

    assessment = compute_company_assessment(subject, trd_apps, contracts, acts, rnu_entries)
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
        {"_id": 0, "subject": 1, "trd_apps": 1, "contracts": 1, "acts": 1, "rnu_entries": 1}
    ).limit(SEARCH_RESULT_LIMIT)
    companies: List[Company] = []
    async for item in cursor:
        subject = item.get("subject")
        if subject:
            trd_apps = [TrdAppRecord(**application) for application in item.get("trd_apps", [])]
            contracts = [ContractRecord(**contract) for contract in item.get("contracts", [])]
            acts = [ActRecord(**act) for act in item.get("acts", [])]
            rnu_entries = [RnuEntry(**entry) for entry in item.get("rnu_entries", [])]
            assessment = compute_company_assessment(subject, trd_apps, contracts, acts, rnu_entries)
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
        .find(mongo_filter, {"_id": 0, "subject": 1, "trd_apps": 1, "contracts": 1, "acts": 1, "rnu_entries": 1})
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
            assessment = compute_company_assessment(subject, trd_apps, contracts, acts, rnu_entries)
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
        return None
    subject = SubjectRecord(**profile.get("subject", {}))
    subject_addresses = [SubjectAddress(**item) for item in profile.get("subject_addresses", [])]
    subject_employees = [SubjectEmployee(**item) for item in profile.get("subject_employees", [])]
    trd_buys = [TrdBuyRecord(**item) for item in profile.get("trd_buys", [])]
    trd_apps = [TrdAppRecord(**item) for item in profile.get("trd_apps", [])]
    contracts = [ContractRecord(**item) for item in profile.get("contracts", [])]
    contract_units = [ContractUnitRecord(**item) for item in profile.get("contract_units", [])]
    acts = [ActRecord(**item) for item in profile.get("acts", [])]
    rnu_entries = [RnuEntry(**item) for item in profile.get("rnu_entries", [])]

    assessment = compute_company_assessment(subject.model_dump(), trd_apps, contracts, acts, rnu_entries)
    completed_contracts = sum(1 for contract in contracts if is_completed_contract(contract))
    total_value = sum(contract.contract_sum_wnds or contract.contract_sum for contract in contracts)
    regdate = parse_isoish_datetime(subject.regdate) or parse_isoish_datetime(subject.crdate)

    summary = {
        **profile.get("summary", {}),
        "total_contracts": len(contracts),
        "total_announcements": len(trd_buys),
        "total_applications": len(trd_apps),
        "total_acts": len(acts),
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
        rnu_entries=rnu_entries,
        risk_indicators=assessment["risk_indicators"],
    )


async def get_local_dashboard_stats() -> DashboardStats:
    cursor = db.supplier_profiles.find(
        {},
        {"_id": 0, "subject": 1, "trd_buys": 1, "trd_apps": 1, "contracts": 1, "acts": 1, "rnu_entries": 1}
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
        assessment = compute_company_assessment(item.get("subject", {}), trd_apps, contracts, acts, rnu_entries)
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
