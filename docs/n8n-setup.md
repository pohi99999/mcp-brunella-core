# n8n Sandbox Telepítési Útmutató (Robotkéz Edzőterem)

## 1. Docker Setup
Futtasd az alábbi parancsot egy elkülönített könyvtárban vagy add a meglévő `docker-compose.yml`-hez:

```yaml
services:
  n8n-sandbox:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_TEST_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_TEST_PASSWORD}
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
2. Elérhetőség
Az ügynök számára az URL: http://localhost:5678 (Docker hálózaton belül, ha a worker is ott fut, akkor a szerviznév használandó).
