-- 045_boundary_label_size: default label boundary 12 → 14 (kontrol size
-- boundary dihapus dari toolbar; board lama ikut membesar). Idempoten:
-- hanya fontSize tepat 12 pada kind boundary yang diubah; run ulang = no-op.
-- Nilai lain (termasuk custom) dan kind lain tak tersentuh.

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
                  WHEN el ->> 'kind' = 'boundary' AND el ->> 'fontSize' = '12'
                    THEN el || '{"fontSize": 14}'
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
                  WHEN el ->> 'kind' = 'boundary' AND el ->> 'fontSize' = '12'
                    THEN el || '{"fontSize": 14}'
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
