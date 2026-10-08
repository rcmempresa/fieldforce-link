# Project architecture rules

- Specialized maintenance report types use dedicated React forms and PDF generators while persisting type-specific editable data in existing JSON fields; this keeps each form maintainable without breaking existing reports.
- Store each report's selected logo in its existing JSON payload and render it through the shared PDF logo helper; this preserves old reports without a database change.
- Work order titles are generated from the linked equipment (with AC indoor/outdoor unit via work_order_equipments.unit_part); a manual subject is only used when no equipment is selected, so lists can show the equipment being repaired.
- Completed-work-order emails attach the OT sheet plus every maintenance report PDF of that OT, downloaded server-side; keeps clients receiving the full documentation.
- Equipments carry a category (equipments.category) matching maintenance report types; report forms list only the OT's equipment of their category, so one OT can hold several equipments and produce one report per equipment.
