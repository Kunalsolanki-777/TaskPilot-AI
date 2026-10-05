from sqlalchemy.orm import Session

from models import Task
from schemas import TaskCreate


def create_task_tool(db: Session, task_data: TaskCreate):
    task = Task(
        title=task_data.title,
        description=task_data.description,
        priority=task_data.priority,
        deadline=task_data.deadline,
        action_plan=task_data.action_plan,
        status="Pending"
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


def get_tasks_tool(db: Session):
    return db.query(Task).all()


def update_task_tool(
    db: Session,
    task_id: int,
    task_data: TaskCreate
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        return None

    task.title = task_data.title
    task.description = task_data.description
    task.priority = task_data.priority
    task.deadline = task_data.deadline
    task.action_plan = task_data.action_plan

    db.commit()
    db.refresh(task)

    return task


def complete_task_tool(db: Session, task_id: int):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        return None

    task.status = "Completed"

    db.commit()
    db.refresh(task)

    return task


def delete_task_tool(db: Session, task_id: int):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        return None

    db.delete(task)
    db.commit()

    return task_id