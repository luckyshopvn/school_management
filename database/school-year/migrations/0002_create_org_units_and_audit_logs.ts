import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Cây đơn vị hai cấp (BR-01, QĐ-23) và nhật ký thao tác (QU-04, P01-09) trong cơ sở dữ liệu năm học
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('org_units')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('unit_type', 'text', (column) => column.notNull())
      .addColumn('parent_id', 'uuid', (column) => column.references('org_units.id'))
      .addColumn('address', 'text')
      .addColumn('phone', 'text')
      .addColumn('manager_user_id', 'uuid')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addCheckConstraint('org_units_type_check', sql`unit_type in ('truong_chinh', 'phan_hieu', 'diem_truong')`)
      .addCheckConstraint('org_units_status_check', sql`status in ('active', 'inactive')`)
      .addCheckConstraint(
        'org_units_level_check',
        sql`(unit_type = 'truong_chinh' and parent_id is null) or (unit_type <> 'truong_chinh' and parent_id is not null)`,
      )
      .execute();
    // Chỉ một Trường chính
    await sql`create unique index org_units_single_root on org_units ((unit_type)) where unit_type = 'truong_chinh'`.execute(
      database,
    );
    await database.schema.createIndex('org_units_parent_id_index').on('org_units').column('parent_id').execute();
    // Đơn vị cấp 2 chỉ trực thuộc Trường chính
    await sql`
      create function org_units_check_parent() returns trigger language plpgsql as $$
      begin
        if new.parent_id is not null and not exists (
          select 1 from org_units where id = new.parent_id and unit_type = 'truong_chinh'
        ) then
          raise exception 'Đơn vị cấp 2 chỉ trực thuộc Trường chính (BR-01)';
        end if;
        return new;
      end;
      $$`.execute(database);
    await sql`create trigger org_units_check_parent before insert or update on org_units
      for each row execute function org_units_check_parent()`.execute(database);

    await database.schema
      .createTable('audit_logs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('actor_user_id', 'uuid', (column) => column.notNull())
      .addColumn('org_unit_id', 'uuid')
      .addColumn('entity_name', 'text', (column) => column.notNull())
      .addColumn('entity_id', 'uuid', (column) => column.notNull())
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('before_data', 'jsonb')
      .addColumn('after_data', 'jsonb')
      .addColumn('ip_address', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema.createIndex('audit_logs_org_unit_id_index').on('audit_logs').column('org_unit_id').execute();
    await database.schema
      .createIndex('audit_logs_entity_index')
      .on('audit_logs')
      .columns(['entity_name', 'entity_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('audit_logs').execute();
    await sql`drop trigger org_units_check_parent on org_units`.execute(database);
    await sql`drop function org_units_check_parent()`.execute(database);
    await database.schema.dropTable('org_units').execute();
  },
};
