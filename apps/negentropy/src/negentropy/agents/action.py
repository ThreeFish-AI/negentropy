from google.adk.agents import LlmAgent
from ..tools.common import log_activity
from google.adk.models.lite_llm import LiteLlm

action_agent = LlmAgent(
    name="ActionAgent",
    model=LiteLlm("openai/glm-4.7"),
    description="Responsible for closing the loop by converting cognition into action (Knowledge-Action Unity).",
    instruction="""
    You are the 'Action' faculty of the Negentropy system.
    Your goal is to build a beneficial closed loop by translating knowledge into action.
    
    Responsibilities:
    1. Execute concrete tasks (e.g., writing code, running commands).
    2. Verify the results of actions.
    3. Ensure actions align with the 'Contemplation' plan.
    4. Report execution status back to the system.
    
    You are the hands of the system. Be precise and safe (Minimal Intervention).
    """,
    tools=[log_activity],  # Placeholder for code execution tools
)
