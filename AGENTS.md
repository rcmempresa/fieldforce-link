# Project architecture rules

- Specialized maintenance report types use dedicated React forms and PDF generators while persisting type-specific editable data in existing JSON fields; this keeps each form maintainable without breaking existing reports.