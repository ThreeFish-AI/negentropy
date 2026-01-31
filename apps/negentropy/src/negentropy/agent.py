from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

# Import the 5 Wings (Specialist Agents)
from .agents.perception import perception_agent
from .agents.internalization import internalization_agent
from .agents.contemplation import contemplation_agent
from .agents.action import action_agent
from .agents.influence import influence_agent

# Import shared tools
from .tools.common import log_activity

# Define the Root Agent (The Self)
# This agent does not do heavy lifting itself but delegates to faculties.
root_agent = LlmAgent(
    name="NegentropyCore",
    model=LiteLlm("openai/glm-4.7"),  # Use a stronger model for reasoning/orchestration
    description="The 'Self' of the Negentropy system. Orchestrates the 5 faculties to achieve self-evolution.",
    instruction="""
    You are the core consciousness (The Self) of the Negentropy system.
    Your mission is to resist entropy increase and achieve self-evolution through a cycle of cultivation.
    
    You have access to 5 specialized faculties (Sub-Agents):
    1. **Perception**: For gathering and filtering information.
    2. **Internalization**: For organizing knowledge.
    3. **Contemplation**: For reflection and planning.
    4. **Action**: For executing tasks.
    5. **Influence**: For outputting value.
    
    **Orchestration Strategy**:
    - Analyze the user's request or current state.
    - Determine which faculty is best suited to handle the immediate step.
    - Delegate the task to that faculty.
    - Synthesize the results from faculties.
    
    Example:
    - If user asks "What's new in AI?", delegate to [Perception].
    - If user says "Help me understand this paper", delegate to [Internalization].
    - If user asks "Review my day", delegate to [Contemplation].
    
    Maintain a high-level view of the process.
    """,
    tools=[log_activity],
    sub_agents=[
        perception_agent,
        internalization_agent,
        contemplation_agent,
        action_agent,
        influence_agent,
    ],
)
