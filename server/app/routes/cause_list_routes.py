import io
from fastapi import Form, Body
import os
from sqlalchemy import or_

from datetime import datetime, timedelta, date
from collections import defaultdict

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.external_matter import ExternalMatter
from app.models.matter import Matter
from app.models.local_counsel import LocalCounsel, MatterLocalCounsel
from app.models.client import Client
from app.models.forum import Forum
from app.models.user import User
from app.services.auth import get_current_user
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

router = APIRouter(tags=["Cause List"])


class UpdateFieldRequest(BaseModel):
    id: int
    field: str
    value: str | None


class AssignCounselRequest(BaseModel):
    external_id: int
    counsel_id: int


class UpdateLawyerRequest(BaseModel):
    lawyer_name: str | None = None

def get_greeting():
    from datetime import datetime

    hour = datetime.now().hour

    if hour < 12:
        return "Morning"
    elif hour < 17:
        return "Afternoon"
    else:
        return "Evening"

def parse_date(value):
    if value in (None, "", "null"):
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def group_data(rows):
    grouped = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))

    for r in rows:
        ndoh = r.get("ndoh")
        if isinstance(ndoh, datetime):
            date_key = ndoh.date().strftime("%Y-%m-%d")
        elif isinstance(ndoh, date):
            date_key = ndoh.strftime("%Y-%m-%d")
        else:
            date_key = "No Date"

        district = r.get("district") or "Unknown"
        court = r.get("forum") or "Court 1"

        grouped[date_key][district][court].append(r)

    return grouped


def get_local_counsel_for_matter(db: Session, matter_id: int):
    row = (
        db.query(LocalCounsel)
        .join(MatterLocalCounsel, LocalCounsel.id == MatterLocalCounsel.local_counsel_id)
        .filter(MatterLocalCounsel.matter_id == matter_id)
        .first()
    )
    return row


def serialize_matter_row(db: Session, m: Matter):
    local_counsel = get_local_counsel_for_matter(db, m.id)

    client_name = None
    if getattr(m, "client", None):
        client_name = getattr(m.client, "legal_name", None) or getattr(m.client, "name", None)

    forum_name = None
    district_name = None

    if getattr(m, "forum", None):
        forum_name = getattr(m.forum, "name", None)

        district = getattr(m.forum, "district", None)
        if district:
            district_name = getattr(district, "name", None)

        state = getattr(m.forum, "state", None)
        if state and forum_name and getattr(state, "name", None) and state.name not in forum_name:
            forum_name = f"{forum_name}, {state.name}"

    return {
        "id": m.id,
        "linked_matter_id": m.id,
        "client_name": client_name,
        "matter_name": m.matter_name,
        "case_no": m.case_no,
        "forum": forum_name,
        "district": district_name,
        "ldoh": m.ldoh,
        "ndoh": m.ndoh,
        "purpose": getattr(m, "current_stage", None) or getattr(m, "pleadings_status", None) or "",
        "lawyer_name": getattr(getattr(m, "gnp_lawyer", None), "full_name", None),
        "counsel_id": getattr(local_counsel, "id", None),
        "counsel_name": getattr(local_counsel, "name", None),
        "counsel_phone": getattr(local_counsel, "phone", None),
        "source": "matter",
        "counsel_email": getattr(local_counsel, "email", None),
    }


def serialize_external_row(db: Session, m: ExternalMatter):
    counsel = None
    if getattr(m, "counsel_id", None):
        counsel = db.query(LocalCounsel).filter(LocalCounsel.id == m.counsel_id).first()

    return {
        "id": m.id,
        "linked_matter_id": getattr(m, "linked_matter_id", None),
        "client_name": m.client_name,
        "matter_name": m.matter_name,
        "case_no": m.case_no,
        "forum": m.forum,
        "district": m.district,
        "ldoh": m.ldoh,
        "ndoh": m.ndoh,
        "purpose": m.purpose,
        "lawyer_name": m.lawyer_name,
        "counsel_id": m.counsel_id,
        "counsel_name": getattr(counsel, "name", None),
        "counsel_phone": getattr(counsel, "phone", None),
        "source": "tracker",
    }


# 🔐 CONFIG — CHANGE THIS
EMAIL_SENDER = "princepawaiya@gmail.com"
EMAIL_PASSWORD = "ktraqclrqxyfghdy"   # no spaces


def build_message(data):
    ndoh = data.get("ndoh")
    urgency = ""

    if ndoh:
        try:
            days_left = (ndoh - date.today()).days
            if days_left == 0:
                urgency = " (TODAY)"
            elif days_left == 1:
                urgency = " (TOMORROW)"
        except:
            pass

    greeting = get_greeting()
    counsel_name = data.get("counsel_name") or "Sir/Madam"

    return f"""
GNP LEGAL – HEARING ALERT

Dear {counsel_name},

Good {greeting}. Trust this finds you well.

Please find the details of the upcoming matter:

----------------------------------------
Matter Name   : {data.get('matter_name')}
Case Number   : {data.get('case_no')}
Client Name   : {data.get('client_name')}
----------------------------------------

Next Date     : {ndoh}{urgency}
Purpose       : {data.get('purpose')}

You are requested to kindly appear and conduct the matter.
Please share the hearing update upon conclusion.

Warm regards,  
GNP Legal Team
"""


def get_record(db, id):
    record = db.query(ExternalMatter).filter(ExternalMatter.id == id).first()

    if record:
        return serialize_external_row(db, record)

    matter = db.query(Matter).filter(Matter.id == id).first()

    if matter:
        return serialize_matter_row(db, matter)

    return None

@router.get("/files")
def list_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(ExternalMatter.source_file, ExternalMatter.client_name).all()

    files = {}
    for source_file, client_name in rows:
        if not source_file:
            continue

        if source_file not in files:
            files[source_file] = {"source_file": source_file, "clients": set()}

        if client_name:
            files[source_file]["clients"].add(client_name)

    return [
        {
            "source_file": key,
            "clients": sorted(list(value["clients"]))
        }
        for key, value in files.items()
    ]


@router.get("/weekly")
def weekly(
    start_date: str | None = Query(None),
    client_name: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # rolling 7-day window from selected date
    start = parse_date(start_date) or date.today()
    end = start + timedelta(days=7)

    matter_query = (
        db.query(Matter)
        .options(
            joinedload(Matter.client),
            joinedload(Matter.forum).joinedload(Forum.district),
            joinedload(Matter.forum).joinedload(Forum.state),
            joinedload(Matter.gnp_lawyer),
        )
        .filter(Matter.ndoh.isnot(None))
        .filter(Matter.ndoh >= start)
        .filter(Matter.ndoh <= end)
    )

    if client_name:
        matter_query = matter_query.join(Client, Matter.client_id == Client.id).filter(
            or_(
                Client.legal_name == client_name,
                Client.legal_name.ilike(f"%{client_name}%")
            )
        )

    external_query = (
        db.query(ExternalMatter)
        .filter(ExternalMatter.ndoh.isnot(None))
        .filter(ExternalMatter.ndoh >= start)
        .filter(ExternalMatter.ndoh <= end)
    )

    if client_name:
        external_query = external_query.filter(ExternalMatter.client_name == client_name)

    rows = []

    for m in matter_query.all():
        rows.append(serialize_matter_row(db, m))

    for m in external_query.all():
        rows.append(serialize_external_row(db, m))

    rows.sort(
        key=lambda x: (
            x.get("ndoh") or date.max,
            x.get("district") or "",
            x.get("forum") or "",
            x.get("matter_name") or "",
        )
    )

    return group_data(rows)


@router.get("/monthly")
def monthly(
    year: int,
    month: int,
    client_name: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start = date(year, month, 1)

    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)

    matter_query = (
        db.query(Matter)
        .options(
            joinedload(Matter.client),
            joinedload(Matter.forum).joinedload(Forum.district),
            joinedload(Matter.forum).joinedload(Forum.state),
            joinedload(Matter.gnp_lawyer),
        )
        .filter(Matter.ndoh.isnot(None))
        .filter(Matter.ndoh >= start)
        .filter(Matter.ndoh < end)
    )

    if client_name:
        matter_query = matter_query.join(Client, Matter.client_id == Client.id).filter(
            or_(
                Client.legal_name == client_name,
                Client.legal_name.ilike(f"%{client_name}%")
            )
        )

    external_query = (
        db.query(ExternalMatter)
        .filter(ExternalMatter.ndoh.isnot(None))
        .filter(ExternalMatter.ndoh >= start)
        .filter(ExternalMatter.ndoh < end)
    )

    if client_name:
        external_query = external_query.filter(ExternalMatter.client_name == client_name)

    rows = []

    for m in matter_query.all():
        rows.append(serialize_matter_row(db, m))

    for m in external_query.all():
        rows.append(serialize_external_row(db, m))

    rows.sort(
        key=lambda x: (
            x.get("ndoh") or date.max,
            x.get("district") or "",
            x.get("forum") or "",
            x.get("matter_name") or "",
        )
    )

    return group_data(rows)


ALLOWED_FIELDS = {"ldoh", "ndoh", "purpose"}


@router.post("/update-field")
def update_field(
    payload: UpdateFieldRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.field not in ALLOWED_FIELDS:
        raise HTTPException(status_code=400, detail="Invalid field")

    # prefer live matter first, then tracker row
    matter = db.query(Matter).filter(Matter.id == payload.id).first()
    if matter:
        if payload.field in {"ldoh", "ndoh"}:
            setattr(matter, payload.field, parse_date(payload.value))
        else:
            # closest field used by frontend on live matters
            matter.current_stage = payload.value or ""
        db.commit()
        return {"ok": True, "source": "matter"}

    record = db.query(ExternalMatter).filter(ExternalMatter.id == payload.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if payload.field in {"ldoh", "ndoh"}:
        setattr(record, payload.field, parse_date(payload.value))
    else:
        setattr(record, payload.field, payload.value)

    db.commit()
    return {"ok": True, "source": "tracker"}


@router.post("/assign-counsel")
def assign_counsel(
    payload: AssignCounselRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    counsel = db.query(LocalCounsel).filter(LocalCounsel.id == payload.counsel_id).first()
    if not counsel:
        raise HTTPException(status_code=404, detail="Counsel not found")

    record = db.query(ExternalMatter).filter(ExternalMatter.id == payload.external_id).first()
    if record:
        record.counsel_id = counsel.id
        record.lawyer_name = counsel.name
        db.commit()
        return {"message": "assigned", "source": "tracker"}

    matter = db.query(Matter).filter(Matter.id == payload.external_id).first()
    if matter:
        db.query(MatterLocalCounsel).filter(MatterLocalCounsel.matter_id == matter.id).delete()
        db.add(
            MatterLocalCounsel(
                matter_id=matter.id,
                local_counsel_id=counsel.id,
            )
        )
        db.commit()
        return {"message": "assigned", "source": "matter"}

    raise HTTPException(status_code=404, detail="Record not found")


@router.put("/{id}/lawyer")
def update_lawyer(
    id: int,
    payload: UpdateLawyerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(ExternalMatter).filter(ExternalMatter.id == id).first()
    if record:
        record.lawyer_name = payload.lawyer_name
        db.commit()
        return {"ok": True, "source": "tracker"}

    matter = db.query(Matter).filter(Matter.id == id).first()
    if matter:
        # keep harmless for live matters
        return {"ok": True, "source": "matter"}

    raise HTTPException(status_code=404, detail="Record not found")


@router.get("/export")
@router.get("/export/excel")
def export_excel(
    view: str = Query("weekly"),
    year: int | None = None,
    month: int | None = None,
    start_date: str | None = None,
    client_name: str | None = None,
    columns: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ---------------- FETCH ----------------
    if view == "monthly":
        if not year or not month:
            raise HTTPException(status_code=400, detail="year and month required")
        data = monthly(year=year, month=month, client_name=client_name, db=db, current_user=current_user)
        header_text = f"For the Month of {date(year, month, 1).strftime('%B %Y')}"
    else:
        start = parse_date(start_date) or date.today()
        end = start + timedelta(days=6)
        data = weekly(start_date=start_date, client_name=client_name, db=db, current_user=current_user)
        header_text = f"For the Week starting {start.strftime('%d/%m/%Y')} to {end.strftime('%d/%m/%Y')}"

    title = f"Cause List for {client_name}" if client_name else "GNP Legal Cause List"

    # ---------------- FLATTEN ----------------
    rows = []
    for date_key, districts in (data or {}).items():
        for district, courts in (districts or {}).items():
            for court, matters in (courts or {}).items():
                for m in (matters or []):
                    rows.append({
                        "Client": m.get("client_name"),
                        "Date": date_key,
                        "District": district,
                        "Forum": court,
                        "Matter": m.get("matter_name"),
                        "Case No": m.get("case_no"),
                        "Purpose": m.get("purpose"),
                        "LDOH": m.get("ldoh"),
                        "NDOH": m.get("ndoh"),
                        "Lawyer": m.get("lawyer_name"),
                        "Counsel": m.get("counsel_name"),
                    })

    df = pd.DataFrame(rows)
    df = df.rename(columns={
        "Lawyer": "GNP Lawyer",
        "Counsel": "Location Counsel"
    })
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")

    if columns:
        selected = [c.strip() for c in columns.split(",") if c.strip() in df.columns]
        if selected:
            df = df[selected]

    output = io.BytesIO()

    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        workbook = writer.book

        # ---------- FORMATS ----------
        title_fmt = workbook.add_format({"bold": True, "font_size": 14, "align": "center"})
        header_fmt = workbook.add_format({"bold": True, "border": 1})
        cell_fmt = workbook.add_format({"border": 1})
        bold_fmt = workbook.add_format({"bold": True})

        # ================= MASTER SHEET =================
        ws_master = workbook.add_worksheet("All Clients")
        writer.sheets["All Clients"] = ws_master

        # ---------------- TITLE ----------------
        final_title = f"{title} {header_text}"

        ws_master.merge_range(
            0, 0,
            0, len(df.columns) - 1,
            final_title,
            title_fmt
        )

        # ---------------- WRITE DATA ----------------
        df.to_excel(writer, sheet_name="All Clients", startrow=3, index=False)

        # ---------------- HEADER BOLD ----------------
        header_format = workbook.add_format({
            "bold": True,
            "border": 1
        })

        for col_num, col_name in enumerate(df.columns):
            ws_master.write(3, col_num, col_name, header_format)

        ws_master.autofilter(3, 0, len(df) + 3, len(df.columns) - 1)

        for i, col in enumerate(df.columns):
            safe_series = df[col].fillna("").astype(str)
            try:
                max_len = safe_series.map(len).max()
            except:
                max_len = 10

            width = max(safe_series.map(len).max(), len(col)) + 2
            ws_master.set_column(i, i, width)

        # ================= CLIENT SHEETS =================
        grouped_clients = df.groupby("Client")

        for client, client_df in grouped_clients:
            sheet_name = (client[:28] if client else "Unknown")  # Excel limit
            ws = workbook.add_worksheet(sheet_name)

            row_cursor = 0

            # TITLE
            ws.merge_range(row_cursor, 0, row_cursor, 6, title, title_fmt)
            row_cursor += 1

            ws.merge_range(row_cursor, 0, row_cursor, 6, header_text, bold_fmt)
            row_cursor += 2

            ws.write(row_cursor, 0, f"CLIENT: {client}", bold_fmt)
            row_cursor += 2

            # GROUP BY DATE
            grouped_dates = client_df.groupby("Date")

            for date_key, date_df in grouped_dates:
                ws.write(row_cursor, 0, f"DATE: {date_key}", bold_fmt)
                row_cursor += 1

                grouped_district = date_df.groupby("District")

                for district, dist_df in grouped_district:
                    ws.write(row_cursor, 0, f"DISTRICT: {district}", bold_fmt)
                    row_cursor += 1

                    grouped_court = dist_df.groupby("Forum")

                    for court, court_df in grouped_court:
                        ws.write(row_cursor, 0, f"COURT: {court}", bold_fmt)
                        row_cursor += 1

                        for idx, (_, r) in enumerate(court_df.iterrows(), start=1):
                            ws.write(row_cursor, 0, f"{idx}. {r['Matter']}", bold_fmt)
                            row_cursor += 1

                            ws.write(row_cursor, 1, f"Case No: {r['Case No']}")
                            row_cursor += 1

                            ws.write(row_cursor, 1, f"Purpose: {r['Purpose']}")
                            row_cursor += 1

                            ws.write(row_cursor, 1, f"LDOH: {r['LDOH']}")
                            row_cursor += 1

                            ws.write(row_cursor, 1, f"GNP Lawyer: {r.get('GNP Lawyer')}")
                            row_cursor += 2

                        row_cursor += 1

        # ================= DONE =================

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=cause_list.xlsx"},
    )

@router.post("/upload")
def upload_tracker(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # placeholder implementation so frontend stops failing
    # later you can replace this with actual Excel parsing + ExternalMatter inserts
    return {
        "ok": True,
        "filename": file.filename,
        "message": "Upload endpoint is connected. Parsing logic can be added next."
    }


# ================= EMAIL =================

@router.post("/{id}/send-email")
def send_email(
    id: int,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = get_record(db, id)

    if not data:
        raise HTTPException(status_code=404, detail="Record not found")

    # ---------------- GET RECIPIENT ----------------
    # ✅ STEP 1: Check manual email from UI
    custom_email = payload.get("email")

    if custom_email:
        recipients = [custom_email]   # 🔥 override everything
    else:
        recipients = []

        # 1. Counsel email
        if data.get("counsel_id"):
            counsel = db.query(LocalCounsel).filter(
                LocalCounsel.id == data.get("counsel_id")
            ).first()
            if counsel and counsel.email:
                recipients.append(counsel.email)

        # 2. Client email
        if data.get("client_email"):
            recipients.append(data.get("client_email"))

        # 3. Fallback
        if not recipients:
            recipients.append(current_user.email)

    recipient_str = ", ".join(recipients)

    # ---------------- BUILD MESSAGE ----------------
    message_body = build_message(data)

    try:
        if not EMAIL_SENDER or not EMAIL_PASSWORD:
            raise Exception("Email credentials missing")

        msg = MIMEMultipart()
        msg["From"] = EMAIL_SENDER
        msg["To"] = recipient_str
        subject_matter = (data.get("matter_name") or "").replace("\n", " ").replace("\r", " ")
        msg["Subject"] = f"Hearing Alert | {data.get('case_no')} | {subject_matter[:80]}"

        msg.attach(MIMEText(message_body, "plain"))

        print("Sending email...")
        print("From:", EMAIL_SENDER)
        print("To:", recipient_str)

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.ehlo()
        server.starttls()
        server.ehlo()

        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_SENDER, recipients, msg.as_string())
        server.quit()

        return {
            "ok": True,
            "message": f"Email sent to {recipient_str}"
        }

    except Exception as e:
        print("EMAIL ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print("EMAIL ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ================= SMS =================
# ⚠️ Placeholder — real SMS requires API

@router.post("/{id}/send-sms")
def send_sms(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = get_record(db, id)

    if not data:
        raise HTTPException(status_code=404, detail="Record not found")

    message_body = build_message(data)

    print("\n====== SMS SIMULATION ======")
    print("To:", data.get("counsel_phone"))
    print(message_body)
    print("===========================\n")

    return {
        "ok": True,
        "message": "SMS simulated (see server logs)"
    }