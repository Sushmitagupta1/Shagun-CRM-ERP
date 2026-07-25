from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.inquiry import Inquiry, InquiryStatus, PaymentStatus
from fastapi import HTTPException

VALID_STATUS_TRANSITIONS = {
    InquiryStatus.NEW: [InquiryStatus.FOLLOW_UP, InquiryStatus.CANCELLED],
    InquiryStatus.FOLLOW_UP: [InquiryStatus.MENU_READY, InquiryStatus.NEGOTIATION, InquiryStatus.CANCELLED],
    InquiryStatus.MENU_READY: [InquiryStatus.PRESENTATION_SENT, InquiryStatus.CANCELLED],
    InquiryStatus.PRESENTATION_SENT: [InquiryStatus.NEGOTIATION, InquiryStatus.CANCELLED],
    InquiryStatus.NEGOTIATION: [InquiryStatus.CONFIRMED, InquiryStatus.CANCELLED],
    InquiryStatus.CONFIRMED: [],
    InquiryStatus.CANCELLED: [],
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
