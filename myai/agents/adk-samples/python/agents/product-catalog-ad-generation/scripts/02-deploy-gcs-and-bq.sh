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
#!/bin/bash
# scripts/02-deploy-gcs-and-bq.sh
# Step 2: GCS and BigQuery Setup
# Provisions a GCS bucket for static content and sets up BigQuery resources.

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---

# Source environment variables from .env file if it exists
if [ -f .env ]; then
  echo "🔑 Sourcing environment variables from .env file..."
  set -a
  source .env
  set +a
else
  echo "⚠️ Warning: .env file not found. Relying on exported environment variables."
fi

# Get required variables from environment
PROJECT_ID=${GOOGLE_CLOUD_PROJECT}

if [ -z "${PROJECT_ID}" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT environment variable is not set."
  echo "Please set it to your Google Cloud project ID."
  exit 1
fi

REGION=${REGION:-"us-central1"}

# --- GCS Bucket Name ---
# Bucket for storing static content like template images and branding.
STATIC_CONTENT_BUCKET="${PROJECT_ID}-contentgen-static"

# --- BigQuery Configuration ---
BQ_DATASET="content_generation"
BQ_TABLE="media_assets"

echo "🚀 Starting GCS bucket and BigQuery deployment for project ${PROJECT_ID}..."

# --- GCS Bucket Creation ---
echo "📦 Creating GCS Bucket for Static Content..."
if gsutil ls -b "gs://${STATIC_CONTENT_BUCKET}" &> /dev/null; then
    echo "   -> Bucket gs://${STATIC_CONTENT_BUCKET} already exists."
else
    gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://${STATIC_CONTENT_BUCKET}"
    echo "   -> Bucket gs://${STATIC_CONTENT_BUCKET} created."
fi
echo "✅ GCS bucket is ready."
echo

# --- Create Folders ---
echo "📁 Creating folders in the bucket..."
echo "   -> Folders 'template_images', 'branding_logos', and 'products' will be created by upload."
echo

# --- Function to handle uploads with confirmation ---
upload_with_confirmation() {
  local source_dir=$1
  local dest_folder=$2
  local dest_bucket_path="gs://${STATIC_CONTENT_BUCKET}/${dest_folder}/"

  echo "📤 Checking for existing content in ${dest_folder}..."
  if gsutil ls "${dest_bucket_path}" | grep -q '.'; then
    echo "   -> Folder ${dest_bucket_path} already contains files."
    read -p "   -> Do you want to clear the folder and re-upload from ${source_dir}? (y/n) " -n 1 -r
    echo # Move to a new line
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "   -> Clearing existing content from ${dest_folder} folder..."
      gsutil -m rm "${dest_bucket_path}**"
      echo "   -> Uploading new content..."
      gsutil -m cp -r "${source_dir}"/* "${dest_bucket_path}"
      echo "   -> Upload complete."
    else
      echo "   -> Skipping upload."
    fi
  else
    echo "   -> Folder is empty. Uploading content from ${source_dir}..."
    gsutil -m cp -r "${source_dir}"/* "${dest_bucket_path}"
    echo "   -> Upload complete."
  fi
  echo
}

# --- Upload Template Images ---
upload_with_confirmation "static/uploads/generated_image_template" "template_images"

# --- Upload Branding Logos ---
upload_with_confirmation "static/uploads/branding" "branding_logos"

# --- Upload Product Images ---
upload_with_confirmation "static/uploads/products" "products"

# --- Upload Videos ---
# upload_with_confirmation "static/uploads/videos" "videos"

# --- BigQuery Setup ---
echo "📊 Creating BigQuery dataset and table..."
# Check if dataset exists
if bq show "${PROJECT_ID}:${BQ_DATASET}" &> /dev/null; then
    echo "   -> Dataset ${BQ_DATASET} already exists."
    read -p "   -> Do you want to delete and recreate the dataset? This will also delete the '${BQ_TABLE}' table. (y/n) " -n 1 -r
    echo # Move to a new line
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   -> Deleting existing dataset ${BQ_DATASET}..."
        bq rm -r -f --dataset "${PROJECT_ID}:${BQ_DATASET}"
        echo "   -> Creating new dataset ${BQ_DATASET}..."
        bq mk --dataset --location="${REGION}" "${PROJECT_ID}:${BQ_DATASET}"
        echo "   -> Dataset ${BQ_DATASET} recreated."
    else
        echo "   -> Skipping dataset recreation. Exiting script."
        exit 0
    fi
else
    # Create dataset if it doesn't exist
    echo "   -> Creating dataset ${BQ_DATASET}..."
    bq mk --dataset --location="${REGION}" "${PROJECT_ID}:${BQ_DATASET}"
    echo "   -> Dataset ${BQ_DATASET} created."
fi

# --- Populate BigQuery Table using Gemini ---
echo "🤖 Populating BigQuery table using Gemini..."

# Install required Python libraries
echo "   -> Installing Python dependencies..."

# Check if pip3 command exists
if command -v pip3 &>/dev/null; then
    echo "Using pip3..."
    pip_cmd="pip3"
# If pip3 is not found, check for pip
elif command -v pip &>/dev/null; then
    echo "Using pip..."
    pip_cmd="pip"
else
    echo "Error: pip or pip3 not found. Please install Python and pip."
    exit 1
fi

"$pip_cmd" install --upgrade --user -q google-genai google-cloud-bigquery google-cloud-storage

# Run the Python script
echo "   -> Running Python script to populate BigQuery..."
python3 scripts/populate_bq_with_gemini.py \
    --project_id "${PROJECT_ID}" \
    --bucket_name "${STATIC_CONTENT_BUCKET}" \
    --dataset_id "${BQ_DATASET}" \
    --table_id "${BQ_TABLE}" \
    --region "${REGION}"

echo "✅ BigQuery table population process initiated."
echo "   -> BigQuery Table: ${PROJECT_ID}:${BQ_DATASET}.${BQ_TABLE}"
echo

# --- Output bucket name for user ---
echo "📋 Please use these full bucket destinations for the next steps:"
echo "   Static Content Bucket: gs://${STATIC_CONTENT_BUCKET}"
echo "   Template Images Folder: gs://${STATIC_CONTENT_BUCKET}/template_images/"
echo "   Branding & Logos Folder: gs://${STATIC_CONTENT_BUCKET}/branding_logos/"
echo "   Products Folder: gs://${STATIC_CONTENT_BUCKET}/products/"
echo

echo " 🎉 Infrastructure deployment is complete! "
