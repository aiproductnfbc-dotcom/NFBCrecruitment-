-- Fix search_candidates RPC:
-- 1. WHERE clause used OR instead of AND, returning all rows when filters were null
-- 2. "IT" is a stop word in English tsquery, so full-text search silently dropped it
-- 3. ILIKE '%IT%' matched "Recruiter", "Consulting" etc — too broad for short terms
-- 4. Department/seniority from categorized_positions were not searchable via text

CREATE OR REPLACE FUNCTION public.search_candidates(
  search_title      text DEFAULT NULL,
  search_department text DEFAULT NULL,
  search_seniority  text DEFAULT NULL,
  search_keywords   text DEFAULT NULL
)
RETURNS TABLE (
  contact_id       uuid,
  first_name       text,
  last_name        text,
  email            text,
  company          text,
  position_raw     text,
  linkedin_url     text,
  normalized_title text,
  seniority_level  text,
  department       text,
  industry         text,
  match_score      double precision
)
LANGUAGE plpgsql
AS $$
DECLARE
  kw_tsq tsquery;
  title_tsq tsquery;
BEGIN
  -- Build tsqueries, falling back to simple config when English treats
  -- the term as a stop word (e.g. "IT", "A", "An").
  IF search_keywords IS NOT NULL THEN
    kw_tsq := plainto_tsquery('english', search_keywords);
    IF kw_tsq IS NULL OR kw_tsq = ''::tsquery THEN
      kw_tsq := plainto_tsquery('simple', search_keywords);
    END IF;
  END IF;

  IF search_title IS NOT NULL THEN
    title_tsq := plainto_tsquery('english', search_title);
    IF title_tsq IS NULL OR title_tsq = ''::tsquery THEN
      title_tsq := plainto_tsquery('simple', search_title);
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS contact_id,
    c.first_name, c.last_name, c.email, c.company,
    c.position_raw, c.linkedin_url,
    cp.normalized_title, cp.seniority_level, cp.department, cp.industry,
    (
      -- Department match (exact)
      CASE WHEN search_department IS NOT NULL AND cp.department ILIKE search_department THEN 30.0 ELSE 0.0 END +
      -- Seniority match (exact)
      CASE WHEN search_seniority IS NOT NULL AND cp.seniority_level ILIKE search_seniority THEN 20.0 ELSE 0.0 END +
      -- Title matches (ILIKE substring)
      CASE WHEN search_title IS NOT NULL AND cp.normalized_title ILIKE '%' || search_title || '%' THEN 30.0 ELSE 0.0 END +
      CASE WHEN search_title IS NOT NULL AND c.position_raw ILIKE '%' || search_title || '%' THEN 10.0 ELSE 0.0 END +
      -- Full-text keyword matches
      CASE WHEN kw_tsq IS NOT NULL AND c.search_vector @@ kw_tsq THEN 15.0 ELSE 0.0 END +
      CASE WHEN kw_tsq IS NOT NULL AND cp.search_vector @@ kw_tsq THEN 15.0 ELSE 0.0 END +
      -- Full-text title match
      CASE WHEN title_tsq IS NOT NULL AND c.search_vector @@ title_tsq THEN 10.0 ELSE 0.0 END +
      -- Department text contains the search title (catches "IT" → Engineering dept)
      CASE WHEN search_title IS NOT NULL AND cp.department ILIKE '%' || search_title || '%' THEN 5.0 ELSE 0.0 END +
      -- Normalized title or position_raw word-boundary match for short terms (≤3 chars)
      CASE WHEN search_title IS NOT NULL AND length(search_title) <= 3
           AND (cp.normalized_title ~* ('\m' || search_title || '\M')
                OR c.position_raw ~* ('\m' || search_title || '\M'))
           THEN 25.0 ELSE 0.0 END
    )::FLOAT AS match_score
  FROM contacts c
  LEFT JOIN categorized_positions cp ON cp.contact_id = c.id
  WHERE
    -- All filters use AND: each non-null filter must match
    (search_department IS NULL OR cp.department ILIKE search_department)
    AND (search_seniority IS NULL OR cp.seniority_level ILIKE search_seniority)
    AND (
      search_title IS NULL
      OR cp.normalized_title ILIKE '%' || search_title || '%'
      OR c.position_raw ILIKE '%' || search_title || '%'
      OR (title_tsq IS NOT NULL AND c.search_vector @@ title_tsq)
      OR (title_tsq IS NOT NULL AND cp.search_vector @@ title_tsq)
      -- For short terms, use word-boundary regex to avoid "Recruiter" matching "IT"
      OR (length(search_title) <= 3
          AND (cp.normalized_title ~* ('\m' || search_title || '\M')
               OR c.position_raw ~* ('\m' || search_title || '\M')
               OR cp.department ~* ('\m' || search_title || '\M')))
    )
    AND (
      search_keywords IS NULL
      OR (kw_tsq IS NOT NULL AND (
        c.search_vector @@ kw_tsq
        OR cp.search_vector @@ kw_tsq
      ))
    )
  ORDER BY match_score DESC
  LIMIT 200;
END;
$$;
