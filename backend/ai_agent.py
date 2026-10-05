import os
import json
import time

from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel, Field


# ==========================================
# ENVIRONMENT
# ==========================================

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("GEMINI_API_KEY is missing from .env file")

client = genai.Client(api_key=API_KEY)


# ==========================================
# TASK PLAN MODEL
# ==========================================

class TaskPlan(BaseModel):
    title: str = Field(
        description="Short and clear task title"
    )

    priority: str = Field(
        description="Task priority: Low, Medium, or High"
    )

    deadline: str = Field(
        description="Deadline mentioned by the user, or 'Not specified'"
    )

    action_plan: list[str] = Field(
        description="Clear step-by-step actions required to complete the task"
    )


# ==========================================
# AGENT DECISION MODEL
# ==========================================

class AgentDecision(BaseModel):
    action: str = Field(
        description="One of: create, list, update, complete, delete"
    )

    reason: str = Field(
        description="Short explanation of why this action was selected"
    )

    task: TaskPlan | None = Field(
        default=None,
        description="Task details when action is create or update"
    )

    task_id: int | None = Field(
        default=None,
        description="Existing task ID when action is update, complete, or delete"
    )


# ==========================================
# NORMAL AI TASK ANALYSIS
# ==========================================

def analyze_task(user_request: str) -> TaskPlan:

    prompt = f"""
You are TaskPilot AI, an intelligent task planning agent.

Your job is to understand a user's natural-language request
and convert it into a practical task plan.

Rules:
1. Create a short meaningful title.
2. Determine priority as Low, Medium, or High.
3. Extract the deadline if one is mentioned.
4. If no deadline exists, return "Not specified".
5. Break the request into 2 to 6 useful action steps.
6. Do not invent specific facts that the user did not provide.
7. Return only the requested structured information.

User request:
{user_request}
"""

    models_to_try = [
        "gemini-3.8-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash"
    ]

    last_error = None

    for model_name in models_to_try:

        for attempt in range(3):

            try:
                print(
                    f"Trying {model_name}, attempt {attempt + 1}"
                )

                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={
                        "response_mime_type": "application/json",
                        "response_schema": TaskPlan,
                    },
                )

                data = json.loads(response.text)

                return TaskPlan.model_validate(data)

            except Exception as e:
                last_error = e

                print(
                    f"{model_name} failed: {e}"
                )

                time.sleep(2 ** attempt)

    raise RuntimeError(
        f"All AI models are temporarily unavailable. "
        f"Last error: {last_error}"
    )


# ==========================================
# AGENTIC DECISION
# ==========================================

def decide_agent_action(user_request: str) -> AgentDecision:

    prompt = f"""
You are TaskPilot AI, an agentic task-management assistant.

Understand the user's request and decide what action should be performed.

Allowed actions:

- create: create a new task
- list: show existing tasks
- update: modify an existing task
- complete: mark an existing task as completed
- delete: delete an existing task

Rules:

1. Choose exactly one action.
2. Do not invent a task ID.
3. If the user wants to create a task, generate a useful TaskPlan.
4. If an existing task ID is explicitly provided, use it.
5. If an action requires a task ID but none is available, keep task_id as null.
6. Explain the selected action briefly.
7. Return only structured information.

User request:
{user_request}
"""

    models_to_try = [
        "gemini-3.8-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash"
    ]

    last_error = None

    for model_name in models_to_try:

        for attempt in range(3):

            try:
                print(
                    f"Trying agent model {model_name}, attempt {attempt + 1}"
                )

                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={
                        "response_mime_type": "application/json",
                        "response_schema": AgentDecision,
                    },
                )

                data = json.loads(response.text)

                return AgentDecision.model_validate(data)

            except Exception as e:
                last_error = e

                print(
                    f"{model_name} failed: {e}"
                )

                time.sleep(2 ** attempt)

    raise RuntimeError(
        f"Agent decision failed. "
        f"Last error: {last_error}"
    )