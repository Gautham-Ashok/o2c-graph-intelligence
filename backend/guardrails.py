# Domain keywords for the O2C dataset
DOMAIN_KEYWORDS = [
    "order", "sales", "invoice", "billing", "delivery", "product",
    "payment", "customer", "material", "plant", "journal", "document",
    "account", "receivable", "shipment", "quantity", "amount",
    "partner", "address", "schedule", "cancellation"
]

OUT_OF_SCOPE_PHRASES = [
    "write a poem", "tell me a joke", "what is the capital",
    "recipe", "weather", "sports", "movie", "history of",
    "explain quantum", "who is the president"
]

def is_valid_query(question: str) -> bool:
    q = question.lower()

    # Reject known off-topic phrases
    for phrase in OUT_OF_SCOPE_PHRASES:
        if phrase in q:
            return False

    # Must contain at least one domain keyword
    return any(kw in q for kw in DOMAIN_KEYWORDS)