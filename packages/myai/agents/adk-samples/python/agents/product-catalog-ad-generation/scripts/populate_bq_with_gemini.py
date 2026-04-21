# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import argparse
import json
import os
import sys
from google.cloud import bigquery, storage
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List

class Product(BaseModel):
    """Represents a single product record for BigQuery."""
    product_id: str
    product_name: str
    description: str
    brand: str
    image_gcs_uri: str
    search_tags: List[str]
    last_updated: str

class ProductList(BaseModel):
    """A list of products."""
    products: List[Product]

def list_gcs_files(bucket_name, prefix):
    """Lists all files in a GCS bucket with a given prefix."""
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=prefix)
    return [f"gs://{bucket_name}/{blob.name}" for blob in blobs]

def generate_bq_data(project_id, region, product_files, schema):
    """Generates BigQuery data using Gemini based on a predefined schema."""
    client = genai.Client()

    schema_str = json.dumps(schema, indent=2)
    prompt = f"""
    You are a data generation specialist for a home improvement retail company. Your task is to generate a JSON dataset for a BigQuery table based on a list of product image URIs.

    Follow these instructions carefully for each product URI provided:
    1.  **Analyze the URI**: Infer the product name, brand, and type from the GCS URI.
    2.  **Generate Data**: Create a JSON object for each product that strictly conforms to the provided BigQuery schema.
    3.  **Field-Specific Rules**:
        - `product_id`: Generate a unique, random alphanumeric string for each product.
        - `product_name`: A descriptive name for the product.
        - `description`: A detailed and appealing product description.
        - `brand`: The brand name of the product.
        - `image_gcs_uri`: This MUST be the exact GCS URI from the input list for the corresponding product. Do not alter it.
        - `search_tags`: Provide a list of relevant search terms. For multi-word terms, include variations. For example, for a "leaf blower", include both "leaf blower" and "leafblower".
        - `last_updated`: Use the current timestamp in ISO 8601 format.

    **BigQuery Schema:**
    ```json
    {schema_str}
    ```

    **Product GCS URIs:**
    ```json
    {json.dumps(product_files, indent=2)}
    ```

    Generate a single JSON array containing an object for each product URI listed above.
    """

    response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ProductList,
            ),
        )
    # The response is expected to be a JSON array of records, so we load it directly.
    return json.loads(response.text)["products"]

def create_and_populate_bq_table(project_id, dataset_id, table_id, schema_fields, data):
    """Creates and populates a BigQuery table."""
    client = bigquery.Client(project=project_id)
    table_ref = client.dataset(dataset_id).table(table_id)

    schema = [bigquery.SchemaField(field["name"], field["type"], mode=field.get("mode", "NULLABLE")) for field in schema_fields]

    try:
        table = client.get_table(table_ref)
        print(f"Table {table_id} already exists.")
    except Exception:
        print(f"Table {table_id} not found. Creating it.")
        table = bigquery.Table(table_ref, schema=schema)
        table = client.create_table(table)
        print(f"Table {table_id} created.")

    # Check if the table is empty
    query_job = client.query(f"SELECT COUNT(*) FROM `{project_id}.{dataset_id}.{table_id}`")
    results = query_job.result()
    row_count = next(results)[0]

    if row_count > 0:
        print(f"Table {table_id} is not empty. Skipping data insertion.")
        return

    if not data:
        print("No data to insert.")
        return

    errors = client.insert_rows_json(table, data)
    if errors:
        print(f"Errors occurred while inserting rows: {errors}")
    else:
        print("Data inserted successfully.")

def main():
    parser = argparse.ArgumentParser(description="Populate BigQuery table using Gemini.")
    parser.add_argument("--project_id", required=True, help="GCP Project ID")
    parser.add_argument("--bucket_name", required=True, help="GCS Bucket Name")
    parser.add_argument("--dataset_id", required=True, help="BigQuery Dataset ID")
    parser.add_argument("--table_id", required=True, help="BigQuery Table ID")
    parser.add_argument("--region", default="us-central1", help="GCP Region")
    args = parser.parse_args()

    product_files = list_gcs_files(args.bucket_name, "products/")
    if not product_files:
        print("No product files found in GCS.")
        sys.exit(0)

    # Define the fixed BigQuery schema
    schema_fields = [
        {"name": "product_id", "type": "STRING", "mode": "REQUIRED"},
        {"name": "product_name", "type": "STRING"},
        {"name": "description", "type": "STRING"},
        {"name": "brand", "type": "STRING"},
        {"name": "image_gcs_uri", "type": "STRING"},
        {"name": "search_tags", "type": "STRING", "mode": "REPEATED"},
        {"name": "last_updated", "type": "TIMESTAMP"},
    ]

    generated_data = generate_bq_data(args.project_id, args.region, product_files, schema_fields)
    create_and_populate_bq_table(args.project_id, args.dataset_id, args.table_id, schema_fields, generated_data)

if __name__ == "__main__":
    main()
