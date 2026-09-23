-- 044_whiteboard_light_canvas: kanvas whiteboard selalu putih bersih ala FigJam.
-- Elemen lama menyimpan warna terang-legacy (didesain untuk kanvas gelap:
-- teks #e4e4e7 tak terbaca di putih). Rewrite permanen ke padanan gelap.
-- Idempoten: hanya nilai legacy persis yang dicocokkan; run ulang = no-op.
-- Dikecualikan: sticky fill (punya background sendiri, terbaca di putih)
-- dan nilai custom di luar tabel (niat eksplisit user, perilaku tak berubah).

-- Luminansi relatif 0..1 untuk hex #rrggbb; NULL bila tak terparse.
CREATE OR REPLACE FUNCTION pg_temp.wb_luminance_044(c text)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  r int; g int; b int;
  rf double precision; gf double precision; bf double precision;
BEGIN
  IF c IS NULL OR c !~ '^#[0-9a-fA-F]{6}$' THEN
    RETURN NULL;
  END IF;
  r := ('x' || substring(c, 2, 2))::bit(8)::int;
  g := ('x' || substring(c, 4, 2))::bit(8)::int;
  b := ('x' || substring(c, 6, 2))::bit(8)::int;
  rf := r / 255.0; gf := g / 255.0; bf := b / 255.0;
  rf := CASE WHEN rf <= 0.03928 THEN rf / 12.92 ELSE power((rf + 0.055) / 1.055, 2.4) END;
  gf := CASE WHEN gf <= 0.03928 THEN gf / 12.92 ELSE power((gf + 0.055) / 1.055, 2.4) END;
  bf := CASE WHEN bf <= 0.03928 THEN bf / 12.92 ELSE power((bf + 0.055) / 1.055, 2.4) END;
  RETURN 0.2126 * rf + 0.7152 * gf + 0.0722 * bf;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.migrate_wb_element_044(el jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  kind text := el ->> 'kind';
  map jsonb := '{
    "#e4e4e7": "#374151",
    "#f1f5f9": "#0f172a",
    "#6ea8fe": "#2563eb",
    "#e8b955": "#b45309",
    "#f2b8c6": "#db2777",
    "#34c38e": "#047857",
    "#5db69b": "#0f766e",
    "#a78bfa": "#7c3aed"
  }';
  out jsonb := el;
  col text := el ->> 'color';
  newcol text := col;
  lbl text;
  fillon boolean := coalesce((el ->> 'fill')::boolean, false);
  -- Gelap = luminansi < 0.35 (mencakup mapping gelap + custom gelap user).
  -- Dihitung SETELAH mapping (newcol), bukan dari warna mentah.
  fdark boolean;
BEGIN
  -- color: semua kind KECUALI sticky (fill sticky terbaca di putih).
  IF kind <> 'sticky' AND col IS NOT NULL AND map ? lower(col) THEN
    newcol := map ->> lower(col);
    out := out || jsonb_build_object('color', newcol);
  END IF;

  IF kind = 'sticky' THEN
    -- textColor hanya bila fill-nya terang (fill gelap + teks terang = niat user).
    lbl := el ->> 'textColor';
    fdark := coalesce(pg_temp.wb_luminance_044(col), 1.0) < 0.35;
    IF lbl IS NOT NULL AND (map ? lower(lbl)) AND NOT fdark THEN
      out := out || jsonb_build_object('textColor', map ->> lower(lbl));
    END IF;
  ELSIF kind = 'shape' THEN
    -- Fill gelap + label null → label tak punya nilai terbaca → terangkan.
    -- Label terang eksplisit di atas fill gelap SUDAH terbaca → pertahankan
    -- (niat user). Label terang di atas fill terang → gelapkan.
    fdark := coalesce(pg_temp.wb_luminance_044(newcol), 1.0) < 0.35;
    lbl := el ->> 'labelColor';
    IF lbl IS NULL AND fillon AND fdark THEN
      out := out || jsonb_build_object('labelColor', '#f8fafc');
    ELSIF lbl IS NOT NULL AND (map ? lower(lbl)) AND NOT (fillon AND fdark) THEN
      out := out || jsonb_build_object('labelColor', map ->> lower(lbl));
    END IF;
  ELSIF kind = 'boundary' THEN
    -- Chip selalu di atas putih: label terang wajib jadi gelap.
    lbl := el ->> 'labelColor';
    IF lbl IS NOT NULL AND (map ? lower(lbl)) THEN
      out := out || jsonb_build_object('labelColor', map ->> lower(lbl));
    END IF;
  END IF;
  -- text/edge/stroke/ref: label memakai color (sudah di-map); tak ada key tambahan.
  RETURN out;
END;
$$;

-- projects.data -> whiteboards[] -> elements[]
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
              SELECT coalesce(jsonb_agg(pg_temp.migrate_wb_element_044(el) ORDER BY ord), '[]'::jsonb)
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
              SELECT coalesce(jsonb_agg(pg_temp.migrate_wb_element_044(el) ORDER BY ord), '[]'::jsonb)
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
