FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Hugging Face Spaces: контейнер работает не от root, папке data нужны права
RUN mkdir -p /app/data && chmod 777 /app/data
VOLUME /app/data

# Порт для health-сервера (нужен Hugging Face Spaces)
ENV PORT=7860
EXPOSE 7860

CMD ["python", "bot.py"]
