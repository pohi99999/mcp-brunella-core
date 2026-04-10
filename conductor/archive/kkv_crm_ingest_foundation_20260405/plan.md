# KKV CRM ingest alapok

1. Validalni a CRM sandboxot es a bejovo lead payload mintakat.
2. Letrehozni a webhook/email ingest flow exportot n8n-ben.
3. Bevezetni a canonical `normalizeLead()` transformot es a dedupe logikat.
4. Kapcsolni a minimum persistenciat: temp store vagy kicsi SQLite buffer.
5. Hozzaadni a HubSpot sandbox push vagy stub endpointot.
6. Tesztelni a normalizalas, dedupe es ingest alap eseteit.

Kimenet: egyetlen lead vegigmegy az ingest csatornan, normalizalva es deduplicalva.
