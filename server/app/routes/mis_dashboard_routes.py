from fastapi import APIRouter, Depends, Query, HTTPException, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, case, literal
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
import io
import pandas as pd

from app.database import SessionLocal
from app.models.matter import Matter
from app.models.client import Client
from app.models.product import Product
from app.models.forum import Forum, State, District
from app.models.local_counsel import LocalCounsel, MatterLocalCounsel
from app.models.user import User
from app.models.mis_config import MISConfig
from app.services.auth import get_current_user

router = APIRouter(tags=["MIS Dashboard"])


def get_formatted_today():
    today = datetime.today()
    return today.strftime("%d %B %Y")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def to_float(value):
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def apply_role_filter(query, current_user: User):
    role = (current_user.role or "").strip().lower()

    if role == "client" and getattr(current_user, "client_id", None):
        query = query.filter(Matter.client_id == current_user.client_id)
    elif role == "lawyer":
        query = query.filter(Matter.gnp_lawyer_id == current_user.id)

    return query


def apply_filters(
    query,
    *,
    period_type: str = "monthly",
    year: Optional[int] = None,
    month: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
    product_id: Optional[int] = None,
    state_id: Optional[int] = None,
    district_id: Optional[int] = None,
    forum_id: Optional[int] = None,
    counsel_id: Optional[int] = None,
    claim_bucket: Optional[str] = None,
):
    # ✅ DEBUG HERE (correct place)
    print("🔥 APPLY FILTERS CALLED", {
        "period_type": period_type,
        "year": year,
        "month": month,
        "start_date": start_date,
        "end_date": end_date,
    })

    today = date.today()

    # =========================================
    # DATE FILTERING (FIXED LOGIC)
    # =========================================

    if start_date or end_date:
        if start_date:
            query = query.filter(Matter.allocation_date >= start_date)
        if end_date:
            query = query.filter(Matter.allocation_date <= end_date)

    elif period_type == "monthly" and year is not None and month is not None:
        y = year or today.year
        m = month or today.month

        start = date(y, m, 1)
        end = date(y + (1 if m == 12 else 0), 1 if m == 12 else m + 1, 1)

        # ✅ DO NOT FORCE allocation_date IS NOT NULL
        query = query.filter(Matter.allocation_date >= start)
        query = query.filter(Matter.allocation_date < end)

    # =========================================
    # OTHER FILTERS
    # =========================================

    if client_id:
        query = query.filter(Matter.client_id == client_id)

    if product_id:
        query = query.filter(Matter.product_id == product_id)

    if forum_id:
        query = query.filter(Matter.forum_id == forum_id)

    if counsel_id:
        query = query.join(MatterLocalCounsel).filter(
            MatterLocalCounsel.local_counsel_id == counsel_id
        )

    needs_forum_join = bool(state_id or district_id)
    if needs_forum_join:
        query = query.join(Forum, Matter.forum_id == Forum.id)

    if state_id:
        query = query.filter(Forum.state_id == state_id)

    if district_id:
        query = query.filter(Forum.district_id == district_id)

    if claim_bucket == "gt_500000":
        query = query.filter(Matter.claim_amount.isnot(None))
        query = query.filter(Matter.claim_amount > 500000)

    elif claim_bucket == "lte_500000":
        query = query.filter(
            case(
                (Matter.claim_amount.is_(None), 0),
                else_=Matter.claim_amount
            ) <= 500000
        )

    return query


def build_base_query(db: Session, current_user: User):
    query = db.query(Matter).filter(
        Matter.is_deleted.is_(False),
        Matter.is_active.is_(True),
    )
    query = apply_role_filter(query, current_user)
    return query


def get_filtered_query(
    db: Session,
    current_user: User,
    *,
    period_type: str = "monthly",
    year: Optional[int] = None,
    month: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
    product_id: Optional[int] = None,
    state_id: Optional[int] = None,
    district_id: Optional[int] = None,
    forum_id: Optional[int] = None,
    counsel_id: Optional[int] = None,
    claim_bucket: Optional[str] = None,
):
    query = build_base_query(db, current_user)
    query = apply_filters(
        query,
        period_type=period_type,
        year=year,
        month=month,
        start_date=start_date,
        end_date=end_date,
        client_id=client_id,
        product_id=product_id,
        state_id=state_id,
        district_id=district_id,
        forum_id=forum_id,
        counsel_id=counsel_id,
        claim_bucket=claim_bucket,
    )
    return query


def get_selected_fields_config(db: Session):
    config = db.query(MISConfig).filter(MISConfig.key == "selected_fields").first()
    if not config or not config.value:
        return []
    return [x.strip() for x in config.value.split(",") if x.strip()]


@router.get("/dashboard")
def get_dashboard(
    period_type: str = Query("monthly"),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    client_id: Optional[int] = Query(None),
    product_id: Optional[int] = Query(None),
    state_id: Optional[int] = Query(None),
    district_id: Optional[int] = Query(None),
    forum_id: Optional[int] = Query(None),
    counsel_id: Optional[int] = Query(None),
    claim_bucket: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filtered = get_filtered_query(
        db,
        current_user,
        period_type=period_type,
        year=year,
        month=month,
        start_date=start_date,
        end_date=end_date,
        client_id=client_id,
        product_id=product_id,
        state_id=state_id,
        district_id=district_id,
        forum_id=forum_id,
        counsel_id=counsel_id,
        claim_bucket=claim_bucket,
    )

    filtered_ids = filtered.with_entities(Matter.id).distinct().subquery()

    summary_base = (
        db.query(Matter)
        .join(filtered_ids, Matter.id == filtered_ids.c.id)
    )

    summary_row = summary_base.with_entities(
        func.count(Matter.id),
        func.sum(
            case(
                (func.lower(func.coalesce(Matter.current_status, "")) == "pending", 1),
                else_=0,
            )
        ),
        func.sum(
            case(
                (Matter.is_disposed.is_(True), 1),
                else_=0,
            )
        ),
        func.sum(func.coalesce(Matter.claim_amount, 0)),
    ).first()

    total_matters = summary_row[0] or 0
    pending_matters = summary_row[1] or 0
    disposed_matters = summary_row[2] or 0
    total_claim_amount = to_float(summary_row[3])

    pending_exposure = to_float(
        summary_base
        .filter(func.lower(func.coalesce(Matter.current_status, "")) == "pending")
        .with_entities(func.coalesce(func.sum(Matter.claim_amount), 0))
        .scalar()
    )

    status_rows = (
        summary_base
        .with_entities(
            func.coalesce(Matter.current_status, "Unknown").label("status"),
            func.count(Matter.id),
        )
        .group_by("status")
        .all()
    )
    status_distribution = {k: v for k, v in status_rows}

    client_rows = (
        summary_base
        .join(Client, Matter.client_id == Client.id)
        .with_entities(
            func.coalesce(Client.legal_name, "Unknown").label("client_name"),
            func.count(Matter.id),
        )
        .group_by("client_name")
        .all()
    )
    client_distribution = {k: v for k, v in client_rows}

    monthly_trend = {}
    date_rows = summary_base.with_entities(Matter.allocation_date).all()
    for r in date_rows:
        if r.allocation_date:
            key = r.allocation_date.strftime("%Y-%m")
            monthly_trend[key] = monthly_trend.get(key, 0) + 1
    monthly_trend = dict(sorted(monthly_trend.items()))

    table_query = filtered.outerjoin(Client, Matter.client_id == Client.id).outerjoin(
        Product, Matter.product_id == Product.id
    )

    if not (state_id or district_id):
        table_query = table_query.outerjoin(Forum, Matter.forum_id == Forum.id)

    table_query = (
        table_query
        .outerjoin(State, Forum.state_id == State.id)
        .outerjoin(District, Forum.district_id == District.id)
        .with_entities(
            Matter.id.label("id"),
            Matter.internal_case_no.label("internal_case_no"),
            Client.legal_name.label("client"),
            Matter.matter_name.label("matter_name"),
            Matter.case_no.label("case_no"),
            Matter.allocation_date.label("allocation_date"),
            Matter.claim_amount.label("claim_amount"),
            Matter.current_status.label("status"),
            Matter.current_stage.label("stage"),
            Product.name.label("product"),
            State.name.label("state"),
            District.name.label("district"),
            Forum.name.label("forum"),
            literal(None).label("counsel"),
            Matter.ldoh.label("ldoh"),
            Matter.ndoh.label("ndoh"),
            Matter.is_disposed.label("disposed"),
            Matter.outcome.label("outcome"),
            case(
                (Matter.claim_amount > 500000, "Above 500000"),
                else_="Upto 500000",
            ).label("claim_bucket"),
        )
        .distinct(Matter.id)
        .order_by(Matter.created_at.desc(), Matter.id.desc())
    )

    offset = (page - 1) * page_size
    rows = table_query.offset(offset).limit(page_size).all()

    detailed_table = []
    for r in rows:
        detailed_table.append(
            {
                "id": r.id,
                "internal_case_no": r.internal_case_no,
                "client": r.client,
                "matter_name": r.matter_name,
                "case_no": r.case_no,
                "allocation_date": r.allocation_date,
                "claim_amount": to_float(r.claim_amount),
                "status": r.status,
                "stage": r.stage,
                "product": r.product,
                "state": r.state,
                "district": r.district,
                "forum": r.forum,
                "counsel": r.counsel,
                "ldoh": r.ldoh,
                "ndoh": r.ndoh,
                "disposed": (
                    "YES"
                    if str(r.status or "").lower() in ["disposed", "dismissed", "allowed"]
                    else "NO"
                ),
                "outcome": r.outcome,
                "claim_bucket": r.claim_bucket,
            }
        )

    return {
        "summary": {
            "total_matters": total_matters,
            "pending_matters": pending_matters,
            "disposed_matters": disposed_matters,
            "total_claim_amount": total_claim_amount,
            "pending_exposure": pending_exposure,
        },
        "status_distribution": status_distribution,
        "monthly_trend": monthly_trend,
        "client_distribution": client_distribution,
        "detailed_table": detailed_table,
        "page": page,
        "page_size": page_size,
        "total_rows": total_matters,
    }


@router.get("/clients")
def clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Client)

    role = (current_user.role or "").strip().lower()
    if role == "client" and getattr(current_user, "client_id", None):
        query = query.filter(Client.id == current_user.client_id)

    rows = query.order_by(Client.legal_name.asc()).all()
    return [{"id": c.id, "name": c.legal_name} for c in rows]


@router.get("/products")
def products(db: Session = Depends(get_db)):
    rows = db.query(Product).order_by(Product.name.asc()).all()
    return [{"id": p.id, "name": p.name} for p in rows]


@router.get("/states")
def states(db: Session = Depends(get_db)):
    rows = db.query(State).order_by(State.name.asc()).all()
    return [{"id": s.id, "name": s.name} for s in rows]


@router.get("/districts")
def districts(state_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    query = db.query(District)
    if state_id:
        query = query.filter(District.state_id == state_id)
    rows = query.order_by(District.name.asc()).all()
    return [{"id": d.id, "name": d.name, "state_id": d.state_id} for d in rows]


@router.get("/forums")
def forums(
    state_id: Optional[int] = Query(None),
    district_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Forum)
    if state_id:
        query = query.filter(Forum.state_id == state_id)
    if district_id:
        query = query.filter(Forum.district_id == district_id)
    rows = query.order_by(Forum.name.asc()).all()
    return [{"id": f.id, "name": f.name} for f in rows]


@router.get("/counsels")
def counsels(db: Session = Depends(get_db)):
    rows = db.query(LocalCounsel).order_by(LocalCounsel.name.asc()).all()
    return [{"id": c.id, "name": c.name} for c in rows]


@router.get("/config")
def get_config(db: Session = Depends(get_db)):
    selected_fields = get_selected_fields_config(db)
    return {"selected_fields": selected_fields}


@router.post("/config")
def save_config(
    selected_fields: str = Form(...),
    db: Session = Depends(get_db),
):
    config = db.query(MISConfig).filter(MISConfig.key == "selected_fields").first()

    if not config:
        config = MISConfig(key="selected_fields")

    config.value = selected_fields
    db.add(config)
    db.commit()

    return {"ok": True}


@router.get("/export/excel")
def export_excel(
    selected_fields: Optional[str] = Query(None),
    period_type: str = Query("monthly"),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    client_id: Optional[int] = Query(None),
    product_id: Optional[int] = Query(None),
    state_id: Optional[int] = Query(None),
    district_id: Optional[int] = Query(None),
    forum_id: Optional[int] = Query(None),
    counsel_id: Optional[int] = Query(None),
    claim_bucket: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filtered = get_filtered_query(
        db,
        current_user,
        period_type=period_type,
        year=year,
        month=month,
        start_date=start_date,
        end_date=end_date,
        client_id=client_id,
        product_id=product_id,
        state_id=state_id,
        district_id=district_id,
        forum_id=forum_id,
        counsel_id=counsel_id,
        claim_bucket=claim_bucket,
    )

    export_query = filtered.outerjoin(Client, Matter.client_id == Client.id).outerjoin(
        Product, Matter.product_id == Product.id
    )

    if not (state_id or district_id):
        export_query = export_query.outerjoin(Forum, Matter.forum_id == Forum.id)

    export_query = export_query.outerjoin(State, Forum.state_id == State.id).outerjoin(
        District, Forum.district_id == District.id
    )

    rows = (
        export_query.with_entities(
            Matter.id.label("id"),
            Matter.internal_case_no.label("internal_case_no"),
            Client.legal_name.label("client"),
            Matter.matter_name.label("matter_name"),
            Matter.case_no.label("case_no"),
            Matter.allocation_date.label("allocation_date"),
            Matter.claim_amount.label("claim_amount"),
            Matter.current_status.label("status"),
            Matter.current_stage.label("stage"),
            Product.name.label("product"),
            State.name.label("state"),
            District.name.label("district"),
            Forum.name.label("forum"),
            literal(None).label("counsel"),
            Matter.ldoh.label("ldoh"),
            Matter.ndoh.label("ndoh"),
            Matter.is_disposed.label("disposed"),
            Matter.outcome.label("outcome"),
            case(
                (Matter.claim_amount > 500000, "Above 500000"),
                else_="Upto 500000",
            ).label("claim_bucket"),
        )
        .distinct(Matter.id)
        .order_by(Matter.created_at.desc(), Matter.id.desc())
        .all()
    )

    if not rows:
        raise HTTPException(status_code=404, detail="No data")

    export_rows = []
    for r in rows:
        export_rows.append(
            {
                "id": r.id,
                "internal_case_no": r.internal_case_no,
                "client": r.client,
                "matter_name": r.matter_name,
                "case_no": r.case_no,
                "allocation_date": r.allocation_date,
                "claim_amount": to_float(r.claim_amount),
                "status": r.status,
                "stage": r.stage,
                "product": r.product,
                "state": r.state,
                "district": r.district,
                "forum": r.forum,
                "counsel": r.counsel,
                "ldoh": r.ldoh,
                "ndoh": r.ndoh,
                "disposed": (
                    "YES"
                    if str(r.status or "").lower() in ["disposed", "dismissed", "allowed"]
                    else "NO"
                ),
                "outcome": r.outcome,
                "claim_bucket": r.claim_bucket,
            }
        )

    df = pd.DataFrame(export_rows)

    if selected_fields:
        selected = [f.strip() for f in selected_fields.split(",") if f in df.columns]
        if selected:
            df = df[selected]
    else:
        configured = get_selected_fields_config(db)
        selected = [f for f in configured if f in df.columns]
        if selected:
            df = df[selected]

    df = df.rename(
        columns={
            "id": "ID",
            "internal_case_no": "Internal Case No.",
            "client": "Client",
            "matter_name": "Matter Name",
            "case_no": "Case No.",
            "allocation_date": "Allocation Date",
            "claim_amount": "Claim Amount",
            "status": "Status",
            "stage": "Stage",
            "product": "Product",
            "state": "State",
            "district": "District",
            "forum": "Forum",
            "counsel": "Counsel",
            "ldoh": "LDOH",
            "ndoh": "NDOH",
            "disposed": "Disposed",
            "outcome": "Outcome",
            "claim_bucket": "Claim Bucket",
        }
    )

    output = io.BytesIO()

    formatted_date = get_formatted_today()

    client_name = None
    if client_id:
        client = db.query(Client).filter(Client.id == client_id).first()
        if client:
            client_name = client.legal_name

    if client_name:
        report_title = f"MIS Report for {client_name} as on {formatted_date}"
    else:
        report_title = f"GNP Legal MIS Report as on {formatted_date}"

    filter_parts = []

    if period_type:
        filter_parts.append(f"Period: {period_type}")
    if year:
        filter_parts.append(f"Year: {year}")
    if month:
        filter_parts.append(f"Month: {month}")
    if client_name:
        filter_parts.append(f"Client: {client_name}")

    filter_text = " | ".join(filter_parts)

    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        workbook = writer.book
        ws = workbook.add_worksheet("MIS Report")
        writer.sheets["MIS Report"] = ws

        title_fmt = workbook.add_format({"bold": True, "font_size": 14, "align": "center"})
        header_fmt = workbook.add_format({"bold": True, "border": 1})

        ws.merge_range(0, 0, 0, len(df.columns) - 1, report_title, title_fmt)
        ws.merge_range(1, 0, 1, len(df.columns) - 1, filter_text, workbook.add_format({"italic": True}))

        df.to_excel(writer, sheet_name="MIS Report", startrow=2, index=False)

        for col_num, col_name in enumerate(df.columns):
            ws.write(2, col_num, col_name, header_fmt)

        ws.autofilter(2, 0, len(df) + 2, len(df.columns) - 1)

        for i, col in enumerate(df.columns):
            safe_series = df[col].fillna("").astype(str)
            width = max(safe_series.map(len).max(), len(col)) + 2
            ws.set_column(i, i, width)

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=MIS_Report.xlsx"},
    )