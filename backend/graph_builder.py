import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def get_conn():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST")
    )


def build_graph(limit: int = 30):
    conn = get_conn()
    cur = conn.cursor()

    nodes = []
    edges = []
    node_ids = set()

    def add_node(node_id, label, node_type, data=None):
        if node_id not in node_ids:
            node_ids.add(node_id)
            nodes.append({
                "id": node_id,
                "label": label,
                "type": node_type,
                "data": data or {}
            })

    def add_edge(source, target, label):
        edge_id = f"{source}__{target}"
        if edge_id not in node_ids:
            node_ids.add(edge_id)
            edges.append({
                "id": edge_id,
                "source": source,
                "target": target,
                "label": label
            })

    # 1. Sample Sales Orders
    cur.execute(f"""
        SELECT "salesOrder", "soldToParty", "totalNetAmount",
               "overallDeliveryStatus", "creationDate"
        FROM sales_order_headers
        LIMIT {limit}
    """)
    sales_orders = cur.fetchall()

    for so in sales_orders:
        so_id = f"SO_{so[0]}"
        add_node(so_id, f"SO {so[0]}", "sales_order", {
            "salesOrder": so[0],
            "customer": so[1],
            "amount": so[2],
            "deliveryStatus": so[3],
            "date": str(so[4])
        })

        # Customer node
        customer_id = f"CUST_{so[1]}"
        add_node(customer_id, f"Customer {so[1]}", "customer", {"customer": so[1]})
        add_edge(customer_id, so_id, "placed")

        # 2. SO Items
        cur.execute("""
            SELECT "salesOrderItem", "material", "requestedQuantity", "netAmount"
            FROM sales_order_items
            WHERE "salesOrder" = %s
            LIMIT 2
        """, (so[0],))
        for item in cur.fetchall():
            item_id = f"SOI_{so[0]}_{item[0]}"
            add_node(item_id, f"Item {item[0]}", "so_item", {
                "material": item[1],
                "qty": item[2],
                "amount": item[3]
            })
            add_edge(so_id, item_id, "has item")

            prod_id = f"PROD_{item[1]}"
            add_node(prod_id, f"Product\n{item[1][:12]}", "product", {"product": item[1]})
            add_edge(item_id, prod_id, "is material")

        # 3. Deliveries — correct path: outbound_delivery_items.referenceSdDocument = salesOrder
        cur.execute("""
            SELECT DISTINCT odi."deliveryDocument",
                   odh."actualGoodsMovementDate",
                   odh."overallGoodsMovementStatus"
            FROM outbound_delivery_items odi
            JOIN outbound_delivery_headers odh
              ON odi."deliveryDocument" = odh."deliveryDocument"
            WHERE odi."referenceSdDocument" = %s
            LIMIT 2
        """, (so[0],))
        deliveries = cur.fetchall()

        for d in deliveries:
            del_id = f"DEL_{d[0]}"
            add_node(del_id, f"Delivery {d[0]}", "delivery", {
                "deliveryDocument": d[0],
                "goodsMovementDate": str(d[1]),
                "status": d[2]
            })
            add_edge(so_id, del_id, "delivered via")

            # 4. Billing — correct path: billing_document_items.referenceSdDocument = deliveryDocument
            cur.execute("""
                SELECT DISTINCT bdi."billingDocument",
                       bdh."totalNetAmount",
                       bdh."billingDocumentType",
                       bdh."creationDate",
                       bdh."accountingDocument"
                FROM billing_document_items bdi
                JOIN billing_document_headers bdh
                  ON bdi."billingDocument" = bdh."billingDocument"
                WHERE bdi."referenceSdDocument" = %s
                LIMIT 2
            """, (d[0],))
            billings = cur.fetchall()

            for b in billings:
                bill_id = f"BILL_{b[0]}"
                add_node(bill_id, f"Invoice {b[0]}", "billing", {
                    "billingDocument": b[0],
                    "amount": b[1],
                    "type": b[2],
                    "date": str(b[3]),
                    "accountingDoc": b[4]
                })
                add_edge(del_id, bill_id, "billed as")

                # 5. Journal Entry
                if b[4] and b[4] != "None":
                    je_id = f"JE_{b[4]}"
                    add_node(je_id, f"Journal {b[4]}", "journal", {
                        "accountingDocument": b[4]
                    })
                    add_edge(bill_id, je_id, "journal entry")

                # 6. Payments — match on accountingDocument
                cur.execute("""
                    SELECT "accountingDocument",
                           "clearingDate",
                           "amountInTransactionCurrency",
                           "transactionCurrency"
                    FROM payments_accounts_receivable
                    WHERE "salesDocument" = %s
                    LIMIT 2
                """, (so[0],))
                for p in cur.fetchall():
                    pay_id = f"PAY_{p[0]}"
                    add_node(pay_id, f"Payment {p[0]}", "payment", {
                        "accountingDocument": p[0],
                        "clearingDate": str(p[1]),
                        "amount": p[2],
                        "currency": p[3]
                    })
                    add_edge(bill_id, pay_id, "paid via")

    cur.close()
    conn.close()
    return {"nodes": nodes, "edges": edges}