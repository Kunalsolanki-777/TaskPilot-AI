from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from agent_tools import (
    create_task_tool,
    get_tasks_tool,
    update_task_tool,
    complete_task_tool,
    delete_task_tool
)

from database import get_db
from models import Task
from schemas import (
    TaskCreate,
    TaskResponse,
    AIAnalyzeRequest
)

from ai_agent import analyze_task, decide_agent_action


router = APIRouter(prefix="/tasks", tags=["Tasks"])


# =========================
# CREATE TASK
# =========================

@router.post("/", response_model=TaskResponse)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db)
):
    new_task = Task(
        title=task.title,
        description=task.description,
        priority=task.priority,
        deadline=task.deadline,
        action_plan=task.action_plan,
        status="Pending"
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


# =========================
# GET TASKS
# =========================

@router.get("/", response_model=list[TaskResponse])
def get_tasks(db: Session = Depends(get_db)):
    return db.query(Task).all()


# =========================
# AI ANALYZE
# =========================

@router.post("/analyze", response_model=TaskResponse)
def analyze_user_task(
    request: AIAnalyzeRequest,
    db: Session = Depends(get_db)
):
    try:
        result = analyze_task(request.request)

        new_task = Task(
            title=result.title,
            description=request.request,
            priority=result.priority,
            deadline=result.deadline,
            action_plan="\n".join(
                f"{i + 1}. {step}"
                for i, step in enumerate(result.action_plan)
            ),
            status="Pending"
        )

        db.add(new_task)
        db.commit()
        db.refresh(new_task)

        return new_task

    except Exception as e:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"AI processing failed: {str(e)}"
        )


# =========================
# UPDATE TASK
# =========================

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task: TaskCreate,
    db: Session = Depends(get_db)
):
    existing_task = db.query(Task).filter(Task.id == task_id).first()

    if not existing_task:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    existing_task.title = task.title
    existing_task.description = task.description
    existing_task.priority = task.priority
    existing_task.deadline = task.deadline
    existing_task.action_plan = task.action_plan

    db.commit()
    db.refresh(existing_task)

    return existing_task


# =========================
# DELETE TASK
# =========================

@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    existing_task = db.query(Task).filter(Task.id == task_id).first()

    if not existing_task:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    db.delete(existing_task)
    db.commit()

    return {
        "message": "Task deleted successfully",
        "task_id": task_id
    }


# =========================
# COMPLETE TASK
# =========================

@router.patch("/{task_id}/complete", response_model=TaskResponse)
def complete_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    existing_task = db.query(Task).filter(Task.id == task_id).first()

    if not existing_task:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    existing_task.status = "Completed"

    db.commit()
    db.refresh(existing_task)

    return existing_task


# =========================
# AGENT ACTION
# =========================

class AgentActionRequest(BaseModel):
    action: str
    task_id: int | None = None
    task: TaskCreate | None = None


@router.post("/agent/action")
def agent_action(
    request: AgentActionRequest,
    db: Session = Depends(get_db)
):
    action = request.action.lower().strip()

    # CREATE
    if action == "create":

        if not request.task:
            raise HTTPException(
                status_code=400,
                detail="Task data is required"
            )

        result = create_task_tool(
            db,
            request.task
        )

        return {
            "success": True,
            "action": "create",
            "message": "Task created by agent",
            "task": result
        }

    # LIST
    elif action == "list":

        tasks = get_tasks_tool(db)

        return {
            "success": True,
            "action": "list",
            "tasks": tasks
        }

    # UPDATE
    elif action == "update":

        if request.task_id is None or request.task is None:
            raise HTTPException(
                status_code=400,
                detail="task_id and task data are required"
            )

        result = update_task_tool(
            db,
            request.task_id,
            request.task
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Task not found"
            )

        return {
            "success": True,
            "action": "update",
            "message": "Task updated by agent",
            "task": result
        }

    # COMPLETE
    elif action == "complete":

        if request.task_id is None:
            raise HTTPException(
                status_code=400,
                detail="task_id is required"
            )

        result = complete_task_tool(
            db,
            request.task_id
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Task not found"
            )

        return {
            "success": True,
            "action": "complete",
            "message": "Task completed by agent",
            "task": result
        }

    # DELETE
    elif action == "delete":

        if request.task_id is None:
            raise HTTPException(
                status_code=400,
                detail="task_id is required"
            )

        result = delete_task_tool(
            db,
            request.task_id
        )

        if result is None:
            raise HTTPException(
                status_code=404,
                detail="Task not found"
            )

        return {
            "success": True,
            "action": "delete",
            "message": "Task deleted by agent",
            "task_id": result
        }

    # UNKNOWN ACTION
    else:

        raise HTTPException(
            status_code=400,
            detail="Unknown agent action"
        )

        # =========================
# AGENT DECISION
# =========================

class AgentDecisionRequest(BaseModel):
    request: str


@router.post("/agent/decide")
def agent_decide(
    request: AgentDecisionRequest
):
    try:
        decision = decide_agent_action(request.request)

        return {
            "success": True,
            "message": "Agent decision generated",
            "decision": decision
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Agent decision failed: {str(e)}"
        )

        # =========================
# AGENT APPROVAL
# =========================

class AgentApprovalRequest(BaseModel):
    approved: bool
    action: str
    task_id: int | None = None
    task: TaskCreate | None = None


@router.post("/agent/approve")
def agent_approve(
    request: AgentApprovalRequest,
    db: Session = Depends(get_db)
):
    # User rejected the proposed action
    if not request.approved:
        return {
            "success": True,
            "approved": False,
            "message": "Action rejected by user"
        }

    action = request.action.lower().strip()

    # =========================
    # CREATE
    # =========================

    if action == "create":

        if request.task is None:
            raise HTTPException(
                status_code=400,
                detail="Task data is required"
            )

        result = create_task_tool(
            db,
            request.task
        )

        return {
            "success": True,
            "approved": True,
            "action": "create",
            "message": "Task created after user approval",
            "task": result
        }

    # =========================
    # LIST
    # =========================

    elif action == "list":

        tasks = get_tasks_tool(db)

        return {
            "success": True,
            "approved": True,
            "action": "list",
            "tasks": tasks
        }

    # =========================
    # UPDATE
    # =========================

    elif action == "update":

        if request.task_id is None:
            raise HTTPException(
                status_code=400,
                detail="task_id is required"
            )

        if request.task is None:
            raise HTTPException(
                status_code=400,
                detail="Task data is required"
            )

        result = update_task_tool(
            db,
            request.task_id,
            request.task
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Task not found"
            )

        return {
            "success": True,
            "approved": True,
            "action": "update",
            "message": "Task updated after user approval",
            "task": result
        }

    # =========================
    # COMPLETE
    # =========================

    elif action == "complete":

        if request.task_id is None:
            raise HTTPException(
                status_code=400,
                detail="task_id is required"
            )

        result = complete_task_tool(
            db,
            request.task_id
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Task not found"
            )

        return {
            "success": True,
            "approved": True,
            "action": "complete",
            "message": "Task completed after user approval",
            "task": result
        }

    # =========================
    # DELETE
    # =========================

    elif action == "delete":

        if request.task_id is None:
            raise HTTPException(
                status_code=400,
                detail="task_id is required"
            )

        result = delete_task_tool(
            db,
            request.task_id
        )

        if result is None:
            raise HTTPException(
                status_code=404,
                detail="Task not found"
            )

        return {
            "success": True,
            "approved": True,
            "action": "delete",
            "message": "Task deleted after user approval",
            "task_id": result
        }

    else:

        raise HTTPException(
            status_code=400,
            detail="Unknown agent action"
        )