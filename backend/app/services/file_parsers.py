import csv
from openpyxl import load_workbook

ITEM_HEADER_WORDS = {"item", "item name", "item_name", "itemname", "product", "material", "ingredient", "name", "description"}


def read_file_rows(file_path: str, ext: str) -> list[list]:
    rows: list[list] = []
    if ext == ".csv":
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for raw in reader:
                row = ["" if c is None else str(c).strip() for c in raw]
                if any(row):
                    rows.append(row)
    else:
        wb = load_workbook(file_path, data_only=True, read_only=True)
        try:
            ws = wb.active
            for raw in ws.iter_rows(values_only=True):
                row = ["" if c is None else (c if isinstance(c, (int, float)) else str(c).strip()) for c in raw]
                if any(row):
                    rows.append(row)
        finally:
            wb.close()
    return rows


def read_file_preview(file_path: str, ext: str) -> list[list]:
    """Read the complete file — no row or column caps."""
    return read_file_rows(file_path, ext)


def parse_item_qty_file(file_path: str, ext: str) -> list[tuple[str, float, str | None]]:
    rows: list[tuple[str, float, str | None]] = []
    for row in read_file_rows(file_path, ext):
        item = str(row[0]).strip() if len(row) > 0 else ""
        if not item or item.lower() in ITEM_HEADER_WORDS:
            continue
        try:
            qty = float(str(row[1]).replace(",", "")) if len(row) > 1 and row[1] else 0.0
        except (ValueError, TypeError):
            qty = 0.0
        if qty <= 0:
            continue
        unit = str(row[2]) if len(row) > 2 and row[2] else None
        rows.append((item, qty, unit))
    return rows


def _to_float(value) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(str(value).replace(",", "").replace("₹", "").strip())
    except (ValueError, TypeError):
        return None


def _normalize(text: str) -> str:
    return "".join(ch for ch in str(text).lower() if ch.isalnum())


def _find_col(headers: list[str], keywords: set[str]) -> int | None:
    normalized_keywords = {_normalize(k) for k in keywords}
    for i, h in enumerate(headers):
        if h and _normalize(h) in normalized_keywords:
            return i
    return None


def _cell(row: list, i: int | None) -> str:
    return row[i] if i is not None and i < len(row) else ""


def parse_vendor_file(file_path: str, ext: str) -> list[dict]:
    rows = read_file_rows(file_path, ext)
    if not rows:
        return []
    headers = rows[0]
    name_col = _find_col(headers, {"vendor", "vendor name", "vendor_name", "supplier", "supplier name"})
    service_col = _find_col(headers, {"service", "service name", "service_name", "service type"})
    rate_col = _find_col(headers, {"rate", "price", "rate (rs)", "rate (inr)"})
    cost_col = _find_col(headers, {"total cost", "total", "total_cost", "cost", "amount"})
    remark_col = _find_col(headers, {"remark", "remarks", "note", "notes", "comments"})

    result = []
    for row in rows[1:]:
        vendor_name = str(_cell(row, name_col)).strip() if name_col is not None else ""
        if not vendor_name:
            continue
        result.append({
            "vendor_name": vendor_name,
            "service_name": (str(_cell(row, service_col)).strip() or None) if service_col is not None else None,
            "rate": _to_float(_cell(row, rate_col)) if rate_col is not None else None,
            "total_cost": _to_float(_cell(row, cost_col)) if cost_col is not None else None,
            "remark": (str(_cell(row, remark_col)).strip() or None) if remark_col is not None else None,
        })
    return result


def parse_kitchen_inventory_file(file_path: str, ext: str) -> list[dict]:
    rows = read_file_rows(file_path, ext)
    if not rows:
        return []
    headers = rows[0]
    item_col = _find_col(headers, {"item", "item name", "item_name", "product", "dish", "preparation", "name"})
    prepared_col = _find_col(headers, {"prepared qty", "prepared", "prepared_qty", "qty prepared", "quantity prepared"})
    unit_col = _find_col(headers, {"unit", "uom"})
    used_col = _find_col(headers, {"used qty", "used", "used_qty", "qty used", "consumed"})
    remaining_col = _find_col(headers, {"remaining qty", "remaining", "remaining_qty", "qty remaining", "left"})
    remark_col = _find_col(headers, {"remark", "remarks", "note", "notes", "comments"})

    result = []
    for row in rows[1:]:
        item_name = str(_cell(row, item_col)).strip() if item_col is not None else ""
        if not item_name:
            continue
        result.append({
            "item_name": item_name,
            "prepared_qty": (_to_float(_cell(row, prepared_col)) or 0) if prepared_col is not None else 0,
            "unit": (str(_cell(row, unit_col)).strip() or None) if unit_col is not None else None,
            "used_qty": (_to_float(_cell(row, used_col)) or 0) if used_col is not None else 0,
            "remaining_qty": (_to_float(_cell(row, remaining_col)) or 0) if remaining_col is not None else 0,
            "remark": (str(_cell(row, remark_col)).strip() or None) if remark_col is not None else None,
        })
    return result
