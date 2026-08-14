FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libreoffice-writer-nogui \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x entrypoint.sh && \
    git clone --depth 1 --filter=blob:none --sparse https://github.com/Sushmitagupta1/Shagun-CRM-ERP.git /tmp/shagun-repo && \
    cd /tmp/shagun-repo && git sparse-checkout set backend/templates && \
    cp -r backend/templates /app/templates && \
    rm -rf /tmp/shagun-repo

EXPOSE 8000

CMD ["./entrypoint.sh"]
