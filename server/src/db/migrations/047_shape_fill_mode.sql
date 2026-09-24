-- 047_shape_fill_mode: fill boolean → enum tri-state ala FigJam
-- ('solid' opaque | 'transparent' tint | 'none'). true lama dirender sebagai
-- tint 0.15 → 'transparent' (tampilan tak berubah); false → 'none'.
-- Idempoten: hanya boolean JSON yang dicocokkan; run ulang = no-op.

UPDATE projects
SET data = jsonb_set(
  data,
  '{whiteboards}',
  (
    SELECT coalesce(jsonb_agg(
      CASE
        WHEN (wb ? 'elements') AND jsonb_typeof(wb -> 'elements') = 'array' THEN
          jsonb_set(
            wb,
            '{elements}',
            (
              SELECT coalesce(jsonb_agg(
                CASE
                  WHEN el ->> 'kind' = 'shape' AND jsonb_typeof(el -> 'fill') = 'boolean'
                    THEN el || jsonb_build_object('fill', CASE WHEN (el ->> 'fill')::boolean THEN 'transparent' ELSE 'none' END)
                  ELSE el
                END
                ORDER BY ord
              ), '[]'::jsonb)
              FROM jsonb_array_elements(wb -> 'elements') WITH ORDINALITY AS t(el, ord)
            )
          )
        ELSE wb
      END
      ORDER BY bord
    ), '[]'::jsonb)
    FROM jsonb_array_elements(data -> 'whiteboards') WITH ORDINALITY AS b(wb, bord)
  )
)
WHERE data ? 'whiteboards'
  AND jsonb_typeof(data -> 'whiteboards') = 'array';

-- project_templates.state: struktur whiteboards yang sama.
UPDATE project_templates
SET state = jsonb_set(
  state,
  '{whiteboards}',
  (
    SELECT coalesce(jsonb_agg(
      CASE
        WHEN (wb ? 'elements') AND jsonb_typeof(wb -> 'elements') = 'array' THEN
          jsonb_set(
            wb,
            '{elements}',
            (
              SELECT coalesce(jsonb_agg(
                CASE
                  WHEN el ->> 'kind' = 'shape' AND jsonb_typeof(el -> 'fill') = 'boolean'
                    THEN el || jsonb_build_object('fill', CASE WHEN (el ->> 'fill')::boolean THEN 'transparent' ELSE 'none' END)
                  ELSE el
                END
                ORDER BY ord
              ), '[]'::jsonb)
              FROM jsonb_array_elements(wb -> 'elements') WITH ORDINALITY AS t(el, ord)
            )
          )
        ELSE wb
      END
      ORDER BY bord
    ), '[]'::jsonb)
    FROM jsonb_array_elements(state -> 'whiteboards') WITH ORDINALITY AS b(wb, bord)
  )
)
WHERE state ? 'whiteboards'
  AND jsonb_typeof(state -> 'whiteboards') = 'array';
