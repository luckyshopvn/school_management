// Tạm thời trống; tệp sinh từ văn bản chính thức (xem 0008_create_administrative_units)
export interface AdministrativeSeed {
  provinces: Array<[period: 'old' | 'new', code: string | null, name: string]>;
  districts: Array<[province: number, code: string | null, name: string]>;
  oldWards: Array<[district: number, code: string | null, name: string]>;
  newWards: Array<[province: number, code: string | null, name: string, from: number[]]>;
}

export const HCM_ADMINISTRATIVE_UNITS: AdministrativeSeed = { provinces: [], districts: [], oldWards: [], newWards: [] };
