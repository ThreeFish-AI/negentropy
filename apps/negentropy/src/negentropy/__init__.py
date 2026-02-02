from negentropy.agents.agent import root_agent
from negentropy.engine.factories import get_runner

# Expose the root agent for the ADK runner
# This allows 'uv run adk web src/negentropy' to find the agent
agent = root_agent

# Expose pre-configured runner for programmatic usage
runner = get_runner()
