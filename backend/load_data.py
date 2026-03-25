import os
import json
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(
    os.getenv("DATABASE_URL"),
    sslmode="require"
)
cursor = conn.cursor()

DATASET_PATH = "../dataset/sap-o2c-data"  # adjust if needed


def get_all_columns(folder_path):
    """Scan all JSONL files in folder to collect full column set."""
    all_keys = set()
    for file in os.listdir(folder_path):
        if file.endswith(".jsonl"):
            with open(os.path.join(folder_path, file)) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        row = json.loads(line)
                        all_keys.update(row.keys())
    return list(all_keys)


def create_table(table_name, columns):
    cols_def = ", ".join([f'"{c}" TEXT' for c in columns])
    cursor.execute(f'DROP TABLE IF EXISTS "{table_name}";')
    cursor.execute(f'CREATE TABLE "{table_name}" ({cols_def});')
    print(f"  Created table: {table_name} ({len(columns)} columns)")


def insert_rows(table_name, columns, folder_path):
    count = 0
    for file in os.listdir(folder_path):
        if file.endswith(".jsonl"):
            with open(os.path.join(folder_path, file)) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    row = json.loads(line)
                    values = [str(row.get(c, "")) for c in columns]
                    placeholders = ", ".join(["%s"] * len(columns))
                    col_names = ", ".join([f'"{c}"' for c in columns])
                    cursor.execute(
                        f'INSERT INTO "{table_name}" ({col_names}) VALUES ({placeholders})',
                        values
                    )
                    count += 1
    print(f"  Inserted {count} rows into {table_name}")


for folder in os.listdir(DATASET_PATH):
    folder_path = os.path.join(DATASET_PATH, folder)
    if not os.path.isdir(folder_path):
        continue

    print(f"\nProcessing: {folder}")
    columns = get_all_columns(folder_path)
    if not columns:
        print("  No columns found, skipping.")
        continue

    create_table(folder, columns)
    insert_rows(folder, columns, folder_path)

conn.commit()
cursor.close()
conn.close()
print("\n✅ ALL DATA LOADED SUCCESSFULLY")