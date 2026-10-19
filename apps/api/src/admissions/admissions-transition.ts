import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { AcademicYearTransitionStep } from '../academic-years/academic-year-transition.js';
import { APPLICATION_CODE_PREFIX, APPLICATION_DOCUMENT_TYPE } from './admission-applications.js';

// Mở năm học mới (YCTD-86): chuyển đợt tuyển sinh còn nháp hoặc đang mở cùng tin tuyển sinh của đợt và hồ sơ chưa xong
// (đã nộp, đã tiếp nhận, đạt) để phụ huynh tra cứu tiếp bằng mã cũ và nhà trường xét, chuyển thành hồ sơ trẻ ở năm mới;
// lớp dự kiến bỏ trống vì lớp thuộc năm cũ; giấy tờ đính kèm của hồ sơ (DT-17 phần 17d) chuyển theo hồ sơ. Đợt đã đóng, hồ
// sơ không đạt hoặc đã chuyển tra ở năm cũ. Số hồ sơ năm mới đánh tiếp sau mã lớn nhất đã chuyển để không trùng. Chạy sau
// bước chuyển danh mục và cây đơn vị
export const admissionsTransitionStep: AcademicYearTransitionStep = {
  name: 'admissions',
  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;
    const units = new Set((await next.selectFrom('org_units').select('id').execute()).map((row) => row.id));
    const campaigns = (
      await previous.selectFrom('admission_campaigns').selectAll().where('status', 'in', ['draft', 'open']).execute()
    ).filter((campaign) => units.has(campaign.org_unit_id));
    if (campaigns.length === 0) {
      return;
    }
    const campaignIds = campaigns.map((campaign) => campaign.id);
    for (const campaign of campaigns) {
      await next.insertInto('admission_campaigns').values(campaign).execute();
    }
    for (const post of await previous
      .selectFrom('admission_posts')
      .selectAll()
      .where('campaign_id', 'in', campaignIds)
      .where('status', '!=', 'hidden')
      .execute()) {
      await next.insertInto('admission_posts').values(post).execute();
    }
    const relationships = new Set(
      (
        await next.selectFrom('catalog_items').select('id').where('catalog_type', '=', 'parent_relationship').execute()
      ).map((row) => row.id),
    );
    let highest = 0;
    const carried: string[] = [];
    for (const application of await previous
      .selectFrom('admission_applications')
      .selectAll()
      .where('campaign_id', 'in', campaignIds)
      .where('status', 'in', ['submitted', 'received', 'passed'])
      .execute()) {
      await next
        .insertInto('admission_applications')
        .values({
          ...application,
          planned_class_id: null,
          guardian_relationship_item_id:
            application.guardian_relationship_item_id && relationships.has(application.guardian_relationship_item_id)
              ? application.guardian_relationship_item_id
              : null,
          target_org_unit_id:
            application.target_org_unit_id && units.has(application.target_org_unit_id)
              ? application.target_org_unit_id
              : null,
        })
        .execute();
      carried.push(application.id);
      highest = Math.max(highest, Number(application.code.slice(APPLICATION_CODE_PREFIX.length + 1)) || 0);
    }
    // Giấy tờ của hồ sơ tiếp nhận ở Tuyển sinh đầu cấp (DT-17 phần 17d) đi theo hồ sơ để chuyển sang hồ sơ học sinh ở năm mới;
    // chỉ chép dòng thông tin tệp, nội dung tệp nằm ở kho tệp dùng chung
    if (carried.length > 0) {
      const links = await previous
        .selectFrom('admission_application_files')
        .selectAll()
        .where('application_id', 'in', carried)
        .execute();
      if (links.length > 0) {
        for (const file of await previous
          .selectFrom('files')
          .selectAll()
          .where(
            'id',
            'in',
            links.map((link) => link.file_id),
          )
          .execute()) {
          await next
            .insertInto('files')
            .values({
              ...file,
              org_unit_id:
                file.org_unit_id && units.has(file.org_unit_id) ? file.org_unit_id : campaigns[0]!.org_unit_id,
            })
            .execute();
        }
        await next.insertInto('admission_application_files').values(links).execute();
      }
    }
    if (highest > 0) {
      await next
        .insertInto('document_sequences')
        .values({ document_type: APPLICATION_DOCUMENT_TYPE, last_value: highest })
        .onConflict((conflict) => conflict.column('document_type').doUpdateSet({ last_value: highest }))
        .execute();
    }
  },
};
