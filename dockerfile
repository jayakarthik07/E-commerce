FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PORT=5000
EXPOSE $PORT
CMD ["sh", "-c", "flask db upgrade && gunicorn --bind 0.0.0.0:$PORT app:app"]