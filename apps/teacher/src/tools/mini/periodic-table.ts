// Bảng tuần hoàn của Hộp công cụ giảng dạy (DT-29 phần 29d, YCTD-328): 118 nguyên tố với số hiệu, kí hiệu, tên theo IUPAC (cách gọi
// của sách Khoa học tự nhiên, Hoá học theo chương trình 2018), khối lượng nguyên tử chuẩn rút gọn của IUPAC (số trong ngoặc vuông là
// số khối của đồng vị bền nhất với nguyên tố không có khối lượng chuẩn), nhóm, chu kì, loại. Dữ kiện khoa học công khai, không có
// bản quyền. La và Ac xếp ở nhóm 3; Ce đến Lu, Th đến Lr ở hai hàng riêng bên dưới (nhóm null)
export type ElementCategory =
  | 'alkali'
  | 'alkaline-earth'
  | 'transition'
  | 'post-transition'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide';

export const ELEMENT_CATEGORY_LABELS: Record<ElementCategory, string> = {
  alkali: 'Kim loại kiềm',
  'alkaline-earth': 'Kim loại kiềm thổ',
  transition: 'Kim loại chuyển tiếp',
  'post-transition': 'Kim loại khác',
  metalloid: 'Á kim',
  nonmetal: 'Phi kim',
  halogen: 'Halogen',
  'noble-gas': 'Khí hiếm',
  lanthanide: 'Họ lanthan',
  actinide: 'Họ actini',
};

export interface ChemicalElement {
  number: number;
  symbol: string;
  name: string;
  mass: string;
  group: number | null;
  period: number;
  category: ElementCategory;
}

// Số hiệu: kí hiệu, tên, khối lượng
const RAW = `H hydrogen 1,008|He helium 4,0026|Li lithium 6,94|Be beryllium 9,0122|B boron 10,81|C carbon 12,011|N nitrogen 14,007|O oxygen 15,999|F fluorine 18,998|Ne neon 20,180|Na sodium 22,990|Mg magnesium 24,305|Al aluminium 26,982|Si silicon 28,085|P phosphorus 30,974|S sulfur 32,06|Cl chlorine 35,45|Ar argon 39,95|K potassium 39,098|Ca calcium 40,078|Sc scandium 44,956|Ti titanium 47,867|V vanadium 50,942|Cr chromium 51,996|Mn manganese 54,938|Fe iron 55,845|Co cobalt 58,933|Ni nickel 58,693|Cu copper 63,546|Zn zinc 65,38|Ga gallium 69,723|Ge germanium 72,630|As arsenic 74,922|Se selenium 78,971|Br bromine 79,904|Kr krypton 83,798|Rb rubidium 85,468|Sr strontium 87,62|Y yttrium 88,906|Zr zirconium 91,224|Nb niobium 92,906|Mo molybdenum 95,95|Tc technetium [98]|Ru ruthenium 101,07|Rh rhodium 102,91|Pd palladium 106,42|Ag silver 107,87|Cd cadmium 112,41|In indium 114,82|Sn tin 118,71|Sb antimony 121,76|Te tellurium 127,60|I iodine 126,90|Xe xenon 131,29|Cs caesium 132,91|Ba barium 137,33|La lanthanum 138,91|Ce cerium 140,12|Pr praseodymium 140,91|Nd neodymium 144,24|Pm promethium [145]|Sm samarium 150,36|Eu europium 151,96|Gd gadolinium 157,25|Tb terbium 158,93|Dy dysprosium 162,50|Ho holmium 164,93|Er erbium 167,26|Tm thulium 168,93|Yb ytterbium 173,05|Lu lutetium 174,97|Hf hafnium 178,49|Ta tantalum 180,95|W tungsten 183,84|Re rhenium 186,21|Os osmium 190,23|Ir iridium 192,22|Pt platinum 195,08|Au gold 196,97|Hg mercury 200,59|Tl thallium 204,38|Pb lead 207,2|Bi bismuth 208,98|Po polonium [209]|At astatine [210]|Rn radon [222]|Fr francium [223]|Ra radium [226]|Ac actinium [227]|Th thorium 232,04|Pa protactinium 231,04|U uranium 238,03|Np neptunium [237]|Pu plutonium [244]|Am americium [243]|Cm curium [247]|Bk berkelium [247]|Cf californium [251]|Es einsteinium [252]|Fm fermium [257]|Md mendelevium [258]|No nobelium [259]|Lr lawrencium [262]|Rf rutherfordium [267]|Db dubnium [268]|Sg seaborgium [269]|Bh bohrium [270]|Hs hassium [269]|Mt meitnerium [278]|Ds darmstadtium [281]|Rg roentgenium [282]|Cn copernicium [285]|Nh nihonium [286]|Fl flerovium [289]|Mc moscovium [290]|Lv livermorium [293]|Ts tennessine [294]|Og oganesson [294]`;

const NONMETALS = new Set([1, 6, 7, 8, 15, 16, 34]);
const HALOGENS = new Set([9, 17, 35, 53, 85, 117]);
const NOBLE = new Set([2, 10, 18, 36, 54, 86, 118]);
const ALKALI = new Set([3, 11, 19, 37, 55, 87]);
const ALKALINE = new Set([4, 12, 20, 38, 56, 88]);
const METALLOIDS = new Set([5, 14, 32, 33, 51, 52]);
const POST_TRANSITION = new Set([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116]);

// Chu kì và nhóm theo số hiệu (bảng 18 cột)
function place(number: number): { period: number; group: number | null } {
  if (number <= 2) {
    return { period: 1, group: number === 1 ? 1 : 18 };
  }
  const starts = [3, 11, 19, 37, 55, 87, 119];
  const period = 2 + starts.findIndex((start, index) => number >= start && number < (starts[index + 1] ?? 999));
  const offset = number - (starts[period - 2] ?? 0);
  if (period <= 3) {
    return { period, group: offset < 2 ? offset + 1 : offset + 11 };
  }
  if (period <= 5) {
    return { period, group: offset + 1 };
  }
  // Chu kì 6, 7: hai nhóm đầu, nhóm 3 là La/Ac, 14 nguyên tố họ f không có nhóm, rồi nhóm 4 đến 18
  if (offset < 3) {
    return { period, group: offset + 1 };
  }
  if (offset < 17) {
    return { period, group: null };
  }
  return { period, group: offset - 13 };
}

function categoryOf(number: number, group: number | null, period: number): ElementCategory {
  if (group === null) {
    return period === 6 ? 'lanthanide' : 'actinide';
  }
  if (NOBLE.has(number)) return 'noble-gas';
  if (HALOGENS.has(number)) return 'halogen';
  if (NONMETALS.has(number)) return 'nonmetal';
  if (ALKALI.has(number)) return 'alkali';
  if (ALKALINE.has(number)) return 'alkaline-earth';
  if (METALLOIDS.has(number)) return 'metalloid';
  if (POST_TRANSITION.has(number)) return 'post-transition';
  if (number === 57) return 'lanthanide';
  if (number === 89) return 'actinide';
  return 'transition';
}

export const ELEMENTS: readonly ChemicalElement[] = RAW.split('|').map((entry, index) => {
  const [symbol = '', name = '', mass = ''] = entry.split(' ');
  const number = index + 1;
  const { period, group } = place(number);
  return { number, symbol, name, mass, group, period, category: categoryOf(number, group, period) };
});

export function findElements(query: string): ChemicalElement[] {
  const text = query.trim().toLocaleLowerCase('vi');
  if (!text) {
    return [...ELEMENTS];
  }
  return ELEMENTS.filter(
    (element) =>
      element.symbol.toLocaleLowerCase('vi') === text ||
      element.name.startsWith(text) ||
      String(element.number) === text,
  );
}
