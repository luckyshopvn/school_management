import { Injectable } from '@nestjs/common';
import {
  completeCatalogSchool,
  readCatalogSchool,
  requestCatalogSchool,
  type Actor,
  type CatalogSchoolState,
  type LifecycleEnvironment,
} from '@school-management/database';
import { mapped, PlatformSchoolsService } from './platform-schools.js';

export interface CatalogOpenReply {
  state: CatalogSchoolState;
  school_code: string | null;
}

// Khởi tạo trường ở lần mở đầu tiên (YCTD-314; hàm thư viện ở database/src/catalog-provisioning.ts): quản trị nền tảng mở đơn vị ở
// cổng vận hành, hoặc người dùng chọn đơn vị ở trang đăng nhập. Bên nhận được việc chạy khởi tạo ở nền trong tiến trình này (vài
// giây đến vài chục giây); giao diện hỏi lại trạng thái tới khi trường sẵn sàng. Xong thì bộ phân giải trường đọc lại danh sách
@Injectable()
export class CatalogProvisioningService {
  private readonly running = new Map<string, Promise<void>>();

  constructor(private readonly schools: PlatformSchoolsService) {}

  async open(moetCode: string, actor: Actor, options: { wait?: boolean } = {}): Promise<CatalogOpenReply> {
    const environment = this.schools.environment();
    const requested = await mapped(() => requestCatalogSchool(environment, moetCode, actor));
    if (requested.claimed && requested.jobId) {
      this.run(environment, requested.jobId);
    }
    if (options.wait && requested.jobId) {
      await this.running.get(requested.jobId);
    }
    const current = options.wait ? await readCatalogSchool(environment.platform, moetCode) : requested;
    return { state: current.state, school_code: current.code };
  }

  private run(environment: LifecycleEnvironment, jobId: string): void {
    const work = completeCatalogSchool(environment, jobId)
      .then(() => this.schools.refresh())
      // Lỗi đã ghi ở việc khởi tạo (trạng thái failed, nội dung lỗi); lần mở sau nhận lại việc
      .catch(() => undefined)
      .finally(() => this.running.delete(jobId));
    this.running.set(jobId, work);
  }

  // Chờ mọi việc khởi tạo đang chạy ở tiến trình này (dùng khi tắt dịch vụ và trong kiểm thử)
  async settle(): Promise<void> {
    await Promise.all([...this.running.values()]);
  }
}
