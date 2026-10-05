from pydantic import BaseModel
from typing import Optional


class TaskCreate(BaseModel):
    title: str
    description: str
    priority: str = "Medium"
    deadline: Optional[str] = None
    action_plan: Optional[str] = None


class TaskResponse(TaskCreate):
    id: int
    status: str

    class Config:
        from_attributes = True


class AIAnalyzeRequest(BaseModel):
    request: str


class AIAnalyzeResponse(BaseModel):
    title: str
    priority: str
    deadline: str
    action_plan: list[str]