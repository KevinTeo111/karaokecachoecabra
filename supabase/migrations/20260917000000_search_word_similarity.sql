-- Typo tolerance for short queries: compare the query against the best
-- matching word(s) of each song instead of the whole text ("despasito").

create or replace function search_songs(p_query text, p_limit integer default 8)
returns setof songs language sql stable security definer set search_path = public as $$
  with q as (select lower(unaccent(p_query)) as text)
  select s.*
    from songs s, q
   where s.embeddable and s.status = 'ok'
     and (unaccent(s.search_text) ilike '%' || q.text || '%'
          or word_similarity(q.text, unaccent(s.search_text)) >= 0.45)
   order by (s.verified::int * 2 + s.favorite::int) desc,
            (unaccent(s.search_text) ilike '%' || q.text || '%') desc,
            word_similarity(q.text, unaccent(s.search_text)) desc
   limit p_limit
$$;

revoke execute on function search_songs(text, integer) from public, anon, authenticated;
