import type { PhanDangKy } from '../common/dang-ky-phan.js';
import { MarketAccountsController, MarketAccountsService } from '../market/market-accounts.js';
import { MarketAdminController, MarketAdminService } from '../market/market-admin.js';
import { MarketContext } from '../market/market-context.js';
import { MarketChildrenController, MarketFamilyService } from '../market/market-family.js';
import { MarketMessenger } from '../market/market-messenger.js';
import { MarketTutorController, MarketTutorsService } from '../market/market-tutors.js';
import { SchoolMarketLinkController, SchoolMarketLinkService } from '../market/school-market-link.js';

// Nền chợ gia sư (DT-27 phần 27f)
export default {
  controllers: [
    MarketAccountsController,
    MarketChildrenController,
    MarketTutorController,
    MarketAdminController,
    SchoolMarketLinkController,
  ],
  providers: [
    MarketContext,
    MarketMessenger,
    MarketAccountsService,
    MarketFamilyService,
    MarketTutorsService,
    MarketAdminService,
    SchoolMarketLinkService,
  ],
} satisfies PhanDangKy;
