import os
import re
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

DB_SCHEMA = """
Tables and their key columns:

sales_order_headers:
  salesOrder (PK), salesOrderType, soldToParty, creationDate,
  totalNetAmount, overallDeliveryStatus, overallOrdReltdBillgStatus,
  transactionCurrency, requestedDeliveryDate

sales_order_items:
  salesOrder (FK→sales_order_headers), salesOrderItem, material,
  requestedQuantity, netAmount, productionPlant, storageLocation

billing_document_headers:
  billingDocument (PK), billingDocumentType, creationDate,
  totalNetAmount, companyCode, fiscalYear, accountingDocument, soldToParty,
  billingDocumentIsCancelled

billing_document_items:
  billingDocument (FK→billing_document_headers), billingDocumentItem,
  material, billingQuantity, netAmount,
  referenceSdDocument (FK→outbound_delivery_headers.deliveryDocument),
  referenceSdDocumentItem

outbound_delivery_headers:
  deliveryDocument (PK), creationDate, actualGoodsMovementDate,
  overallGoodsMovementStatus, overallPickingStatus, shippingPoint

outbound_delivery_items:
  deliveryDocument (FK→outbound_delivery_headers), deliveryDocumentItem,
  actualDeliveryQuantity, plant,
  referenceSdDocument (FK→sales_order_headers.salesOrder),
  referenceSdDocumentItem

payments_accounts_receivable:
  accountingDocument (PK), companyCode, fiscalYear, clearingDate,
  amountInTransactionCurrency, customer,
  salesDocument (FK→sales_order_headers.salesOrder),
  invoiceReference, transactionCurrency

journal_entry_items_accounts_receivable:
  accountingDocument, accountingDocumentItem, companyCode, fiscalYear,
  postingDate, amountInTransactionCurrency, customer,
  referenceDocument (FK→billing_document_headers.billingDocument)

business_partners:
  businessPartner (PK), customer (FK→soldToParty), businessPartnerFullName,
  industry, businessPartnerIsBlocked

business_partner_addresses:
  businessPartner (FK), cityName, country, streetName, postalCode

products:
  product (PK), productType, grossWeight, netWeight, productGroup,
  baseUnit, division

product_descriptions:
  product (FK→products), productDescription, language

plants:
  plant (PK), plantName, cityName, country

billing_document_cancellations:
  billingDocument (FK), cancelledBillingDocument

customer_company_assignments:
  customer, companyCode, paymentTerms, accountGroup

customer_sales_area_assignments:
  customer, salesOrganization, distributionChannel, salesGroup

sales_order_schedule_lines:
  salesOrder, salesOrderItem, scheduleLine, requestedDeliveryDate,
  scheduledQuantity
"""


def clean_sql(text: str) -> str:
    text = text.strip()
    text = re.sub(r"```sql", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```", "", text)
    return text.strip()


def generate_sql(question: str, history: list = []) -> str:
    prompt = f"""You are a PostgreSQL expert for an SAP Order-to-Cash (O2C) system.

Your job is to convert a user's natural language question into a valid PostgreSQL query.

STRICT RULES:
1. Use ONLY the tables and columns listed in the schema below.
2. Do NOT invent column names. If unsure, use what's available.
3. All table and column names must be double-quoted exactly as shown.
4. Key JOIN paths (IMPORTANT - these are the ONLY correct relationships):
   - sales_order_items."salesOrder" = sales_order_headers."salesOrder"
   - outbound_delivery_items."referenceSdDocument" = sales_order_headers."salesOrder"
   - outbound_delivery_items."deliveryDocument" = outbound_delivery_headers."deliveryDocument"
   - billing_document_items."referenceSdDocument" = outbound_delivery_headers."deliveryDocument"
   - billing_document_items."billingDocument" = billing_document_headers."billingDocument"
   - payments_accounts_receivable."salesDocument" = sales_order_headers."salesOrder"
   - journal_entry_items_accounts_receivable."referenceDocument" = billing_document_headers."billingDocument"
   - business_partners."customer" = sales_order_headers."soldToParty"
5. ALL columns are stored as TEXT. Always cast for math/aggregation: CAST("columnName" AS NUMERIC).
6. Return ONLY the SQL query. No explanation. No markdown.
7. Add LIMIT 50 if the query could return many rows.
8. Use conversation history below to resolve follow-up questions like "tell me more about that customer" or "what about their deliveries".

SCHEMA:
{DB_SCHEMA}

Question: {question}
SQL:"""

    # Build messages with history (last 3 exchanges only)
    messages = []
    for h in history[-6:]:  # last 3 user+assistant pairs
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=0
    )
    return clean_sql(response.choices[0].message.content)


def generate_answer(question: str, sql: str, results: list) -> str:
    if not results:
        data_str = "The query returned no results."
    else:
        rows_to_show = results[:20]
        data_str = "\n".join([str(r) for r in rows_to_show])
        if len(results) > 20:
            data_str += f"\n... and {len(results) - 20} more rows."

    prompt = f"""You are a helpful data analyst for an SAP Order-to-Cash system.

The user asked: "{question}"

The SQL query executed was:
{sql}

The results from the database:
{data_str}

Write a clear, concise natural language answer based ONLY on the data above.
Do not make up information. If data is empty, say no results were found.
Keep the answer under 5 sentences unless listing items."""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )
    return response.choices[0].message.content.strip()