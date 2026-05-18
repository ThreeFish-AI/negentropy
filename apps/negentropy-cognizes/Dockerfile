FROM python:3.12-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    curl \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY pyproject.toml ./

# 安装 Python 依赖
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e .

# 复制配置文件
COPY .env.example ./.env.example

# 复制应用代码
COPY agents/ ./agents/
COPY .claude/ ./.claude/

# 创建必要目录
RUN mkdir -p /app/logs /app/papers/source /app/papers/translation /app/papers/heartfelt /app/papers/images

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
CMD ["uvicorn", "agents.api.main:app", "--host", "0.0.0.0", "--port", "8000"]