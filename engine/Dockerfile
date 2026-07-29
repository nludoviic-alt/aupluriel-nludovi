FROM python:3.11-slim

WORKDIR /app

# Copy dependencies and install
COPY engine/requirements.txt /app/engine/requirements.txt
RUN pip install --no-cache-dir -r /app/engine/requirements.txt

# Copy source code
COPY engine /app/engine

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["python", "-m", "engine.server"]
