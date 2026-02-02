from negentropy.agents.agent import root_agent
from negentropy.engine.factories import get_runner

# Expose the root agent for the ADK runner
# This allows 'uv run adk web src/negentropy' to find the agent
agent = root_agent

# Expose pre-configured runner for programmatic usage
# Runner is configured with PostgreSQL-backed SessionService and MemoryService
runner = get_runner()

if __name__ == "__main__":
    # Optional: simpler local run for debugging
    print(f"Negentropy Agent loaded: {agent.name}")
    print(f"Runner configured with session_service: {type(runner.session_service).__name__}")
