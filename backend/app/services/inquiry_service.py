from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus
from fastapi import HTTPException

VALID_STATUS_TRANSITIONS = {
    InquiryStatus.NEW_INQUIRY: [InquiryStatus.FOLLOWUP, InquiryStatus.CLIENT_CONFIRMATION],
    InquiryStatus.FOLLOWUP: [InquiryStatus.MENU_SENT, InquiryStatus.NEW_INQUIRY, InquiryStatus.CLIENT_CONFIRMATION],
    InquiryStatus.MENU_SENT: [InquiryStatus.CLIENT_CONFIRMATION, InquiryStatus.FOLLOWUP],
    InquiryStatus.CLIENT_CONFIRMATION: [InquiryStatus.ADVANCE_RECEIVE, InquiryStatus.MENU_SENT],
    InquiryStatus.ADVANCE_RECEIVE: [InquiryStatus.OPERATION_HANDOVER, InquiryStatus.CLIENT_CONFIRMATION],
    InquiryStatus.OPERATION_HANDOVER: [],
}


def can_transition(current: InquiryStatus, target: InquiryStatus) -> bool:
    return target in VALID_STATUS_TRANSITIONS.get(current, [])


async def get_inquiry_or_404(db: AsyncSession, inquiry_id):
    import uuid
    result = await db.execute(select(Inquiry).where(Inquiry.id == inquiry_id))
    inquiry = result.scalar_one_or_none()
    if inquiry is None:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return inquiry
