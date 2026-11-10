-- Platform fee of a chat: 20% of the consultant's price, at least R$ 5,00 (was a flat R$ 5,00, which
-- loses money on pricier chats once the payment provider's fee is paid). The customer pays
-- price + fee; the consultant receives the full price. Mirrors chatFeeCents() in src/lib/booking-policy.ts.
create or replace function public.chat_fee_cents(p_price_cents integer)
returns integer language sql immutable set search_path = '' as $$
  select greatest(500, round(p_price_cents * 0.20)::integer)
$$;

do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.create_message_booking(text,text[],text,text[])'::regprocedure);
  if position('chat_fee_cents' in v_def) > 0 then return; end if;
  if position('v_fee integer := 500;' in v_def) = 0 then raise exception 'create_message_booking fee not found'; end if;
  v_def := replace(v_def, 'v_fee integer := 500;', 'v_fee integer;');
  -- The fee is computed once the price is known (right after "format_not_offered").
  if position('if v_price is null then raise exception ''format_not_offered''; end if;' in v_def) = 0 then raise exception 'create_message_booking price check not found'; end if;
  v_def := replace(v_def, 'if v_price is null then raise exception ''format_not_offered''; end if;', 'if v_price is null then raise exception ''format_not_offered''; end if;' || E'\n  v_fee := public.chat_fee_cents(v_price);');
  execute v_def;
end $$;
