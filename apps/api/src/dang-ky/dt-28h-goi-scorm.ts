import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { CoursePackagesController } from '../learning/content-packages/course-packages.controller.js';
import { CoursePackagesService } from '../learning/content-packages/course-packages.js';
import {
  ScormActivitiesController,
  ScormContentController,
  ScormResourcesController,
  StudentScormController,
} from '../learning/content-packages/scorm.controller.js';
import { ScormPackagesService } from '../learning/content-packages/scorm.js';

// Gói SCORM, gói khoá học (DT-28 phần 28h)
export default {
  controllers: [
    ScormResourcesController,
    ScormActivitiesController,
    StudentScormController,
    ScormContentController,
    CoursePackagesController,
  ],
  providers: [ScormPackagesService, CoursePackagesService],
} satisfies PhanDangKy;
