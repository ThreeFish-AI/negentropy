import asyncio
import sys
import os

# Ensure we can import from the current directory
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.memory import InMemoryMemoryService
from google.genai import types

# Import the agent factory from agent.py
from agent import create_travel_agent


async def main():
    print("🔧 Initializing Baseline Environment (InMemory)...")

    # 1. Services
    session_service = InMemorySessionService()
    memory_service = InMemoryMemoryService()

    # 2. Agent
    try:
        travel_agent = create_travel_agent()
        print(f"🤖 Agent '{travel_agent.name}' created successfully")
    except Exception as e:
        print(f"❌ Failed to create agent: {e}")
        return

    # 3. Runner
    runner = Runner(
        agent=travel_agent, app_name="travel_agent", session_service=session_service, memory_service=memory_service
    )

    # 4. Create Session (Required for Runner.run_async)
    print("📂 Creating Session...")
    try:
        session = await session_service.create_session(app_name="travel_agent", user_id="test_user")
        print(f"✅ Session created: {session.id}")
    except Exception as e:
        print(f"❌ Failed to create session: {e}")
        return

    # 5. Execute Run
    user_msg_text = "我想去巴厘岛度假"
    print(f"\n🗣️  User: {user_msg_text}")
    print("⏳ Agent is thinking...", end=" ", flush=True)

    # Construct Content object
    message = types.Content(role="user", parts=[types.Part(text=user_msg_text)])

    try:
        full_response = ""
        async for event in runner.run_async(user_id="test_user", session_id=session.id, new_message=message):
            # Extract text from events to show response
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        text_chunk = part.text
                        full_response += text_chunk
                        print(text_chunk, end="", flush=True)

        print("\n\n✅ Baseline verification passed!")

    except Exception as e:
        print(f"\n❌ Execution failed: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
