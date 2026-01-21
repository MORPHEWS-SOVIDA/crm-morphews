# Kit Pricing Logic v2

## Context
The system manages product sales where kits contain multiple units (e.g., Kit 6 = 6 bottles).

## Critical Rule
In `sale_items`, the `unit_price_cents` column must store the **price per individual unit** (per bottle), not the total kit price.

### Frontend Storage Pattern
Throughout the frontend flow (Add Receptivo, Product Selection Dialog), prices for kits are stored as **total kit price**:
- `unitPriceCents = R$1.134` for a Kit 6
- `quantity = 6` (number of bottles)

### Database Save Pattern
When saving to `sale_items`, the price MUST be divided by quantity:
- `unit_price_cents = Math.round(kitTotalPrice / kitQuantity)` = R$189 per bottle
- `quantity = 6`
- Result: 6 × R$189 = R$1.134 ✓

### Code Locations
The conversion happens in:
1. `src/pages/AddReceptivo.tsx` - `handleCreateSale()` function
2. `src/components/sales/ProductSelectionDialog.tsx` - `handleConfirm()` function

### Why This Matters
- Correct total calculation: `quantity * unit_price_cents`
- Accurate commission calculations
- Proper display in SaleDetail, Romaneio, and Expedition views
