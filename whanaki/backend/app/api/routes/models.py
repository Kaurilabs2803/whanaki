from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import User, OllamaModel
from app.schemas import ModelResponse

router = APIRouter()


@router.get("/models", response_model=list[ModelResponse], tags=["models"])
async def list_models(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all active Ollama models available for selection."""
    result = await db.execute(
        select(OllamaModel)
        .where(OllamaModel.is_active == True)
        .order_by(OllamaModel.sort_order)
    )
    return [ModelResponse.model_validate(m) for m in result.scalars().all()]
