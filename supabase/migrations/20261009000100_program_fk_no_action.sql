-- RESTRICT is checked immediately, so it also blocked deleting a whole shop (programs and customers cascade
-- together). NO ACTION is checked at the end of the statement: deleting a single program that customers
-- still hold is refused, while deleting a shop or owner account cascades cleanly.
alter table public.customers drop constraint customers_program_id_fkey;
alter table public.customers add constraint customers_program_id_fkey
  foreign key (program_id) references public.programs (id) on delete no action;
