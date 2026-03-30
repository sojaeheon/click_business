-- Flyway Migration V1: Initial schema
-- Target DB: PostgreSQL

-- ===== users / oauth =====
create table if not exists users (
  user_id bigserial primary key,
  is_guest boolean not null default false,
  created_at timestamp,
  updated_at timestamp
);

create table if not exists user_oauth (
  user_oauth_id bigserial primary key,
  user_id bigint not null,
  provider varchar(20) not null,
  provider_user_id varchar(100) not null,
  email varchar(100) not null,
  created_at timestamp,
  updated_at timestamp,
  constraint fk_user_oauth_user foreign key (user_id) references users(user_id)
);

-- ===== optional: industry tables (from DBML) =====
create table if not exists industry (
  industry_id serial primary key,
  name varchar(255) not null
);

-- ===== company =====
-- NOTE:
-- - Current JPA entity uses input_item_id/output_item_id (Long) rather than industry_id.
-- - We keep those columns to match current code, and also include industry_id for your DBML extension.
create table if not exists company (
  company_id bigserial primary key,
  user_id bigint not null unique,
  name varchar(100) not null,

  -- DBML extension
  industry_id int,

  -- Current JPA entity columns
  input_item_id bigint,
  output_item_id bigint,

  production_requirement int not null,
  production_yield int not null,
  level int not null,
  cash bigint not null,
  total_asset bigint not null,
  created_at timestamp,
  updated_at timestamp,

  constraint fk_company_user foreign key (user_id) references users(user_id),
  constraint fk_company_industry foreign key (industry_id) references industry(industry_id)
);

-- ===== item =====
create table if not exists item (
  item_id bigserial primary key,
  name varchar(50) not null,
  type varchar(20) not null,
  description text
);

-- DBML: industry_item_relation
-- NOTE: item.item_id is bigint, so item_id here is bigint as well.
create table if not exists industry_item_relation (
  id bigserial primary key,
  industry_id int not null,
  item_id bigint not null,
  trade_type varchar(20) not null,
  constraint fk_iir_industry foreign key (industry_id) references industry(industry_id),
  constraint fk_iir_item foreign key (item_id) references item(item_id)
);

-- ===== warehouse =====
create table if not exists warehouse (
  warehouse_id bigserial primary key,
  company_id bigint not null unique,
  max_slot int not null,
  constraint fk_warehouse_company foreign key (company_id) references company(company_id)
);

create table if not exists warehouse_slot (
  slot_id bigserial primary key,
  warehouse_id bigint not null,
  slot_index int not null,
  item_id bigint,
  quantity bigint not null default 0,
  constraint fk_warehouse_slot_warehouse foreign key (warehouse_id) references warehouse(warehouse_id),
  constraint fk_warehouse_slot_item foreign key (item_id) references item(item_id),
  constraint uq_warehouse_slot unique (warehouse_id, slot_index)
);

create table if not exists equipment_inventory (
  equipment_inventory_id bigserial primary key,
  company_id bigint not null,
  item_id bigint not null,
  level int not null,
  is_equipped boolean not null,
  slot_index int not null,
  max_slot int not null,
  constraint fk_equipment_inventory_company foreign key (company_id) references company(company_id),
  constraint fk_equipment_inventory_item foreign key (item_id) references item(item_id)
);

-- ===== production =====
create table if not exists workstation (
  workstation_id bigserial primary key,
  company_id bigint not null,
  equipment_inventory_id bigint,
  workstation_level int not null,
  last_tick_time timestamp,
  is_active boolean not null,
  reserved_quantity bigint not null,
  produced_quantity bigint not null,
  constraint fk_workstation_company foreign key (company_id) references company(company_id),
  constraint fk_workstation_equipment foreign key (equipment_inventory_id) references equipment_inventory(equipment_inventory_id)
);

-- ===== market =====
-- NOTE:
-- - Current JPA entity stores item_id as Integer and company_id as Long without JPA FKs.
-- - We do not add FKs here to avoid mismatches (and because item_id type differs).
create table if not exists market_order (
  market_order_id bigserial primary key,
  item_id int not null,
  company_id bigint not null,
  order_type varchar(50) not null,
  price bigint not null,
  total_quantity bigint not null,
  remaining_quantity bigint not null,
  status varchar(50) not null,
  is_virtual boolean not null,
  created_at timestamp,
  updated_at timestamp
);

create table if not exists trade_history (
  trade_history_id bigserial primary key,
  market_order_id bigint not null,
  order_type varchar(50) not null,
  price bigint not null,
  execution_quantity bigint not null,
  is_collected boolean not null,
  created_at timestamp,
  constraint fk_trade_history_market_order foreign key (market_order_id) references market_order(market_order_id)
);

