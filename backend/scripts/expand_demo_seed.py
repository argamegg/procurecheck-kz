from __future__ import annotations

import json
import random
from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT_DIR / "data" / "supplier_profiles.json"
RNG = random.Random(20260429)


REGIONS = [
    {"city": "Астана", "district": "район Есиль", "kato": "711110000", "phone": "7172"},
    {"city": "Алматы", "district": "Бостандыкский район", "kato": "751410000", "phone": "727"},
    {"city": "Шымкент", "district": "Аль-Фарабийский район", "kato": "790000000", "phone": "7252"},
    {"city": "Атырау", "district": "микрорайон Нурсая", "kato": "231010000", "phone": "7122"},
    {"city": "Актобе", "district": "район Астана", "kato": "151010000", "phone": "7132"},
    {"city": "Караганда", "district": "район имени Казыбек би", "kato": "351010000", "phone": "7212"},
    {"city": "Павлодар", "district": "Центральный район", "kato": "551010000", "phone": "7182"},
    {"city": "Усть-Каменогорск", "district": "район Самал", "kato": "631010000", "phone": "7232"},
    {"city": "Тараз", "district": "район Аулиеата", "kato": "311010000", "phone": "7262"},
    {"city": "Костанай", "district": "Центральный район", "kato": "391010000", "phone": "7142"},
]

ANNOUNCEMENT_CATALOG = [
    {
        "category": "IT",
        "titles": [
            "Поставка серверного оборудования для ЦОД",
            "Закуп лицензий информационной безопасности",
            "Услуги сопровождения интеграционной платформы",
            "Поставка ноутбуков и периферии",
        ],
        "items": ["Серверное оборудование", "Лицензии ПО", "Работы по настройке", "Техническая поддержка"],
        "amount_range": (18_000_000, 140_000_000),
    },
    {
        "category": "Строительство",
        "titles": [
            "Капитальный ремонт кровли административного здания",
            "Текущий ремонт инженерных сетей",
            "Строительно-монтажные работы по благоустройству",
            "Реконструкция фасада и входной группы",
        ],
        "items": ["Строительно-монтажные работы", "Материалы и комплектующие", "Надзор и приемка"],
        "amount_range": (35_000_000, 260_000_000),
    },
    {
        "category": "Услуги",
        "titles": [
            "Услуги клининга административных помещений",
            "Охранные услуги объектов заказчика",
            "Услуги технического обслуживания инженерных систем",
            "Консультационные услуги по цифровизации процессов",
        ],
        "items": ["Основная услуга", "Сопутствующие услуги", "Ежемесячное обслуживание"],
        "amount_range": (6_000_000, 48_000_000),
    },
    {
        "category": "Поставки",
        "titles": [
            "Поставка медицинских расходных материалов",
            "Закуп канцелярских товаров и бумаги",
            "Поставка спецодежды и средств защиты",
            "Поставка автозапчастей и расходников",
        ],
        "items": ["Основная поставка", "Комплектующие", "Дополнительные позиции"],
        "amount_range": (4_500_000, 60_000_000),
    },
    {
        "category": "Транспорт",
        "titles": [
            "Техническое обслуживание автотранспорта",
            "Услуги перевозки персонала и грузов",
            "Поставка шин и аккумуляторных батарей",
            "Аренда специализированной техники",
        ],
        "items": ["Услуги/товары по транспорту", "Расходные материалы", "Сопутствующие работы"],
        "amount_range": (8_000_000, 55_000_000),
    },
    {
        "category": "Энергетика",
        "titles": [
            "Поставка электромонтажных материалов",
            "Модернизация систем электроснабжения",
            "Обслуживание приборов учета и автоматики",
            "Поставка кабельной продукции",
        ],
        "items": ["Материалы", "Монтажные работы", "Пусконаладка"],
        "amount_range": (10_000_000, 95_000_000),
    },
]

CUSTOMER_SPECS = [
    ("ГУ \"Управление образования города Актобе\"", "good", 4),
    ("КГП на ПХВ \"Городская клиническая больница №7\"", "good", 1),
    ("ГУ \"Управление пассажирского транспорта города Шымкент\"", "good", 2),
    ("ГУ \"Отдел строительства города Тараз\"", "good", 0),
    ("КГП \"Областной центр информационных технологий\"", "good", 6),
    ("ГУ \"Управление цифровизации Павлодарской области\"", "medium", 6),
    ("КГКП \"Дворец школьников города Костанай\"", "medium", 9),
    ("ГУ \"Отдел ЖКХ города Усть-Каменогорск\"", "medium", 7),
    ("ГКП \"Атырау Су Арнасы\"", "medium", 3),
    ("ГУ \"Управление спорта Карагандинской области\"", "medium", 5),
    ("ГУ \"Отдел культуры города Алматы\"", "problem", 1),
]

SUPPLIER_SPECS = [
    ("ТОО \"North Digital Solutions\"", 6),
    ("ТОО \"Qazaq Supply Integrator\"", 0),
]

ORGANIZER_SPECS = [
    ("АО \"Единый центр конкурсных процедур\"", 1),
]

NEUTRAL_SPECS = [
    ("ТОО \"Silk Road Consulting Group\"", 0),
    ("ТОО \"Nomad Advisory Partners\"", 2),
    ("ТОО \"Steppe Industrial Reserve\"", 5),
    ("ТОО \"Central Asset Holding\"", 6),
    ("ТОО \"Altai Export Systems\"", 7),
    ("ТОО \"Aral Service Reserve\"", 8),
    ("ТОО \"Kaspiy Documentation Hub\"", 3),
    ("ТОО \"Zhetysu Corporate Services\"", 1),
]

COMPLAINT_EXECUTION_SUBJECTS = [
    "Нарушение сроков исполнения договора",
    "Поставка товара ненадлежащего качества",
    "Неисполнение обязательств по договору",
    "Неполное выполнение работ по акту",
]

COMPLAINT_PROCUREMENT_SUBJECTS = [
    "Нарушение процедуры рассмотрения заявок",
    "Ограничение конкуренции в закупке",
    "Необоснованное отклонение заявки",
    "Непрозрачные условия закупочной процедуры",
]


@dataclass
class IdPool:
    pid: int
    address: int
    employee: int
    announcement: int
    protocol: int
    contract: int
    contract_unit: int
    plan_point: int
    act: int
    complaint: int
    rnu: int


def main() -> None:
    profiles = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    already_expanded = any(profile.get("subject", {}).get("bin") == "240140900001" for profile in profiles)

    id_pool = build_id_pool(profiles)
    profiles_by_bin = {str(profile["subject"]["bin"]): profile for profile in profiles}

    if not already_expanded:
        new_profiles = create_additional_profiles(id_pool)
        profiles.extend(new_profiles)
        profiles_by_bin.update({str(profile["subject"]["bin"]): profile for profile in new_profiles})

    supplier_profiles = [profile for profile in profiles if int(profile["subject"].get("supplier") or 0) == 1]
    customer_profiles = [profile for profile in profiles if int(profile["subject"].get("customer") or 0) == 1]
    organizer_profiles = [profile for profile in profiles if int(profile["subject"].get("organizer") or 0) == 1 or int(profile["subject"].get("is_single_org") or 0) == 1]

    supplier_profiles.sort(key=lambda item: str(item["subject"]["bin"]))
    customer_profiles.sort(key=lambda item: str(item["subject"]["bin"]))
    organizer_profiles.sort(key=lambda item: str(item["subject"]["bin"]))

    supplier_groups = {
        "ideal": supplier_profiles[:10],
        "medium": supplier_profiles[10:22],
        "risky": supplier_profiles[22:30],
    }
    customer_groups = {
        "good": customer_profiles[:5],
        "medium": customer_profiles[5:10],
        "problem": customer_profiles[10:15],
    }

    if not already_expanded:
        procurement_records: list[dict] = []
        customer_schedule = (
            [(profile, "good") for profile in customer_groups["good"]] +
            [(profile, "medium") for profile in customer_groups["medium"]] +
            [(profile, "problem") for profile in customer_groups["problem"]]
        )

        for customer_index, (customer_profile, customer_scenario) in enumerate(customer_schedule):
            organizer_profile = organizer_profiles[customer_index % len(organizer_profiles)]
            for iteration in range(2):
                announcement_bundle = build_announcement_bundle(
                    id_pool=id_pool,
                    customer_profile=customer_profile,
                    organizer_profile=organizer_profile,
                    customer_scenario=customer_scenario,
                    sequence_index=(customer_index * 2) + iteration,
                )
                announcement = announcement_bundle["announcement"]
                customer_profile["trd_buys"].append(announcement)
                procurement_records.append(announcement_bundle)

        complaints_created: list[dict] = []
        rnu_suppliers_used: set[str] = {
            str(profile["subject"]["bin"])
            for profile in profiles
            if profile.get("rnu_entries")
        }

        for record_index, record in enumerate(procurement_records):
            bidder_profiles = choose_bidders(
                record["customer_scenario"],
                record["status_code"],
                supplier_groups,
                supplier_profiles,
                record["announcement"]["id"],
            )
            applications = build_applications_for_announcement(id_pool, record["announcement"], bidder_profiles, record["category"], record["base_amount"])
            winner_application = None
            if record["status_code"] in {320, 340} and applications:
                ranked = sorted(applications, key=lambda item: item["app_lots"][0]["price_offer"])
                winner_application = ranked[0]
                annotate_application_results(applications, winner_application, finalized=record["status_code"] == 340)
            else:
                annotate_application_results(applications, None, finalized=False)

            for application in applications:
                supplier_profile = profiles_by_bin[str(application["supplier_bin_iin"])]
                supplier_profile["trd_apps"].append(application)

            if winner_application and record["status_code"] in {320, 340}:
                supplier_profile = profiles_by_bin[str(winner_application["supplier_bin_iin"])]
                supplier_scenario = get_supplier_scenario(supplier_profile, supplier_groups)
                contract_pair = build_contract_pair(
                    id_pool=id_pool,
                    announcement=record["announcement"],
                    customer_profile=record["customer_profile"],
                    winner_profile=supplier_profile,
                    supplier_scenario=supplier_scenario,
                    customer_scenario=record["customer_scenario"],
                    category=record["category"],
                    status_code=record["status_code"],
                    record_index=record_index,
                )
                for contract_payload in contract_pair:
                    supplier_profile["contracts"].append(contract_payload["contract"])
                    supplier_profile["contract_units"].extend(contract_payload["units"])
                    supplier_profile["acts"].extend(contract_payload["acts"])

                complaints_created.extend(
                    build_related_complaints(
                        id_pool=id_pool,
                        announcement=record["announcement"],
                        customer_profile=record["customer_profile"],
                        bidder_profiles=bidder_profiles,
                        winner_profile=supplier_profile,
                        supplier_scenario=supplier_scenario,
                        customer_scenario=record["customer_scenario"],
                        contracts=contract_pair,
                    )
                )

                if supplier_scenario == "risky" and str(supplier_profile["subject"]["bin"]) not in rnu_suppliers_used and len(rnu_suppliers_used) < 12:
                    rnu_entry = build_rnu_entry(id_pool, supplier_profile, record["customer_profile"], record_index)
                    supplier_profile["rnu_entries"].append(rnu_entry)
                    rnu_suppliers_used.add(str(supplier_profile["subject"]["bin"]))
            else:
                complaints_created.extend(
                    build_related_complaints(
                        id_pool=id_pool,
                        announcement=record["announcement"],
                        customer_profile=record["customer_profile"],
                        bidder_profiles=bidder_profiles,
                        winner_profile=None,
                        supplier_scenario="medium",
                        customer_scenario=record["customer_scenario"],
                        contracts=[],
                    )
                )

        complaints_created = complaints_created[:44]
        for complaint in complaints_created:
            supplier_profile = profiles_by_bin[str(complaint["supplier_bin"])]
            supplier_profile["complaints"].append(complaint)

        ensure_rnu_volume(id_pool, profiles_by_bin, supplier_groups["risky"], customer_groups["problem"], rnu_suppliers_used)

    rebalance_target_ranges(id_pool, profiles_by_bin, supplier_groups, customer_groups)

    for profile in profiles:
        profile.setdefault("summary", {})
        profile["summary"]["data_source"] = "Локальная demo-база OWS-формата"
        sort_profile_collections(profile)

    SEED_PATH.write_text(json.dumps(profiles, ensure_ascii=False, indent=2), encoding="utf-8")

    print_summary(profiles)


def build_id_pool(profiles: list[dict]) -> IdPool:
    max_pid = max(int(profile["subject"].get("pid") or 0) for profile in profiles)
    max_address = max((int(address.get("id") or 0) for profile in profiles for address in profile.get("subject_addresses", [])), default=0)
    max_employee = max((int(employee.get("id") or 0) for profile in profiles for employee in profile.get("subject_employees", [])), default=0)
    max_announcement = max((int(announcement.get("id") or 0) for profile in profiles for announcement in profile.get("trd_buys", [])), default=0)
    max_protocol = max((int(application.get("prot_id") or 0) for profile in profiles for application in profile.get("trd_apps", [])), default=0)
    max_contract = max((int(contract.get("id") or 0) for profile in profiles for contract in profile.get("contracts", [])), default=0)
    max_contract_unit = max((int(item.get("id") or 0) for profile in profiles for item in profile.get("contract_units", [])), default=0)
    max_plan_point = max((int(item.get("pln_point_id") or 0) for profile in profiles for item in profile.get("contract_units", [])), default=0)
    max_act = max((int(act.get("id") or 0) for profile in profiles for act in profile.get("acts", [])), default=0)
    max_complaint = max((extract_numeric_suffix(complaint.get("id")) for profile in profiles for complaint in profile.get("complaints", [])), default=0)
    max_rnu = max((extract_numeric_suffix(entry.get("id")) for profile in profiles for entry in profile.get("rnu_entries", [])), default=0)

    return IdPool(
        pid=max_pid + 1,
        address=max_address + 1,
        employee=max_employee + 1,
        announcement=max(max_announcement + 1, 560000),
        protocol=max(max_protocol + 1, 980000),
        contract=max(max_contract + 1, 780000),
        contract_unit=max(max_contract_unit + 1, 890000),
        plan_point=max(max_plan_point + 1, 930000),
        act=max(max_act + 1, 860000),
        complaint=max(max_complaint + 1, 5000),
        rnu=max(max_rnu + 1, 700),
    )


def extract_numeric_suffix(value) -> int:
    text = str(value or "")
    digits = "".join(ch for ch in text if ch.isdigit())
    return int(digits) if digits else 0


def next_bin(seed: str) -> str:
    return seed


def create_additional_profiles(id_pool: IdPool) -> list[dict]:
    profiles: list[dict] = []

    customer_bins = [
        "240140900001", "240140900002", "240140900003", "240140900004", "240140900005",
        "240140900006", "240140900007", "240140900008", "240140900009", "240140900010", "240140900011",
    ]
    supplier_bins = ["240140910001", "240140910002"]
    organizer_bins = ["240140920001"]
    neutral_bins = [
        "240140930001", "240140930002", "240140930003", "240140930004",
        "240140930005", "240140930006", "240140930007", "240140930008",
    ]

    for (name_ru, scenario, region_index), bin_value in zip(CUSTOMER_SPECS, customer_bins):
        profiles.append(make_profile(id_pool, bin_value, name_ru, region_index, customer=1, organizer=0, supplier=0, scenario=scenario))

    for (name_ru, region_index), bin_value in zip(SUPPLIER_SPECS, supplier_bins):
        profiles.append(make_profile(id_pool, bin_value, name_ru, region_index, customer=0, organizer=0, supplier=1, scenario="medium"))

    for (name_ru, region_index), bin_value in zip(ORGANIZER_SPECS, organizer_bins):
        profiles.append(make_profile(id_pool, bin_value, name_ru, region_index, customer=0, organizer=1, supplier=0, scenario="good"))

    for (name_ru, region_index), bin_value in zip(NEUTRAL_SPECS, neutral_bins):
        profiles.append(make_profile(id_pool, bin_value, name_ru, region_index, customer=0, organizer=0, supplier=0, scenario="neutral"))

    return profiles


def make_profile(
    id_pool: IdPool,
    bin_value: str,
    name_ru: str,
    region_index: int,
    *,
    customer: int,
    organizer: int,
    supplier: int,
    scenario: str,
) -> dict:
    pid = id_pool.pid
    id_pool.pid += 1
    region = REGIONS[region_index % len(REGIONS)]
    reg_year = 2014 + (pid % 9)
    reg_date = datetime(reg_year, 2 + (pid % 9), 5 + (pid % 17), 10, 0, 0)
    address_base = f"г. {region['city']}, {region['district']}, ул. {street_name(pid)}, д. {10 + (pid % 60)}"
    head_name = director_name(pid)

    subject = {
        "pid": pid,
        "bin": bin_value,
        "iin": None,
        "inn": None,
        "unp": None,
        "parent_subject": None,
        "parent_name_kz": None,
        "parent_name_ru": None,
        "regdate": dt(reg_date),
        "crdate": dt(reg_date + timedelta(days=10)),
        "index_date": dt(datetime(2026, 4, 20, 10, 0, 0)),
        "number_reg": str(pid).zfill(6),
        "series": None,
        "name_ru": name_ru,
        "name_kz": name_ru.replace("ТОО", "ЖШС").replace("АО", "АҚ"),
        "full_name_ru": name_ru,
        "full_name_kz": name_ru.replace("ТОО", "ЖШС").replace("АО", "АҚ"),
        "country_code": 398,
        "customer": customer,
        "organizer": organizer,
        "mark_national_company": 1 if "АО" in name_ru and organizer else 0,
        "ref_kopf_code": "105" if "ТОО" in name_ru else "124",
        "mark_assoc_with_disab": 1 if scenario == "neutral" and pid % 3 == 0 else 0,
        "system_id": 3,
        "supplier": supplier,
        "type_supplier": 1,
        "krp_code": "3",
        "oked_list": [oked_for_name(name_ru, customer, organizer, supplier)],
        "kse_code": "210",
        "mark_resident": 1,
        "participant_status": "Активный",
        "email": email_for_name(name_ru),
        "website": website_for_name(name_ru),
    }

    addresses = [
        {
            "id": id_pool.address,
            "pid": pid,
            "ref_source_code": 1,
            "address_type": 1,
            "address": address_base,
            "kato_code": region["kato"],
            "phone": f"+7 ({region['phone']}) 555-{20 + (pid % 70):02d}-{10 + (pid % 80):02d}",
            "country_code": 398,
            "date_create": dt(reg_date + timedelta(days=1)),
            "edit_date": dt(datetime(2025, 11, 10, 10, 0, 0)),
            "index_date": dt(datetime(2026, 4, 20, 10, 0, 0)),
        },
        {
            "id": id_pool.address + 1,
            "pid": pid,
            "ref_source_code": 1,
            "address_type": 2,
            "address": f"г. {region['city']}, {region['district']}, пр. {avenue_name(pid)}, д. {14 + (pid % 45)}",
            "kato_code": region["kato"],
            "phone": f"+7 ({region['phone']}) 555-{25 + (pid % 70):02d}-{15 + (pid % 80):02d}",
            "country_code": 398,
            "date_create": dt(reg_date + timedelta(days=2)),
            "edit_date": dt(datetime(2025, 12, 5, 10, 0, 0)),
            "index_date": dt(datetime(2026, 4, 20, 10, 0, 0)),
        },
    ]
    id_pool.address += 2

    employees = [
        {
            "id": id_pool.employee,
            "pid": pid,
            "iin": fake_iin(pid, 1),
            "resident": 1,
            "fio": head_name,
            "disabled": 0,
            "role": 1,
            "sys_role_id": 1,
            "start_date": dt(reg_date + timedelta(days=15)),
            "end_date": "1999-01-01 00:00:00",
            "edit_date": dt(datetime(2025, 11, 10, 10, 0, 0)),
            "index_date": dt(datetime(2026, 4, 20, 10, 0, 0)),
        },
        {
            "id": id_pool.employee + 1,
            "pid": pid,
            "iin": fake_iin(pid, 2),
            "resident": 1,
            "fio": specialist_name(pid),
            "disabled": 0,
            "role": 2,
            "sys_role_id": 4,
            "start_date": dt(reg_date + timedelta(days=20)),
            "end_date": "1999-01-01 00:00:00",
            "edit_date": dt(datetime(2025, 11, 15, 10, 0, 0)),
            "index_date": dt(datetime(2026, 4, 20, 10, 0, 0)),
        },
    ]
    id_pool.employee += 2

    return {
        "subject": subject,
        "subject_addresses": addresses,
        "subject_employees": employees,
        "trd_buys": [],
        "trd_apps": [],
        "contracts": [],
        "contract_units": [],
        "acts": [],
        "rnu_entries": [],
        "summary": {"data_source": "Локальная demo-база OWS-формата"},
        "complaints": [],
    }


def build_announcement_bundle(
    *,
    id_pool: IdPool,
    customer_profile: dict,
    organizer_profile: dict,
    customer_scenario: str,
    sequence_index: int,
) -> dict:
    category_info = ANNOUNCEMENT_CATALOG[sequence_index % len(ANNOUNCEMENT_CATALOG)]
    title = category_info["titles"][sequence_index % len(category_info["titles"])]
    amount_min, amount_max = category_info["amount_range"]
    total_sum = round(RNG.uniform(amount_min, amount_max), 2)
    announcement_id = id_pool.announcement
    id_pool.announcement += 1

    if customer_scenario == "good":
        status_code = 340 if sequence_index % 3 != 1 else 320
        method_id = [1, 7, 31][sequence_index % 3]
    elif customer_scenario == "medium":
        status_code = [340, 320, 390][sequence_index % 3]
        method_id = [31, 1, 2][sequence_index % 3]
    else:
        status_code = [340, 380, 390][sequence_index % 3]
        method_id = [2, 2, 31][sequence_index % 3]

    publish_date = datetime(2024, 1, 10, 10, 0, 0) + timedelta(days=sequence_index * 6)
    start_date = publish_date + timedelta(days=2)
    end_date = start_date + timedelta(days=8 + (sequence_index % 6))
    customer_subject = customer_profile["subject"]
    organizer_subject = organizer_profile["subject"]
    announcement = {
        "id": announcement_id,
        "number_anno": f"{announcement_id}-{1}",
        "name_ru": title,
        "name_kz": title,
        "total_sum": total_sum,
        "count_lots": 1,
        "ref_trade_methods_id": method_id,
        "ref_subject_type_id": 3,
        "customer_bin": customer_subject["bin"],
        "customer_pid": customer_subject["pid"],
        "customer_name_ru": customer_subject["name_ru"],
        "customer_name_kz": customer_subject["name_kz"],
        "org_bin": organizer_subject["bin"],
        "org_pid": organizer_subject["pid"],
        "org_name_ru": organizer_subject["name_ru"],
        "org_name_kz": organizer_subject["name_kz"],
        "publish_date": dt(publish_date),
        "start_date": dt(start_date),
        "end_date": dt(end_date),
        "ref_buy_status_id": status_code,
        "system_id": 3,
        "index_date": dt(datetime(2026, 4, 20, 10, 0, 0)),
    }
    return {
        "announcement": announcement,
        "customer_profile": customer_profile,
        "customer_scenario": customer_scenario,
        "category": category_info,
        "base_amount": total_sum,
        "status_code": status_code,
    }


def choose_bidders(customer_scenario: str, status_code: int, supplier_groups: dict, supplier_profiles: list[dict], announcement_id: int) -> list[dict]:
    if customer_scenario == "good":
        bid_count = 6 + (announcement_id % 3)
        pool = supplier_groups["ideal"] + supplier_groups["medium"] + supplier_groups["medium"]
    elif customer_scenario == "medium":
        bid_count = 4 + (announcement_id % 3)
        pool = supplier_groups["medium"] + supplier_groups["ideal"] + supplier_groups["risky"]
    else:
        bid_count = 2 + (announcement_id % 2)
        pool = supplier_groups["risky"] + supplier_groups["medium"] + supplier_groups["risky"]

    if status_code in {380, 390}:
        bid_count = max(1, bid_count - 1)

    unique_pool = dedupe_profiles(pool)
    if len(unique_pool) < bid_count:
        unique_pool = dedupe_profiles(unique_pool + supplier_profiles)

    ordered_pool = sorted(unique_pool, key=lambda item: (item["subject"]["pid"] + announcement_id) % 97)
    return ordered_pool[:bid_count]


def build_applications_for_announcement(id_pool: IdPool, announcement: dict, bidder_profiles: list[dict], category_info: dict, total_sum: float) -> list[dict]:
    applications = []
    winner_name = bidder_profiles[0]["subject"]["name_ru"] if bidder_profiles else None

    for place_index, bidder_profile in enumerate(bidder_profiles, start=1):
        supplier_subject = bidder_profile["subject"]
        supplier_scenario = infer_scenario_from_supplier_name(supplier_subject["name_ru"])
        discount_base = {
            "ideal": RNG.uniform(0.03, 0.08),
            "medium": RNG.uniform(0.05, 0.12),
            "risky": RNG.uniform(0.08, 0.18),
        }.get(supplier_scenario, RNG.uniform(0.05, 0.10))
        amount = round(total_sum * (1 - discount_base), 2)
        application_id = f"{supplier_subject['pid']}-{announcement['id']}"
        applications.append(
            {
                "id": application_id,
                "buy_id": announcement["id"],
                "supplier_id": supplier_subject["pid"],
                "cr_fio": bidder_profile["subject_employees"][0]["fio"],
                "mod_fio": bidder_profile["subject_employees"][-1]["fio"],
                "supplier_bin_iin": supplier_subject["bin"],
                "prot_id": id_pool.protocol,
                "prot_number": f"ПИ-{announcement['id']}",
                "date_apply": dt(parse_dt(announcement["start_date"]) + timedelta(days=place_index)),
                "app_lots": [
                    {
                        "id": f"{announcement['id']}-lot-{supplier_subject['pid']}",
                        "lot_id": int(f"{announcement['id']}1"),
                        "lot_number": f"{announcement['number_anno']}/1",
                        "name_ru": announcement["name_ru"],
                        "quantity": 1,
                        "price": total_sum,
                        "price_offer": amount,
                        "amount": amount,
                        "ref_lot_status_id": 320 if announcement["ref_buy_status_id"] == 340 else 310,
                        "category": category_info["category"],
                        "winner_name": winner_name,
                    }
                ],
                "status": "Подана",
                "result": "В процессе",
                "place": place_index,
            }
        )
        id_pool.protocol += 1
    return applications


def annotate_application_results(applications: list[dict], winner_application: dict | None, finalized: bool) -> None:
    if not applications:
        return

    ranked = sorted(applications, key=lambda item: item["app_lots"][0]["price_offer"])
    for place_index, application in enumerate(ranked, start=1):
        application["place"] = place_index
        if winner_application and application["id"] == winner_application["id"]:
            application["status"] = "Победила" if finalized else "Лидер"
            application["result"] = "Победитель" if finalized else "Ожидает заключения договора"
        elif finalized:
            application["status"] = "Отклонена" if place_index > 3 and place_index % 2 == 0 else "Подана"
            application["result"] = "Проиграл"
        else:
            application["status"] = "Подана"
            application["result"] = "Рассматривается"


def build_contract_pair(
    *,
    id_pool: IdPool,
    announcement: dict,
    customer_profile: dict,
    winner_profile: dict,
    supplier_scenario: str,
    customer_scenario: str,
    category: dict,
    status_code: int,
    record_index: int,
) -> list[dict]:
    contracts: list[dict] = []
    customer_subject = customer_profile["subject"]
    supplier_subject = winner_profile["subject"]
    base_contract_id = id_pool.contract
    id_pool.contract += 1

    main_status = 320 if status_code == 320 else determine_contract_status(supplier_scenario, customer_scenario, record_index)
    base_sum = round(float(announcement["total_sum"]) * RNG.uniform(0.88, 0.99), 2)
    root_id = base_contract_id
    main_contract = make_contract(
        contract_id=base_contract_id,
        root_id=root_id,
        parent_id=None,
        announcement=announcement,
        supplier_subject=supplier_subject,
        customer_subject=customer_subject,
        contract_sum=base_sum,
        status_id=main_status,
        sign_date=parse_dt(announcement["end_date"]) + timedelta(days=7),
        suffix="",
    )
    main_units = build_contract_units(id_pool, main_contract, category, main_status)
    main_acts = build_acts(id_pool, main_contract, supplier_subject["pid"], customer_subject["pid"], main_status, category["category"], extra=(record_index % 2 == 0))
    contracts.append({"contract": main_contract, "units": main_units, "acts": main_acts})

    create_amendment = record_index < 21
    if create_amendment:
        amendment_id = id_pool.contract
        id_pool.contract += 1
        amendment_status = 320 if main_status == 320 else (390 if supplier_scenario == "risky" and record_index % 5 == 0 else 350)
        amendment_sum = round(base_sum * RNG.uniform(0.12, 0.24), 2)
        amendment_contract = make_contract(
            contract_id=amendment_id,
            root_id=root_id,
            parent_id=base_contract_id,
            announcement=announcement,
            supplier_subject=supplier_subject,
            customer_subject=customer_subject,
            contract_sum=amendment_sum,
            status_id=amendment_status,
            sign_date=parse_dt(main_contract["crdate"]) + timedelta(days=35 + (record_index % 20)),
            suffix="/ДС1",
        )
        amendment_units = build_contract_units(id_pool, amendment_contract, category, amendment_status)
        amendment_acts = build_acts(id_pool, amendment_contract, supplier_subject["pid"], customer_subject["pid"], amendment_status, category["category"], extra=False)
        contracts.append({"contract": amendment_contract, "units": amendment_units, "acts": amendment_acts})

    return contracts


def make_contract(
    *,
    contract_id: int,
    root_id: int,
    parent_id: int | None,
    announcement: dict,
    supplier_subject: dict,
    customer_subject: dict,
    contract_sum: float,
    status_id: int,
    sign_date: datetime,
    suffix: str,
) -> dict:
    contract_number = f"{sign_date.year}/{customer_subject['pid']}/{supplier_subject['pid']}{suffix}"
    return {
        "id": contract_id,
        "parent_id": parent_id,
        "root_id": root_id,
        "trd_buy_id": announcement["id"],
        "trd_buy_number_anno": announcement["number_anno"],
        "ref_amendm_agreem_justif_id": None,
        "ref_contract_status_id": status_id,
        "deleted": 0,
        "crdate": dt(sign_date),
        "last_update_date": dt(sign_date + timedelta(days=45)),
        "supplier_id": supplier_subject["pid"],
        "supplier_biin": supplier_subject["bin"],
        "supplier_bik": None,
        "supplier_iik": None,
        "supplier_bank_name_kz": None,
        "supplier_bank_name_ru": "АО \"Народный Банк Казахстана\"",
        "contract_number": contract_number,
        "sign_reason_doc_name": "Протокол итогов",
        "sign_reason_doc_date": dt(sign_date - timedelta(days=4)),
        "trd_buy_itogi_date_public": dt(sign_date - timedelta(days=7)),
        "customer_id": customer_subject["pid"],
        "customer_bin": customer_subject["bin"],
        "customer_bik": None,
        "customer_iik": None,
        "customer_bank_name_kz": None,
        "customer_bank_name_ru": "АО \"Казпочта\"",
        "customer_name_ru": customer_subject["name_ru"],
        "customer_name_kz": customer_subject["name_kz"],
        "contract_number_sys": f"SYS-{contract_id}",
        "fin_year": sign_date.year,
        "ref_contract_agr_form_id": 1,
        "ref_contract_year_type_id": 1,
        "ref_contract_type_id": 1,
        "contract_sum": contract_sum,
        "contract_sum_wnds": contract_sum,
        "system_id": 3,
        "index_date": dt(sign_date + timedelta(days=50)),
    }


def build_contract_units(id_pool: IdPool, contract: dict, category: dict, status_id: int) -> list[dict]:
    units = []
    shares = [0.34, 0.31, 0.35]
    for idx, share in enumerate(shares, start=1):
        total_sum = round(float(contract["contract_sum"]) * share, 2)
        if status_id == 350:
            fact_ratio = RNG.uniform(0.96, 1.0)
            execution_status = "Выполнено"
        elif status_id == 320:
            fact_ratio = RNG.uniform(0.45, 0.78)
            execution_status = "Частично выполнено"
        else:
            fact_ratio = RNG.uniform(0.05, 0.35)
            execution_status = "С задержкой"
        fact_sum = round(total_sum * fact_ratio, 2)
        units.append(
            {
                "id": id_pool.contract_unit,
                "contract_id": contract["id"],
                "lot_id": int(f"{contract['trd_buy_id']}1"),
                "pln_point_id": id_pool.plan_point,
                "item_price": round(total_sum / 10, 2),
                "item_price_wnds": round(total_sum / 10, 2),
                "quantity": 10,
                "total_sum": total_sum,
                "total_sum_wnds": total_sum,
                "fact_sum": fact_sum,
                "fact_sum_wnds": fact_sum,
                "ks_proc": round(RNG.uniform(42, 95), 2),
                "name_ru": category["items"][(idx - 1) % len(category["items"])],
                "execution_status": execution_status,
            }
        )
        id_pool.contract_unit += 1
        id_pool.plan_point += 1
    return units


def build_extra_contract_unit(id_pool: IdPool, contract: dict) -> dict:
    total_sum = round(float(contract["contract_sum"]) * 0.08, 2)
    if int(contract.get("ref_contract_status_id") or 0) == 350:
        fact_sum = total_sum
        execution_status = "Выполнено"
    elif int(contract.get("ref_contract_status_id") or 0) == 320:
        fact_sum = round(total_sum * 0.6, 2)
        execution_status = "Частично выполнено"
    else:
        fact_sum = round(total_sum * 0.15, 2)
        execution_status = "С задержкой"
    unit = {
        "id": id_pool.contract_unit,
        "contract_id": contract["id"],
        "lot_id": int(f"{contract['trd_buy_id']}1"),
        "pln_point_id": id_pool.plan_point,
        "item_price": round(total_sum / 4, 2),
        "item_price_wnds": round(total_sum / 4, 2),
        "quantity": 4,
        "total_sum": total_sum,
        "total_sum_wnds": total_sum,
        "fact_sum": fact_sum,
        "fact_sum_wnds": fact_sum,
        "ks_proc": round(RNG.uniform(38, 88), 2),
        "name_ru": "Пусконаладочные и сопутствующие работы",
        "execution_status": execution_status,
    }
    id_pool.contract_unit += 1
    id_pool.plan_point += 1
    return unit


def build_acts(id_pool: IdPool, contract: dict, supplier_id: int, customer_id: int, status_id: int, category_name: str, extra: bool) -> list[dict]:
    acts = []
    act_count = 2 if extra else 1
    if status_id == 390 and not extra:
        act_count = 1 if contract["id"] % 2 == 0 else 0

    for idx in range(act_count):
        act_date = parse_dt(contract["crdate"]) + timedelta(days=35 + idx * 40)
        if status_id == 350:
            overdue = 0 if idx == 0 else RNG.randint(0, 4)
            fine_sum = 0 if overdue == 0 else round(RNG.uniform(45_000, 120_000), 2)
            status_name = "Подписан"
        elif status_id == 320:
            overdue = RNG.randint(3, 18)
            fine_sum = round(RNG.uniform(80_000, 260_000), 2) if overdue > 8 else 0
            status_name = "На согласовании"
        else:
            overdue = RNG.randint(12, 45)
            fine_sum = round(RNG.uniform(180_000, 780_000), 2)
            status_name = "Возвращен на доработку"

        acts.append(
            {
                "id": id_pool.act,
                "akt_date": dt(act_date),
                "number_act": f"ACT-{contract['id']}-{idx + 1}",
                "approve_date": dt(act_date + timedelta(days=5)),
                "create_date_act": dt(act_date - timedelta(days=2)),
                "contract_root_id": contract["root_id"],
                "contract_id": contract["id"],
                "status_id": 1 if status_id == 350 else 2,
                "is_deleted": 0,
                "day_overdue": overdue,
                "sum_avans": 0,
                "sum_beginning": round(float(contract["contract_sum"]) * (0.2 if idx == 0 else 0.1), 2),
                "sum_fine": fine_sum,
                "sum_previously": round(float(contract["contract_sum"]) * 0.15, 2),
                "sum_transfer": round(float(contract["contract_sum"]) * (0.25 if status_id != 390 else 0.08), 2),
                "create_date_gen_info": dt(act_date - timedelta(days=4)),
                "status_name_ru": status_name,
                "status_name_kz": status_name,
                "supplier_id": supplier_id,
                "customer_id": customer_id,
                "is_gu": 0,
                "type_act": 1,
                "ref_subject_type_id": 3,
                "parent_id": None,
                "system_id": 3,
                "index_date": dt(act_date + timedelta(days=12)),
                "description": f"{category_name}: подтверждение этапа исполнения обязательств по договору.",
            }
        )
        id_pool.act += 1
    return acts


def build_related_complaints(
    *,
    id_pool: IdPool,
    announcement: dict,
    customer_profile: dict,
    bidder_profiles: list[dict],
    winner_profile: dict | None,
    supplier_scenario: str,
    customer_scenario: str,
    contracts: list[dict],
) -> list[dict]:
    complaints: list[dict] = []
    customer_subject = customer_profile["subject"]

    if supplier_scenario == "risky" and winner_profile is not None and contracts:
        main_contract = contracts[0]["contract"]
        complaints.append(
            make_complaint(
                id_pool=id_pool,
                applicant_profile=bidder_profiles[min(1, len(bidder_profiles) - 1)],
                supplier_profile=winner_profile,
                customer_profile=customer_profile,
                subject=COMPLAINT_EXECUTION_SUBJECTS[id_pool.complaint % len(COMPLAINT_EXECUTION_SUBJECTS)],
                description="Поставщик нарушил сроки исполнения обязательств и представил неполный комплект подтверждающих документов.",
                status="Удовлетворена" if id_pool.complaint % 2 == 0 else "На рассмотрении",
                decision="Жалоба признана обоснованной, заказчику рекомендовано применить меры." if id_pool.complaint % 2 == 0 else "Проводится проверка документов и исполнения договора.",
                related_tender_id=announcement["id"],
                related_contract_id=main_contract["id"],
            )
        )

    if customer_scenario == "problem" and bidder_profiles:
        affected_supplier = bidder_profiles[-1]
        complaints.append(
            make_complaint(
                id_pool=id_pool,
                applicant_profile=affected_supplier,
                supplier_profile=affected_supplier,
                customer_profile=customer_profile,
                subject=COMPLAINT_PROCUREMENT_SUBJECTS[id_pool.complaint % len(COMPLAINT_PROCUREMENT_SUBJECTS)],
                description="Участник считает, что условия закупки и порядок рассмотрения заявок ограничивали конкуренцию.",
                status="Удовлетворена" if announcement["ref_trade_methods_id"] == 2 else "Отклонена",
                decision="Нарушение процедуры подтверждено частично." if announcement["ref_trade_methods_id"] == 2 else "Оснований для удовлетворения жалобы не установлено.",
                related_tender_id=announcement["id"],
                related_contract_id=contracts[0]["contract"]["id"] if contracts else None,
            )
        )

    if customer_scenario == "medium" and bidder_profiles and announcement["ref_buy_status_id"] in {390, 380}:
        applicant = bidder_profiles[0]
        complaints.append(
            make_complaint(
                id_pool=id_pool,
                applicant_profile=applicant,
                supplier_profile=applicant,
                customer_profile=customer_profile,
                subject="Нарушение сроков подведения итогов",
                description="Итоги процедуры были подведены с отклонением от заявленного графика, что вызвало обращение участника.",
                status="На рассмотрении",
                decision="Поступившее обращение передано на рассмотрение уполномоченному органу.",
                related_tender_id=announcement["id"],
                related_contract_id=None,
            )
        )

    return complaints


def make_complaint(
    *,
    id_pool: IdPool,
    applicant_profile: dict,
    supplier_profile: dict,
    customer_profile: dict,
    subject: str,
    description: str,
    status: str,
    decision: str,
    related_tender_id: int | None,
    related_contract_id: int | None,
) -> dict:
    applicant_subject = applicant_profile["subject"]
    supplier_subject = supplier_profile["subject"]
    customer_subject = customer_profile["subject"]
    complaint_number = f"Ж-{datetime(2025, 1, 1).year}-{id_pool.complaint}"
    payload = {
        "id": f"complaint-{id_pool.complaint}",
        "complaint_number": complaint_number,
        "date": dt(datetime(2025, 1, 15, 10, 0, 0) + timedelta(days=id_pool.complaint % 420)),
        "applicant_name": applicant_subject["name_ru"],
        "applicant_bin": applicant_subject["bin"],
        "supplier_id": supplier_subject["pid"],
        "supplier_bin": supplier_subject["bin"],
        "supplier_name": supplier_subject["name_ru"],
        "customer_name": customer_subject["name_ru"],
        "customer_bin": customer_subject["bin"],
        "related_tender_id": related_tender_id,
        "related_contract_id": related_contract_id,
        "subject": subject,
        "description": description,
        "status": status,
        "decision": decision,
    }
    id_pool.complaint += 1
    return payload


def build_rnu_entry(id_pool: IdPool, supplier_profile: dict, customer_profile: dict, index: int) -> dict:
    subject = supplier_profile["subject"]
    customer_subject = customer_profile["subject"]
    kato_code = supplier_profile["subject_addresses"][0]["kato_code"] if supplier_profile.get("subject_addresses") else "711110000"
    entry = {
        "id": f"rnu-{id_pool.rnu}",
        "pid": subject["pid"],
        "supplier_biin": subject["bin"],
        "supplier_innunp": None,
        "supplier_name_ru": subject["name_ru"],
        "supplier_name_kz": subject["name_kz"],
        "kato_list": [kato_code],
        "index_date": dt(datetime(2026, 4, 20, 10, 0, 0)),
        "customer_name_ru": customer_subject["name_ru"],
        "customer_name_kz": customer_subject["name_kz"],
        "customer_biin": customer_subject["bin"],
        "start_date": dt(datetime(2025, 3, 1, 10, 0, 0) + timedelta(days=index * 6)),
        "end_date": dt(datetime(2027, 3, 1, 10, 0, 0) + timedelta(days=index * 6)),
        "ref_reason_id": 1 + (index % 3),
        "court_decision": "Решение суда о включении в реестр недобросовестных участников вступило в законную силу.",
    }
    id_pool.rnu += 1
    return entry


def ensure_rnu_volume(id_pool: IdPool, profiles_by_bin: dict[str, dict], risky_suppliers: list[dict], problem_customers: list[dict], rnu_suppliers_used: set[str]) -> None:
    customer_cycle = problem_customers or list(profiles_by_bin.values())[:1]
    for supplier in risky_suppliers:
        supplier_bin = str(supplier["subject"]["bin"])
        if supplier_bin in rnu_suppliers_used:
            continue
        customer_profile = customer_cycle[len(rnu_suppliers_used) % len(customer_cycle)]
        supplier["rnu_entries"].append(build_rnu_entry(id_pool, supplier, customer_profile, len(rnu_suppliers_used)))
        rnu_suppliers_used.add(supplier_bin)
        if len(rnu_suppliers_used) >= 12:
            break


def rebalance_target_ranges(id_pool: IdPool, profiles_by_bin: dict[str, dict], supplier_groups: dict, customer_groups: dict) -> None:
    supplier_profiles = [profile for profile in profiles_by_bin.values() if int(profile["subject"].get("supplier") or 0) == 1]
    customer_profiles = [profile for profile in profiles_by_bin.values() if int(profile["subject"].get("customer") or 0) == 1]

    target_units = 200
    current_units = sum(len(profile.get("contract_units", [])) for profile in supplier_profiles)
    if current_units < target_units:
        needed_units = target_units - current_units
        candidate_contracts = [
            (profile, contract)
            for profile in supplier_profiles
            for contract in profile.get("contracts", [])
            if int(contract.get("id") or 0) >= 780000
        ]
        for unit_index in range(needed_units):
            profile, contract = candidate_contracts[unit_index % len(candidate_contracts)]
            profile["contract_units"].append(build_extra_contract_unit(id_pool, contract))

    target_complaints = 44
    current_complaints = sum(len(profile.get("complaints", [])) for profile in supplier_profiles)
    if current_complaints < target_complaints:
        needed_complaints = target_complaints - current_complaints
        risky_and_medium = supplier_groups["risky"] + supplier_groups["medium"]
        customer_cycle = customer_groups["problem"] + customer_groups["medium"] + customer_profiles
        for complaint_index in range(needed_complaints):
            supplier_profile = risky_and_medium[complaint_index % len(risky_and_medium)]
            customer_profile = customer_cycle[complaint_index % len(customer_cycle)]
            related_contract = next((contract for contract in reversed(supplier_profile.get("contracts", [])) if contract.get("customer_bin") == customer_profile["subject"]["bin"]), None)
            related_tender_id = related_contract.get("trd_buy_id") if related_contract else None
            complaint = make_complaint(
                id_pool=id_pool,
                applicant_profile=supplier_profile,
                supplier_profile=supplier_profile,
                customer_profile=customer_profile,
                subject=COMPLAINT_EXECUTION_SUBJECTS[complaint_index % len(COMPLAINT_EXECUTION_SUBJECTS)] if complaint_index % 2 == 0 else COMPLAINT_PROCUREMENT_SUBJECTS[complaint_index % len(COMPLAINT_PROCUREMENT_SUBJECTS)],
                description="Дополнительное demo-обращение по спорной процедуре или исполнению обязательств, связанное с существующей закупочной цепочкой.",
                status=["Отклонена", "Удовлетворена", "На рассмотрении"][complaint_index % 3],
                decision=[
                    "Оснований для удовлетворения жалобы не установлено.",
                    "Нарушение подтверждено, заказчику направлено предписание.",
                    "Обращение находится на стадии рассмотрения.",
                ][complaint_index % 3],
                related_tender_id=related_tender_id,
                related_contract_id=related_contract.get("id") if related_contract else None,
            )
            supplier_profile["complaints"].append(complaint)

    target_rnu = 12
    current_rnu = sum(len(profile.get("rnu_entries", [])) for profile in supplier_profiles)
    if current_rnu < target_rnu:
        needed_rnu = target_rnu - current_rnu
        candidate_suppliers = supplier_groups["risky"] + supplier_groups["medium"]
        customer_cycle = customer_groups["problem"] + customer_groups["medium"] + customer_profiles
        existing_bins = {
            str(profile["subject"]["bin"])
            for profile in candidate_suppliers
            if profile.get("rnu_entries")
        }
        added = 0
        for supplier_profile in candidate_suppliers:
            supplier_bin = str(supplier_profile["subject"]["bin"])
            if supplier_bin in existing_bins:
                continue
            customer_profile = customer_cycle[added % len(customer_cycle)]
            supplier_profile["rnu_entries"].append(build_rnu_entry(id_pool, supplier_profile, customer_profile, added))
            existing_bins.add(supplier_bin)
            added += 1
            if added >= needed_rnu:
                break


def determine_contract_status(supplier_scenario: str, customer_scenario: str, record_index: int) -> int:
    if supplier_scenario == "risky":
        return 390 if record_index % 2 == 0 else 320
    if customer_scenario == "problem" and record_index % 3 == 0:
        return 390
    if record_index % 5 == 0:
        return 320
    return 350


def get_supplier_scenario(profile: dict, supplier_groups: dict) -> str:
    for scenario, profiles in supplier_groups.items():
        if any(int(candidate["subject"]["pid"]) == int(profile["subject"]["pid"]) for candidate in profiles):
            return scenario
    return "medium"


def infer_scenario_from_supplier_name(name_ru: str) -> str:
    lowered = name_ru.lower()
    if any(marker in lowered for marker in ("safety", "service", "analytics", "digital", "telecom")):
        return "ideal"
    if any(marker in lowered for marker in ("marine", "supply", "trade", "integrator")):
        return "medium"
    return "risky" if any(marker in lowered for marker in ("construction", "clean", "agro")) else "medium"


def dedupe_profiles(profiles: list[dict]) -> list[dict]:
    unique: dict[str, dict] = {}
    for profile in profiles:
        unique[str(profile["subject"]["bin"])] = profile
    return list(unique.values())


def sort_profile_collections(profile: dict) -> None:
    profile["trd_buys"].sort(key=lambda item: int(item.get("id") or 0))
    profile["trd_apps"].sort(key=lambda item: str(item.get("id") or ""))
    profile["contracts"].sort(key=lambda item: int(item.get("id") or 0))
    profile["contract_units"].sort(key=lambda item: int(item.get("id") or 0))
    profile["acts"].sort(key=lambda item: int(item.get("id") or 0))
    profile["complaints"].sort(key=lambda item: str(item.get("id") or ""))
    profile["rnu_entries"].sort(key=lambda item: str(item.get("id") or ""))


def print_summary(profiles: list[dict]) -> None:
    suppliers = sum(1 for profile in profiles if int(profile["subject"].get("supplier") or 0) == 1)
    customers = sum(1 for profile in profiles if int(profile["subject"].get("customer") or 0) == 1)
    organizers = sum(1 for profile in profiles if int(profile["subject"].get("organizer") or 0) == 1 or int(profile["subject"].get("is_single_org") or 0) == 1)
    announcements = sum(len(profile.get("trd_buys", [])) for profile in profiles)
    bids = sum(len(profile.get("trd_apps", [])) for profile in profiles)
    lots = sum(len(application.get("app_lots", [])) for profile in profiles for application in profile.get("trd_apps", []))
    contracts = sum(len(profile.get("contracts", [])) for profile in profiles)
    contract_units = sum(len(profile.get("contract_units", [])) for profile in profiles)
    acts = sum(len(profile.get("acts", [])) for profile in profiles)
    complaints = sum(len(profile.get("complaints", [])) for profile in profiles)
    rnu = sum(len(profile.get("rnu_entries", [])) for profile in profiles)
    print(
        json.dumps(
            {
                "profiles": len(profiles),
                "suppliers": suppliers,
                "customers": customers,
                "organizers": organizers,
                "announcements": announcements,
                "bids": bids,
                "lots": lots,
                "contracts": contracts,
                "contract_units": contract_units,
                "acts": acts,
                "complaints": complaints,
                "rnu": rnu,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def oked_for_name(name_ru: str, customer: int, organizer: int, supplier: int) -> str:
    if organizer:
        return "66.19"
    if customer:
        return "84.11"
    if "Digital" in name_ru or "IT" in name_ru or "информац" in name_ru.lower():
        return "62.01"
    if "Стро" in name_ru or "Construction" in name_ru:
        return "41.20"
    if "Supply" in name_ru or "поставка" in name_ru.lower():
        return "46.90"
    return "70.22" if supplier == 0 else "43.29"


def street_name(seed: int) -> str:
    names = ["Туран", "Достык", "Абая", "Сатпаева", "Мангилик Ел", "Кунаева", "Назарбаева", "Жандосова"]
    return names[seed % len(names)]


def avenue_name(seed: int) -> str:
    names = ["Сейфуллина", "Республики", "Тауелсиздик", "Аль-Фараби", "Кабанбай батыра", "Рыскулова"]
    return names[seed % len(names)]


def director_name(seed: int) -> str:
    first_names = ["АСЕТ", "ДАНИЯР", "ЕРНУР", "МАРАТ", "РУСЛАН", "АЙДЫН", "НУРБЕК", "ЕРКЕБУЛАН"]
    last_names = ["СЕРИКОВ", "КАСЫМОВ", "ОМАРОВ", "БАЙМУХАНОВ", "ТЛЕУБЕРГЕНОВ", "МУХАМЕДЖАНОВ", "ИСМАИЛОВ", "КУАНЫШЕВ"]
    middle_names = ["ЕРМЕКОВИЧ", "НУРЛАНОВИЧ", "БОЛАТОВИЧ", "СЕРИКУЛЫ", "КАЙРАТОВИЧ", "АЛТЫНБЕКУЛЫ"]
    return f"{last_names[seed % len(last_names)]} {first_names[seed % len(first_names)]} {middle_names[seed % len(middle_names)]}"


def specialist_name(seed: int) -> str:
    first_names = ["АЙГЕРИМ", "ЖАНАР", "МЕРУЕРТ", "АЛТЫНАЙ", "НУРСУЛУ", "ДИНАРА"]
    last_names = ["САДУАКАСОВА", "КАЛИЕВА", "ИМАНБАЕВА", "АМАНГЕЛЬДИЕВА", "ТАСБОЛАТОВА", "ОМАРОВА"]
    middle_names = ["НУРБЕКОВНА", "КАЙРАТОВНА", "МАРАТОВНА", "СЕРИКОВНА"]
    return f"{last_names[seed % len(last_names)]} {first_names[seed % len(first_names)]} {middle_names[seed % len(middle_names)]}"


def email_for_name(name_ru: str) -> str:
    slug = (
        name_ru.lower()
        .replace('тoo "', '')
        .replace('тоо "', '')
        .replace('ао "', '')
        .replace('"', '')
        .replace('«', '')
        .replace('»', '')
        .replace(' ', '-')
        .replace('№', 'n')
    )
    slug = "".join(ch for ch in slug if ch.isalnum() or ch in "-._")
    return f"info@{slug[:28]}.kz"


def website_for_name(name_ru: str) -> str:
    slug = (
        name_ru.lower()
        .replace('тoo "', '')
        .replace('тоо "', '')
        .replace('ао "', '')
        .replace('"', '')
        .replace('«', '')
        .replace('»', '')
        .replace(' ', '-')
    )
    slug = "".join(ch for ch in slug if ch.isalnum() or ch == "-")
    return f"https://{slug[:24]}.kz"


def fake_iin(seed: int, offset: int) -> str:
    return f"{(70 + seed % 20):02d}{(1 + seed % 12):02d}{(1 + offset + seed % 27):02d}{(100000 + seed * 17 + offset * 91) % 1000000:06d}"


def dt(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S")


def parse_dt(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")


if __name__ == "__main__":
    main()
