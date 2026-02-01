from negentropy.agents.agent import root_agent

# Expose the root agent for the ADK runner
# This allows 'uv run adk web src/negentropy' to find the agent
agent = root_agent

if __name__ == "__main__":
    # Optional: simpler local run for debugging
    print(f"Negentropy Agent loaded: {agent.name}")
