-- Seed: базовая цепочка Аргын → Мейрам → Куандық → Әмір Темір → Темеш и известные колена.
-- Запустить в SQL Editor ПОСЛЕ 001_init.sql.

do $$
declare
  argyn_id bigint;
  meiram_id bigint;
  kuandyk_id bigint;
  amir_temir_id bigint;
  temesh_id bigint;
begin
  insert into public.persons (full_name, is_alive, is_verified, bio)
  values ('Аргын', false, true, 'Родоначальник племени Аргын, Средний жуз.')
  returning id into argyn_id;

  insert into public.persons (full_name, father_id, is_alive, is_verified)
  values ('Мейрам', argyn_id, false, true) returning id into meiram_id;

  insert into public.persons (full_name, father_id, is_alive, is_verified)
  values ('Куандық', meiram_id, false, true) returning id into kuandyk_id;

  insert into public.persons (full_name, father_id, is_alive, is_verified)
  values ('Әмір Темір', kuandyk_id, false, true) returning id into amir_temir_id;

  insert into public.persons (full_name, father_id, is_alive, is_verified) values
    ('Бөріші', amir_temir_id, false, true);
  insert into public.persons (full_name, father_id, is_alive, is_verified)
  values ('Темеш', amir_temir_id, false, true) returning id into temesh_id;
  insert into public.persons (full_name, father_id, is_alive, is_verified) values
    ('Қалқаман', amir_temir_id, false, true);

  insert into public.persons (full_name, father_id, is_alive, is_verified) values
    ('Төбет', temesh_id, false, true),
    ('Қайнар', temesh_id, false, true),
    ('Қангелді', temesh_id, false, true),
    ('Қошқар', temesh_id, false, true),
    ('Жұман', temesh_id, false, true);

  -- Место Манама в цепочке — по семейным записям (в открытых источниках не найдено),
  -- поэтому узел помечен как неверифицированный. Поправьте father_id при уточнении.
  insert into public.persons (full_name, father_id, is_alive, is_verified, bio) values
    ('Манам', temesh_id, false, false,
     'Положение Манама в шежіре внесено по семейным записям и ожидает подтверждения.');
end $$;

insert into public.site_content (key, ru, kk) values (
  'home_history',
  'По шежіре племя Аргын входит в Средний жуз. Линия рода: Аргын → Мейрам → Куандық → Әмір Темір, от которого происходят роды Бөріші, Темеш и Қалқаман. Детьми Темеша в источниках называются Төбет, Қайнар, Қангелді, Қошқар и Жұман. Из известных представителей подрода Темеш — Рахимжан Кошкарбаев, Народный герой Казахстана. Место Манама в этой цепочке уточняется по семейным записям.',
  'Шежіре бойынша Арғын тайпасы Орта жүзге кіреді. Ру тізбегі: Арғын → Мейрам → Қуандық → Әмір Темір, одан Бөріші, Темеш және Қалқаман рулары тарайды. Деректерде Темештің балалары ретінде Төбет, Қайнар, Қангелді, Қошқар және Жұман аталады. Темеш руының белгілі өкілдерінің бірі — Қазақстанның Халық қаһарманы Рақымжан Қошқарбаев. Манамның осы тізбектегі орны отбасылық жазбалар бойынша нақтылануда.'
) on conflict (key) do nothing;
