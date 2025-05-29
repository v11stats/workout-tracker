UPDATE workout_data
SET value = REPLACE(value, 'mm', '')
WHERE category = 'hangboard_sets'
  AND variable_name LIKE 'set_%_edge_size'
  AND value LIKE '%mm';
