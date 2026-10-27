import type { PhanDangKy } from '../common/dang-ky-phan.js';
import {
  PublicCertificatesController,
  RecognitionController,
  StudentRecognitionController,
} from '../learning/recognition/recognition.controller.js';
import { RecognitionService } from '../learning/recognition/recognition.js';

// Huy hiệu, chứng nhận hoàn thành (DT-28 phần 28i)
export default {
  controllers: [RecognitionController, StudentRecognitionController, PublicCertificatesController],
  providers: [RecognitionService],
} satisfies PhanDangKy;
