"""
Streamlit 前端 - Travel Agent Demo
"""

import streamlit as st
import asyncio
from agent import create_travel_agent
from services import create_services
from config import config
from google.adk.runners import Runner
from google.genai import types

st.set_page_config(page_title="Travel Agent - Open Agent Engine Demo", page_icon="✈️", layout="wide")

# 初始化 Session State
if "messages" not in st.session_state:
    st.session_state.messages = []
if "session_id" not in st.session_state:
    st.session_state.session_id = None


async def get_runner():
    """获取或创建 Runner 实例"""
    # 每次请求重新创建 Services 和 Runner，以适应 asyncio.run 的新 Event Loop
    session_service, memory_service = await create_services()
    agent = create_travel_agent()
    runner = Runner(
        agent=agent,
        app_name=config.app_name,
        session_service=session_service,
        memory_service=memory_service,
    )
    return runner, session_service


async def chat(message: str):
    """处理用户消息"""
    runner, session_service = await get_runner()

    # 如果没有 session_id，先创建 session
    if st.session_state.session_id is None:
        session = await session_service.create_session(app_name=config.app_name, user_id=config.default_user_id)
        st.session_state.session_id = session.id

    # 创建消息内容
    new_message = types.Content(parts=[types.Part(text=message)])

    # 使用 run_async 执行对话
    response_text = ""
    async for event in runner.run_async(
        user_id=config.default_user_id,
        session_id=st.session_state.session_id,
        new_message=new_message,
    ):
        # 收集响应文本
        if hasattr(event, "content") and event.content:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    response_text = part.text  # 取最后一个文本响应

    return response_text or "抱歉，我无法理解您的请求。"


# UI 布局
st.title("✈️ Travel Agent - Open Agent Engine Demo")

# 侧边栏：配置信息
with st.sidebar:
    st.header("⚙️ Configuration")
    st.info(f"**Backend**: {config.backend.value}")
    st.info(f"**Model**: {config.model_name}")
    st.info(f"**Session**: {st.session_state.session_id or 'New'}")

    if st.button("🔄 New Conversation"):
        st.session_state.messages = []
        st.session_state.session_id = None
        st.rerun()

    st.header("📊 Debug")
    if st.button("🔍 View Traces"):
        st.markdown("[Open Langfuse UI](http://localhost:3000)")

# 聊天历史
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# 用户输入
if prompt := st.chat_input("Ask me about travel..."):
    # 显示用户消息
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # 获取 Agent 响应
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = asyncio.run(chat(prompt))
        st.markdown(response)
        st.session_state.messages.append({"role": "assistant", "content": response})
