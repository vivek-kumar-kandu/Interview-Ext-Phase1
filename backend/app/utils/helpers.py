import json
from typing import Any, List, Optional


def safe_str(item: Any) -> str:
    """
    Safely converts string, dict, list, or object items to clean, non-empty string representation.
    Handles dicts from JSON evidence parsing like {'skill': 'Python'}, {'role': 'Dev', 'company': 'ABC'}, etc.
    """
    if item is None:
        return ""
    if isinstance(item, str):
        return item.strip()
    if isinstance(item, (int, float)):
        return str(item)
    if isinstance(item, dict):
        # 1. Try explicit known keys
        for key in ["skill", "role", "name", "title", "jobTitle", "degree", "technology", "targetRole", "recommendedRole", "evidence", "description", "company"]:
            val = item.get(key)
            if val and isinstance(val, str) and val.strip():
                # If there's extra info like company, combine nicely
                company = item.get("company") if key in ["role", "jobTitle"] else None
                if company and isinstance(company, str) and company.strip() and key != "company":
                    return f"{val.strip()} at {company.strip()}"
                return val.strip()

        # 2. Extract and join all non-empty string values from dict
        parts = []
        for k, v in item.items():
            if isinstance(v, str) and v.strip():
                parts.append(v.strip())
            elif isinstance(v, list):
                sub_parts = [safe_str(sub) for sub in v]
                sub_str = ", ".join([p for p in sub_parts if p])
                if sub_str:
                    parts.append(sub_str)
            elif isinstance(v, dict):
                sub_s = safe_str(v)
                if sub_s:
                    parts.append(sub_s)
            elif isinstance(v, (int, float)):
                parts.append(str(v))
        if parts:
            return " ".join(parts)
        return json.dumps(item)

    if isinstance(item, list):
        converted = [safe_str(sub) for sub in item]
        return ", ".join([c for c in converted if c])

    return str(item).strip()


def safe_str_list(items: Optional[Any]) -> List[str]:
    """
    Ensures every element in a list/dict/item is converted to a clean string using safe_str.
    Filters out empty/blank strings.
    """
    if not items:
        return []
    if isinstance(items, str):
        s = items.strip()
        return [s] if s else []
    if isinstance(items, dict):
        s = safe_str(items)
        return [s] if s else []
    if not isinstance(items, (list, tuple, set)):
        s = safe_str(items)
        return [s] if s else []

    res = []
    for item in items:
        s = safe_str(item)
        if s:
            res.append(s)
    return res


def safe_join(sep: str, items: Optional[Any]) -> str:
    """
    Safely joins elements in items with separator sep, using safe_str for each element.
    Prevents 'sequence item 0: expected str instance, dict found' TypeError errors.
    """
    if not items:
        return ""
    if isinstance(items, str):
        return items.strip()
    if isinstance(items, dict):
        return safe_str(items)
    clean_list = safe_str_list(items)
    return sep.join(clean_list)

