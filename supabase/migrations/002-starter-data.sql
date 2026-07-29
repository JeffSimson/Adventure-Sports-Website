-- Adventure Sports starter records
insert into organizations(name,timezone) select 'Adventure Sports & Entertainment','America/New_York' where not exists(select 1 from organizations);
insert into roles(organization_id,name,slug,description,is_system)
select o.id,v.name,v.slug,v.description,true from organizations o cross join (values
('Owner','owner','Full system access'),('Manager','manager','Operational management access'),('Grounds Crew','grounds','Fields and maintenance access'),('Kitchen','kitchen','Kitchen operations access'),('Cashier','cashier','Cashier access')) v(name,slug,description)
on conflict(organization_id,slug) do nothing;
insert into fields(organization_id,code,name,sport,surface_type,sort_order)
select o.id,v.code,v.name,'Baseball / Softball','Synthetic Turf',v.sort_order from organizations o cross join (values
('A1','Field A1',1),('A2','Field A2',2),('B1','Field B1',3),('B2','Field B2',4),('C1','Field C1',5),('C2','Field C2',6),('D1','Field D1',7),('D2','Field D2',8)) v(code,name,sort_order)
on conflict(code) do nothing;
insert into inspection_templates(name,category,description) select 'Daily Field Opening','field','Opening condition and safety inspection' where not exists(select 1 from inspection_templates where name='Daily Field Opening');
insert into inventory_categories(name,department) values ('Field Supplies','Grounds'),('Kitchen Supplies','Kitchen'),('Cleaning Supplies','Facility'),('Safety Supplies','Facility') on conflict(name) do nothing;
insert into certification_types(name,description,expires) values ('CPR / First Aid','CPR and first-aid certification',true),('Food Handler','Food handling certification',true),('Equipment Operator','Authorized equipment operator',true) on conflict(name) do nothing;
insert into app_settings(key,value,visibility) values ('schema_version','{"version":"7.4.0"}'::jsonb,'owner'),('facility_timezone','{"timezone":"America/New_York"}'::jsonb,'manager') on conflict(key) do update set value=excluded.value;
