import {
  administrativeNameKey,
  type AdministrativeLevel,
  type AdministrativePeriod,
} from '@school-management/database';

// Đối chiếu địa chỉ của học sinh với danh mục địa danh hành chính (DT-15 phần 15h1, mục 4.1.11 của Sở). Năm loại địa chỉ
// lấy từ tệp CSDL ngành (YCTD-100), lưu ở `children.moet_profile` theo khóa `<loại>_province`, `<loại>_district` (quận/
// huyện cũ), `<loại>_ward`. Địa chỉ còn theo địa danh cũ khi còn ghi quận/huyện, khi tỉnh chỉ có ở danh mục cũ, hoặc khi
// xã không có trong danh sách xã mới của tỉnh. Địa danh mới đề xuất lấy theo bảng đối chiếu xã cũ sang xã mới
export const ADDRESS_TYPES = ['permanent', 'hometown', 'birth_registration', 'birthplace', 'current'] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = {
  permanent: 'Thường trú',
  hometown: 'Quê quán',
  birth_registration: 'Nơi khai sinh',
  birthplace: 'Nơi sinh',
  current: 'Chỗ ở hiện nay',
};

// Tình trạng đề xuất: một xã mới, nhiều xã mới (xã cũ chia cho nhiều xã), chưa có trong bảng đối chiếu
export const SUGGESTION_STATUSES = ['suggested', 'multiple', 'none'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export interface CatalogUnit {
  id: string;
  period: AdministrativePeriod;
  level: AdministrativeLevel;
  code: string | null;
  name: string;
  name_key: string;
  parent_id: string | null;
}

export interface AddressValue {
  province: string;
  district: string;
  ward: string;
}

export interface NewUnitChoice {
  id: string;
  code: string | null;
  ward_name: string;
  province_name: string;
}

export type AddressClassification =
  { status: 'new' | 'unknown' } | { status: 'old'; old_ward_code: string | null; candidates: NewUnitChoice[] };

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function readAddress(profile: Record<string, unknown>, type: AddressType): AddressValue {
  return {
    province: text(profile[`${type}_province`]),
    district: text(profile[`${type}_district`]),
    ward: text(profile[`${type}_ward`]),
  };
}

export function suggestionStatus(candidates: NewUnitChoice[]): SuggestionStatus {
  return candidates.length === 0 ? 'none' : candidates.length === 1 ? 'suggested' : 'multiple';
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const list = result.get(key(item));
    if (list) {
      list.push(item);
    } else {
      result.set(key(item), [item]);
    }
  }
  return result;
}

export class AddressCatalog {
  private readonly byId: Map<string, CatalogUnit>;
  private readonly children: Map<string, CatalogUnit[]>;
  private readonly provinces: Record<AdministrativePeriod, Map<string, CatalogUnit>>;
  private readonly mappings: Map<string, string[]>;

  constructor(units: CatalogUnit[], mappings: Array<{ old_unit_id: string; new_unit_id: string }>) {
    this.byId = new Map(units.map((unit) => [unit.id, unit]));
    this.children = groupBy(
      units.filter((unit) => unit.parent_id !== null),
      (unit) => unit.parent_id ?? '',
    );
    const provinces = (period: AdministrativePeriod) =>
      new Map(
        units
          .filter((unit) => unit.level === 'province' && unit.period === period)
          .map((unit) => [unit.name_key, unit]),
      );
    this.provinces = { old: provinces('old'), new: provinces('new') };
    this.mappings = new Map(
      [...groupBy(mappings, (mapping) => mapping.old_unit_id)].map(([oldId, rows]) => [
        oldId,
        rows.map((row) => row.new_unit_id),
      ]),
    );
  }

  private child(parentId: string, level: AdministrativeLevel, key: string): CatalogUnit[] {
    return (this.children.get(parentId) ?? []).filter((unit) => unit.level === level && unit.name_key === key);
  }

  private choice(unit: CatalogUnit): NewUnitChoice {
    return {
      id: unit.id,
      code: unit.code,
      ward_name: unit.name,
      province_name: this.byId.get(unit.parent_id ?? '')?.name ?? '',
    };
  }

  // Đơn vị mới theo mã, dùng khi người dùng chọn một trong nhiều xã mới
  newWard(id: string): NewUnitChoice | undefined {
    const unit = this.byId.get(id);
    return unit && unit.period === 'new' && unit.level === 'ward' ? this.choice(unit) : undefined;
  }

  classify(address: AddressValue): AddressClassification {
    if (!address.province && !address.district && !address.ward) {
      return { status: 'unknown' };
    }
    const provinceKey = administrativeNameKey(address.province);
    const wardKey = administrativeNameKey(address.ward);
    const newProvince = address.province ? this.provinces.new.get(provinceKey) : undefined;
    const oldProvince = address.province ? this.provinces.old.get(provinceKey) : undefined;
    const newWard = newProvince && address.ward ? this.child(newProvince.id, 'ward', wardKey)[0] : undefined;
    if (!address.district) {
      if (newProvince && (newWard || !address.ward)) {
        return { status: 'new' };
      }
      if (!oldProvince) {
        // Tỉnh không có trong danh mục: không biết là cũ hay mới
        return { status: 'unknown' };
      }
    }
    let oldWard: CatalogUnit | undefined;
    const districts =
      oldProvince && address.district
        ? this.child(oldProvince.id, 'district', administrativeNameKey(address.district))
        : [];
    if (oldProvince && address.ward) {
      if (address.district) {
        oldWard = districts.flatMap((district) => this.child(district.id, 'ward', wardKey))[0];
      } else {
        // Thiếu quận/huyện: chỉ nhận khi tên xã không trùng giữa các quận/huyện của tỉnh
        const matches = (this.children.get(oldProvince.id) ?? []).flatMap((district) =>
          this.child(district.id, 'ward', wardKey),
        );
        oldWard = matches.length === 1 ? matches[0] : undefined;
      }
    }
    // Huyện cũ không có cấp xã (huyện Côn Đảo) đối chiếu theo huyện
    const mapped = oldWard ?? (address.ward ? undefined : districts.find((district) => this.mappings.has(district.id)));
    let candidates: NewUnitChoice[] = [];
    if (mapped) {
      candidates = (this.mappings.get(mapped.id) ?? [])
        .map((id) => this.byId.get(id))
        .filter((unit): unit is CatalogUnit => unit !== undefined)
        .map((unit) => this.choice(unit))
        .sort((left, right) => left.ward_name.localeCompare(right.ward_name, 'vi'));
    } else if (newWard) {
      // Xã đã theo tên mới nhưng còn ghi quận/huyện cũ: chỉ cần bỏ quận/huyện
      candidates = [this.choice(newWard)];
    }
    return { status: 'old', old_ward_code: oldWard?.code ?? null, candidates };
  }
}
