from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from decimal import Decimal


# ================= CREATE =================

class MatterCreate(BaseModel):
    client_id: int
    forum_id: int
    product_id: Optional[int] = None

    matter_name: str
    case_no: Optional[str] = None

    dc_sc_no: Optional[str] = None

    allocation_date: Optional[date] = None

    ldoh: Optional[date] = None
    ndoh: Optional[date] = None
    reply_filed_date: Optional[date] = None

    summary: Optional[str] = None
    allegation: Optional[str] = None

    claim_amount: Optional[Decimal] = Field(default=0, ge=0)

    current_status: Optional[str] = "Pending"
    pleadings_status: Optional[str] = None

    comments: Optional[str] = None

    # 🔥 COUNSEL
    gnp_lawyer_id: Optional[int] = None


# ================= UPDATE =================

class MatterUpdate(BaseModel):
    client_id: Optional[int] = None
    forum_id: Optional[int] = None
    product_id: Optional[int] = None

    matter_name: Optional[str] = None
    case_no: Optional[str] = None

    dc_sc_no: Optional[str] = None

    allocation_date: Optional[date] = None

    ldoh: Optional[date] = None
    ndoh: Optional[date] = None
    reply_filed_date: Optional[date] = None

    summary: Optional[str] = None
    allegation: Optional[str] = None

    claim_amount: Optional[Decimal] = Field(default=None, ge=0)

    current_status: Optional[str] = None
    current_stage: Optional[str] = None

    pleadings_status: Optional[str] = None

    comments: Optional[str] = None

    outcome: Optional[str] = None
    client_share: Optional[Decimal] = Field(default=None, ge=0)
    client_savings: Optional[Decimal] = Field(default=None, ge=0)

    is_disposed: Optional[bool] = None
    order_date: Optional[date] = None

    gnp_lawyer_id: Optional[int] = None


# ================= RESPONSE =================

class MatterResponse(BaseModel):
    id: int

    client_id: int
    forum_id: int
    product_id: Optional[int]

    matter_name: str
    case_no: Optional[str]

    allocation_date: Optional[date]

    ldoh: Optional[date]
    ndoh: Optional[date]

    claim_amount: Optional[Decimal]

    current_status: Optional[str]
    current_stage: Optional[str]

    is_disposed: Optional[bool]

    class Config:
        from_attributes = True