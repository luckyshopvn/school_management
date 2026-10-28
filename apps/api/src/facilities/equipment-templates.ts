// Danh mục thiết bị tối thiểu mẫu theo cấp học (DT-18 phần 18g, YCTD-143). Danh mục của trường là các dòng của bảng
// equipment_items (cấu hình, Hiệu trưởng sửa trên màn hình); mẫu ở đây chỉ dùng khi bấm "Nạp danh mục mẫu": thêm dòng có
// mã chưa có, không sửa dòng đã có. Mỗi mẫu ghi văn bản gốc; cấp khác thêm mẫu mới ở đây, không đổi mã.
//
// Tiểu học, THCS, THPT (YCTD-345): tài liệu dự án chỉ nêu số văn bản (Thông tư 37, 38, 39/2021/TT-BGDĐT, tài liệu 32 mục
// 18g), không có nội dung danh mục, nên chưa có mẫu ở đây; trường tự nhập danh mục (EQUIPMENT_CATALOG_SOURCES của gói dùng
// chung). Chỉ thêm mẫu khi danh mục được đưa vào tài liệu của dự án, không chép lại từ trí nhớ.
//
// Mẫu Mầm non: Danh mục đồ dùng, đồ chơi, thiết bị dạy học tối thiểu dùng cho giáo dục mầm non ban hành kèm Thông tư
// 02/2010/TT-BGDĐT, đã bỏ 47 thiết bị bị bãi bỏ và đổi tên hai thiết bị (MN122047, MN232079) theo Thông tư
// 34/2013/TT-BGDĐT. Mã số, tên, đơn vị tính, số lượng, đối tượng sử dụng chép từ văn bản (bản đăng trên trang văn bản pháp
// luật, đọc ngày 2026-10-20); số lượng là của một nhóm, lớp (nhà trẻ 3–12 tháng 15 trẻ, 12–24 tháng 20 trẻ, 24–36 tháng 25
// trẻ; mẫu giáo 3–4 tuổi 25 trẻ, 4–5 tuổi 30 trẻ, 5–6 tuổi 35 trẻ). Văn bản không ghi lĩnh vực phát triển nên để trống. Cần
// đối chiếu bản gốc trên Công báo trước khi dùng chính thức (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11).
import type { EquipmentSchoolLevel } from '@school-management/shared';

export interface EquipmentTemplateItem {
  code: string;
  name: string;
  unit: string;
  equipment_group: 'do_dung' | 'thiet_bi_do_choi' | 'sach_tai_lieu';
  age_group: string;
  quantity: number;
  target_users: 'tre' | 'giao_vien' | 'tre_giao_vien';
  note: string | null;
}

export interface EquipmentTemplate {
  code: string;
  school_level: EquipmentSchoolLevel;
  title: string;
  source: string;
  items: EquipmentTemplateItem[];
}

// Hai chữ số sau "MN" là nhóm tuổi, chữ số tiếp theo là nhóm thiết bị (1 đồ dùng, 2 thiết bị dạy học, đồ chơi và học liệu,
// 3 sách, tài liệu, băng đĩa)
const AGE_GROUP_OF_CODE: Record<string, string> = {
  '01': 'nt_3_12',
  '12': 'nt_12_24',
  '23': 'nt_24_36',
  '34': 'mg_3_4',
  '45': 'mg_4_5',
  '56': 'mg_5_6',
};
const GROUP_OF_DIGIT = { '1': 'do_dung', '2': 'thiet_bi_do_choi', '3': 'sach_tai_lieu' } as const;
const TARGET_OF_LETTER = { t: 'tre', g: 'giao_vien', c: 'tre_giao_vien' } as const;

// Mỗi dòng: mã số | tên | đơn vị tính | số lượng | đối tượng (t trẻ, g giáo viên, c dùng chung) | ghi chú
const MN_TT02_2010 = `
MN011001|Giá phơi khăn mặt|cái|1|t
MN011002|Tủ (giá) ca, cốc|cái|1|t
MN011003|Tủ đựng đồ dùng cá nhân của trẻ|cái|2|t
MN011004|Tủ đựng chăn, chiếu, màn|cái|2|t
MN011005|Giường chơi|cái|2|t
MN011006|Phản|cái|4|t
MN011007|Bình ủ nước|cái|1|t
MN011008|Bàn cho trẻ|cái|2|t
MN011009|Ghế cho trẻ|cái|10|t
MN011010|Ghế giáo viên|cái|3|g
MN011011|Bàn quấn tã|cái|1|g
MN011012|Thùng đựng nước có vòi|cái|1|t
MN011013|Thùng đựng rác|cái|1|c
MN011014|Xô|cái|2|t
MN011015|Giá để giày dép|cái|1|t
MN011016|Cốc uống nước|cái|15|t
MN011017|Bô có ghế tựa và nắp đậy|cái|5|t
MN011018|Chậu|cái|2|t
MN011019|Ti vi màu|cái|1|c
MN011020|Đầu đĩa DVD|cái|1|c
MN011021|Giá để đồ chơi và học liệu|cái|2|t
MN012022|Bóng nhỏ|quả|6|t
MN012023|Bóng to|quả|6|t
MN012024|Xe ngồi đẩy|cái|1|t
MN012025|Xe đẩy tập đi|cái|1|t
MN012026|Gà mổ thóc|con|6|t
MN012027|Hề tháp|con|6|t
MN012028|Bộ xếp vòng tháp|bộ|6|t
MN012029|Bộ khối hình|bộ|5|t
MN012030|Xe chuyển động vui|cái|3|t
MN012031|Lục lặc|cái|3|t
MN012032|Bộ tranh nhận biết tập nói|bộ|2|t
MN012033|Búp bê bé trai|con|3|t
MN012034|Búp bê bé gái|con|3|t
MN012035|Xe cũi thả hình|cái|2|t
MN012036|Chút chít các loại|con|6|t
MN012037|Thú nhồi|con|6|t
MN012038|Xúc xắc các loại|cái|6|t
MN012039|Xắc xô to|cái|1|g
MN012040|Trống con|cái|3|t
MN012041|Chuỗi dây xúc xắc|chuỗi|4|t
MN012042|Bộ tranh nhận biết - Tập nói|bộ|1|t
MN013049|Băng/đĩa các bài hát, nhạc không lời, dân ca, hát ru, thơ|bộ|1|g
MN013050|Băng/đĩa âm thanh tiếng kêu của các con vật|bộ|1|g
MN121001|Giá phơi khăn mặt|cái|1|t
MN121002|Tủ (giá) ca, cốc|cái|1|t
MN121003|Tủ đựng đồ dùng cá nhân của trẻ|cái|2|t
MN121004|Tủ đựng chăn, chiếu, màn|cái|2|t
MN121005|Phản|cái|10|t
MN121006|Bình ủ nước|cái|1|t
MN121007|Giá để giày dép|cái|1|t
MN121008|Cốc uống nước|cái|20|t
MN121009|Bô có ghế tựa và nắp đậy|cái|5|t
MN121010|Xô|cái|2|t
MN121011|Chậu|cái|2|t
MN121012|Bàn cho trẻ|cái|5|t
MN121013|Ghế cho trẻ|cái|20|t
MN121014|Ghế giáo viên|cái|3|g
MN121015|Thùng đựng nước có vòi|cái|1|t
MN121016|Thùng đựng rác|cái|1|c
MN121017|Ti vi màu|cái|1|c
MN121018|Đầu đĩa DVD|cái|1|c
MN121019|Giá để đồ chơi và học liệu|cái|2|t
MN122020|Bóng nhỏ|quả|20|t
MN122021|Bóng to|quả|6|t
MN122022|Gậy thể dục nhỏ|cái|20|t
MN122023|Vòng thể dục nhỏ|cái|20|t
MN122024|Vòng thể dục to|cái|3|g
MN122025|Búa cọc|bộ|2|t
MN122026|Bập bênh|cái|2|t
MN122027|Thú nhún|con|2|t
MN122028|Thú kéo dây|con|2|t
MN122029|Cổng chui|cái|4|t
MN122030|Xe ngồi có bánh|cái|1|t
MN122031|Lồng hộp vuông|bộ|10|t
MN122032|Lồng hộp tròn|bộ|10|t
MN122033|Bộ xâu dây|bộ|5|t
MN122034|Thả vòng|bộ|2|t
MN122035|Các con vật đẩy|con|3|t
MN122036|Bộ xếp hình trên xe|bộ|2|t|28 chi tiết
MN122037|Bộ nhận biết những con vật nuôi|bộ|2|t
MN122038|Giỏ trái cây|giỏ|2|t
MN122039|Búp bê bé trai|con|5|t
MN122040|Búp bê bé gái|con|5|t
MN122041|Hề tháp|bộ|5|t
MN122042|Khối hình to|bộ|6|t
MN122043|Khối hình nhỏ|bộ|6|t
MN122044|Xe cũi thả hình|cái|3|t
MN122045|Đồ chơi nhồi bông|con|5|t
MN122046|Xếp tháp|bộ|5|t
MN122047|Bút sáp, phấn vẽ|hộp|20|t|Tên sửa theo Thông tư 34/2013/TT-BGDĐT
MN122048|Bộ đồ chơi nấu ăn|bộ|2|t
MN122049|Bộ tranh nhận biết, tập nói|bộ tranh|3|t
MN122050|Xắc xô 2 mặt nhỏ|cái|10|t
MN122051|Xắc xô 2 mặt to|cái|2|g
MN122052|Phách gõ|đôi|10|t
MN122053|Trống cơm|cái|2|t
MN122054|Trống con|cái|5|t
MN122055|Đàn Xylophone|cái|2|t
MN122056|Đất nặn|hộp|20|t
MN122057|Bảng con|cái|20|t
MN122058|Bộ tranh truyện nhà trẻ|bộ|2|g
MN122059|Bộ tranh minh họa thơ nhà trẻ|bộ|2|g
MN122060|Bộ nhận biết, tập nói|bộ|1|t
MN123067|Băng/đĩa hát, nhạc không lời, dân ca, hát ru, thơ|bộ|1|g
MN123068|Băng/đĩa âm thanh tiếng kêu của các con vật|bộ|1|g
MN231001|Giá phơi khăn mặt|cái|1|t
MN231002|Tủ (giá) ca cốc|cái|1|t
MN231003|Tủ đựng đồ dùng cá nhân của trẻ|cái|1|t
MN231004|Tủ đựng chăn, màn, chiếu|cái|1|t
MN231005|Phản|cái|13|t
MN231006|Bình ủ nước|cái|1|t
MN231007|Giá để giày dép|cái|1|t
MN231008|Cốc uống nước|cái|25|t
MN231009|Bô có nắp đậy|cái|5|t
MN231010|Xô|cái|2|t
MN231011|Chậu|cái|2|t
MN231012|Bàn giáo viên|cái|1|g
MN231013|Ghế giáo viên|cái|2|g
MN231014|Bàn cho trẻ|cái|6|t
MN231015|Ghế cho trẻ|cái|25|t
MN231016|Thùng đựng nước có vòi|cái|1|t
MN231017|Thùng đựng rác|cái|1|c
MN231018|Ti vi màu|cái|1|c
MN231019|Đầu đĩa DVD|cái|1|c
MN231020|Đàn Organ|bộ|1|g
MN231021|Giá để đồ chơi và học liệu|cái|4|t
MN232022|Bóng nhỏ|quả|15|t
MN232023|Bóng to|quả|10|t
MN232024|Gậy thể dục nhỏ|cái|25|t
MN232025|Gậy thể dục to|cái|2|g
MN232026|Vòng thể dục nhỏ|cái|25|t
MN232027|Vòng thể dục to|cái|2|g
MN232028|Bập bênh|cái|2|t
MN232029|Cổng chui|cái|4|t
MN232030|Cột ném bóng|cái|2|t
MN232031|Đồ chơi có bánh xe và dây kéo|bộ|5|t
MN232032|Hộp thả hình|bộ|5|t
MN232033|Lồng hộp vuông|bộ|5|t
MN232034|Lồng hộp tròn|bộ|5|t
MN232035|Bộ xâu hạt|bộ|10|t
MN232036|Bộ xâu dây|bộ|5|t
MN232037|Bộ búa cọc|bộ|5|t
MN232038|Búa 3 bi 2 tầng|bộ|2|t
MN232039|Các con kéo dây có khớp|con|3|t
MN232040|Bộ tháo lắp vòng|bộ|5|t
MN232041|Bộ xây dựng trên xe|bộ|2|t|35 chi tiết
MN232042|Hàng rào nhựa|bộ|3|t
MN232043|Bộ rau, củ, quả|bộ|3|t
MN232044|Đồ chơi các con vật nuôi trong gia đình|bộ|2|t
MN232045|Đồ chơi các con vật sống dưới nước|bộ|2|t
MN232046|Đồ chơi các con vật sống trong rừng|bộ|2|t
MN232047|Đồ chơi các loại rau, củ, quả|bộ|2|t
MN232048|Tranh ghép các con vật|bộ|1|t
MN232049|Tranh ghép các loại quả|bộ|1|t
MN232050|Đồ chơi nhồi bông|bộ|1|t
MN232051|Đồ chơi với cát|bộ|2|t
MN232052|Bảng quay 2 mặt|bộ|1|c
MN232053|Tranh động vật nuôi trong gia đình|bộ|1|c
MN232054|Tranh về các loại rau, củ, quả, hoa|bộ|1|c
MN232055|Tranh các phương tiện giao thông|bộ|1|c
MN232056|Tranh cảnh báo nguy hiểm|bộ|1|c
MN232057|Bộ tranh truyện nhà trẻ|bộ|2|g
MN232058|Bộ tranh minh họa thơ nhà trẻ|bộ|2|g
MN232059|Lô tô các loại quả|bộ|25|t
MN232060|Lô tô các con vật|bộ|25|t
MN232061|Lô tô các phương tiện giao thông|bộ|25|t
MN232062|Lô tô các hoa|bộ|25|t
MN232063|Con rối|bộ|1|g
MN232064|Khối hình to|bộ|8|t
MN232065|Khối hình nhỏ|bộ|8|t
MN232066|Búp bê bé trai (cao - thấp)|con|4|t
MN232067|Búp bê bé gái (cao - thấp)|con|4|t
MN232068|Bộ đồ chơi nấu ăn|bộ|3|t
MN232069|Bộ bàn ghế giường tủ|bộ|2|t
MN232070|Bộ dụng cụ bác sĩ|bộ|2|t
MN232071|Giường búp bê|bộ|2|t
MN232072|Xắc xô to|cái|1|g
MN232073|Xắc xô nhỏ|cái|10|t
MN232074|Phách gõ|đôi|10|t
MN232075|Trống cơm|cái|5|t
MN232076|Xúc xắc|cái|6|t
MN232077|Trống con|cái|10|t
MN232078|Đất nặn|hộp|25|t
MN232079|Bút sáp, phấn vẽ|hộp|25|t|Tên sửa theo Thông tư 34/2013/TT-BGDĐT
MN232080|Bảng con|cái|15|t
MN232081|Bộ nhận biết, tập nói|bộ|1|t
MN233089|Băng/đĩa các bài hát, nhạc không lời, dân ca, hát ru, thơ|bộ|1|g
MN233090|Băng/đĩa âm thanh tiếng kêu của các con vật|bộ|1|g
MN341001|Giá phơi khăn|cái|1|t
MN341002|Tủ (giá) đựng ca cốc|cái|1|t
MN341003|Tủ để đồ dùng cá nhân của trẻ|cái|2|t
MN341004|Tủ đựng chăn, màn, chiếu|cái|1|t
MN341005|Phản|cái|13|t
MN341006|Cốc uống nước|cái|25|t
MN341007|Bình ủ nước|cái|1|t
MN341008|Giá để giày dép|cái|2|t
MN341009|Xô|cái|2|t
MN341010|Chậu|cái|2|t
MN341011|Bàn giáo viên|cái|1|g
MN341012|Ghế giáo viên|cái|2|g
MN341013|Bàn cho trẻ|cái|13|t
MN341014|Ghế cho trẻ|cái|25|t
MN341015|Thùng đựng nước có vòi|cái|1|t
MN341016|Thùng đựng rác có nắp đậy|cái|2|c
MN341017|Đầu DVD|cái|1|c
MN341018|Ti vi|cái|1|c
MN341019|Đàn organ|cái|1|g
MN341020|Giá để đồ chơi và học liệu|cái|5|t
MN342021|Bàn chải đánh răng trẻ em|cái|5|t
MN342022|Mô hình hàm răng|cái|2|t
MN342023|Vòng thể dục to|cái|2|g
MN342024|Gậy thể dục to|cái|2|g
MN342025|Cột ném bóng|cái|2|t
MN342026|Vòng thể dục nhỏ|cái|25|t
MN342027|Gậy thể dục nhỏ|cái|25|t
MN342028|Xắc xô|cái|2|g
MN342029|Trống da|cái|1|g
MN342030|Cổng chui|cái|3|t
MN342031|Bóng nhỏ|quả|25|t
MN342032|Bóng to|quả|5|t
MN342033|Nguyên liệu để đan tết|kg|1|t
MN342034|Kéo thủ công|cái|25|t
MN342035|Kéo văn phòng|cái|1|g
MN342036|Bút chì đen|cái|25|t
MN342037|Bút sáp, phấn vẽ, bút chì màu|hộp|25|t
MN342038|Đất nặn|hộp|25|t
MN342039|Giấy màu|túi|25|t
MN342040|Bộ dinh dưỡng 1|bộ|2|t
MN342041|Bộ dinh dưỡng 2|bộ|2|t
MN342042|Bộ dinh dưỡng 3|bộ|2|t
MN342043|Bộ dinh dưỡng 4|bộ|2|t
MN342044|Hàng rào lắp ghép lớn|túi|3|t
MN342045|Ghép nút lớn|túi|2|t
MN342046|Tháp dinh dưỡng|tờ|1|t
MN342047|Búp bê bé trai|con|2|t
MN342048|Búp bê bé gái|con|2|t
MN342049|Bộ đồ chơi nấu ăn|bộ|3|t
MN342050|Bộ dụng cụ bác sỹ|bộ|2|t
MN342051|Bộ xếp hình trên xe|bộ|6|t|25 chi tiết
MN342052|Bộ xếp hình các phương tiện giao thông|bộ|3|t
MN342053|Gạch xây dựng|thùng|2|t
MN342054|Đồ chơi dụng cụ chăm sóc cây|bộ|2|t
MN342055|Đồ chơi dụng cụ sửa chữa đồ dùng gia đình|bộ|2|t
MN342056|Đồ chơi các phương tiện giao thông|bộ|2|t
MN342057|Bộ động vật biển|bộ|2|t
MN342058|Bộ động vật sống trong rừng|bộ|2|t
MN342059|Bộ động vật nuôi trong gia đình|bộ|2|t
MN342060|Bộ côn trùng|bộ|2|t
MN342061|Nam châm thẳng|cái|3|t
MN342062|Kính lúp|cái|3|t
MN342063|Phễu nhựa|cái|3|t
MN342064|Bể chơi với cát và nước|bộ|1|t
MN342065|Bộ làm quen với toán|bộ|15|t|Mẫu giáo 3–4 tuổi
MN342066|Con rối|bộ|1|t
MN342067|Bộ hình học phẳng|túi|25|t
MN342068|Bảng quay 2 mặt|cái|1|c
MN342069|Tranh các loại hoa, quả, củ|bộ|2|c
MN342070|Tranh các con vật|bộ|2|c
MN342071|Tranh ảnh một số nghề nghiệp|bộ|2|c
MN342072|Đồng hồ học đếm 2 mặt|cái|2|t
MN342073|Hộp thả hình|cái|3|t
MN342074|Bàn tính học đếm|cái|3|t
MN342075|Bộ tranh truyện mẫu giáo 3-4 tuổi|bộ|1|g
MN342076|Bộ tranh minh họa thơ lớp 3-4 tuổi|bộ|1|g
MN342077|Bảng con|cái|25|t
MN342078|Tranh cảnh báo nguy hiểm|bộ|1|g
MN342079|Tranh, ảnh về Bác Hồ|bộ|1|c
MN342080|Màu nước|hộp|25|t
MN342081|Bút lông cỡ to|cái|12|t
MN342082|Bút lông cỡ nhỏ|cái|12|t
MN342083|Dập ghim|cái|1|g
MN342084|Bìa các màu|tờ|50|g
MN342085|Giấy trắng A0|tờ|50|c
MN342086|Kẹp sắt các cỡ|cái|10|c
MN342087|Dập lỗ|cái|1|g
MN342088|Súng bắn keo|cái|1|g
MN342089|Dụng cụ gõ đệm theo phách nhịp|bộ|3|t
MN342090|Lịch của trẻ|bộ|1|t
MN343100|Băng/đĩa các bài hát, nhạc không lời, dân ca, hát ru|bộ|1|g
MN343101|Băng/đĩa thơ ca, truyện kể|bộ|1|g
MN343102|Băng/đĩa hình "Vẽ tranh theo truyện kể"|bộ|1|g
MN343103|Băng/đĩa hình "Kể chuyện theo tranh"|bộ|1|g
MN343104|Băng/đĩa hình về Bác Hồ|bộ|1|g
MN451001|Giá phơi khăn|cái|1|t
MN451002|Cốc uống nước|cái|30|t
MN451003|Tủ (giá) đựng ca cốc|cái|1|t
MN451004|Bình ủ nước|cái|1|t
MN451005|Tủ để đồ dùng cá nhân của trẻ|cái|2|t
MN451006|Tủ đựng chăn, màn, chiếu|cái|1|t
MN451007|Phản|cái|15|t
MN451008|Giá để giày dép|cái|1|t
MN451009|Xô|cái|2|t
MN451010|Chậu|cái|2|t
MN451011|Bàn giáo viên|cái|1|g
MN451012|Ghế giáo viên|cái|2|g
MN451013|Bàn cho trẻ|cái|15|t
MN451014|Ghế cho trẻ|cái|30|t
MN451015|Thùng đựng nước có vòi|cái|1|t
MN451016|Thùng đựng rác có nắp đậy|cái|2|c
MN451017|Đầu đĩa DVD|cái|1|c
MN451018|Ti vi|cái|1|c
MN451019|Đàn organ|cái|1|g
MN451020|Giá để đồ chơi và học liệu|cái|5|t
MN452021|Bàn chải đánh răng trẻ em|cái|6|t
MN452022|Mô hình hàm răng|cái|3|t
MN452023|Vòng thể dục nhỏ|cái|30|t
MN452024|Gậy thể dục nhỏ|cái|30|t
MN452025|Cổng chui|cái|5|t
MN452026|Cột ném bóng|cái|2|t
MN452027|Vòng thể dục cho giáo viên|cái|1|g
MN452028|Gậy thể dục cho giáo viên|cái|1|g
MN452029|Bộ chun học toán|cái|6|t
MN452030|Ghế băng thể dục|cái|2|t
MN452031|Bục bật sâu|cái|2|t
MN452032|Nguyên liệu để đan tết|kg|1|t
MN452033|Các khối hình học|bộ|10|t
MN452034|Bộ xâu dây tạo hình|hộp|10|t
MN452035|Kéo thủ công|cái|30|t
MN452036|Kéo văn phòng|cái|1|g
MN452037|Bút chì đen|cái|30|t
MN452038|Bút sáp, phấn vẽ, bút chì màu|hộp|30|t
MN452039|Giấy màu|túi|30|t
MN452040|Bộ dinh dưỡng 1|bộ|1|t
MN452041|Bộ dinh dưỡng 2|bộ|1|t
MN452042|Bộ dinh dưỡng 3|bộ|1|t
MN452043|Bộ dinh dưỡng 4|bộ|1|t
MN452044|Tháp dinh dưỡng|cái|1|g
MN452045|Lô tô dinh dưỡng|bộ|6|t
MN452046|Bộ luồn hạt|bộ|5|t
MN452047|Bộ lắp ghép|bộ|2|t|Khối chữ X
MN452048|Búp bê bé trai|con|3|t
MN452049|Búp bê bé gái|con|3|t
MN452050|Bộ đồ chơi gia đình|bộ|1|t
MN452051|Bộ dụng cụ bác sỹ|bộ|2|t
MN452052|Bộ tranh cảnh báo|bộ|1|g
MN452053|Bộ ghép hình hoa|bộ|3|t
MN452054|Bộ lắp ráp nút tròn|bộ|3|t
MN452055|Hàng rào nhựa|bộ|3|t
MN452056|Bộ xây dựng|bộ|3|t|51 chi tiết
MN452057|Đồ chơi dụng cụ chăm sóc cây|bộ|2|t
MN452058|Đồ chơi dụng cụ sửa chữa đồ dùng gia đình|bộ|2|t
MN452059|Đồ chơi các phương tiện giao thông|bộ|2|t
MN452060|Bộ lắp ráp xe lửa|bộ|1|t
MN452061|Bộ động vật biển|bộ|2|t
MN452062|Bộ động vật sống trong rừng|bộ|2|t
MN452063|Bộ động vật nuôi trong gia đình|bộ|2|t
MN452064|Bộ côn trùng|bộ|2|t
MN452065|Tranh về các loài hoa, rau, quả, củ|bộ|1|t
MN452066|Nam châm thẳng|cái|3|t
MN452067|Kính lúp|cái|3|t
MN452068|Phễu nhựa|cái|3|t
MN452069|Bể chơi với cát và nước|bộ|1|t
MN452070|Cân thăng bằng|bộ|2|t
MN452071|Bộ làm quen với toán|bộ|15|t|Mẫu giáo 4–5 tuổi
MN452072|Đồng hồ lắp ráp|bộ|3|t
MN452073|Bàn tính học đếm|bộ|3|t
MN452074|Bộ hình phẳng|túi|30|t
MN452075|Ghép nút lớn|túi|3|t
MN452076|Bộ đồ chơi nấu ăn gia đình|bộ|3|t
MN452077|Bộ xếp hình các phương tiện giao thông|bộ|3|t
MN452078|Tranh ảnh một số nghề nghiệp|bộ|1|g
MN452079|Một số hình ảnh lễ hội, danh lam, thắng cảnh|bộ|1|t
MN452080|Bảng quay 2 mặt|cái|1|t
MN452081|Bộ sa bàn giao thông|bộ|1|t
MN452082|Lô tô động vật|bộ|10|c
MN452083|Lô tô thực vật|bộ|10|c
MN452084|Lô tô phương tiện giao thông|bộ|10|c
MN452085|Lô tô đồ vật|bộ|10|c
MN452086|Tranh số lượng|tờ|1|t
MN452087|Đomino học toán|bộ|5|t
MN452088|Bộ chữ số và số lượng|bộ|15|t
MN452089|Lô tô hình và số lượng|bộ|15|t
MN452090|Bộ tranh truyện mẫu giáo 4 - 5 tuổi|bộ|2|c
MN452091|Bộ tranh minh họa thơ mẫu giáo 4 - 5 tuổi|bộ|2|c
MN452092|Bộ tranh mẫu giáo 4-5 tuổi theo chủ đề|bộ|2|c
MN452093|Tranh, ảnh về Bác Hồ|bộ|1|c
MN452094|Lịch của bé|bộ|1|t
MN452095|Bộ chữ và số|bộ|6|t
MN452096|Bộ trang phục Công an|bộ|1|t
MN452097|Bộ trang phục Bộ đội|bộ|1|t
MN452098|Bộ trang phục Bác sỹ|bộ|1|t
MN452099|Bộ trang phục nấu ăn|bộ|1|t
MN452100|Bộ xếp hình xây dựng Lăng Bác|bộ|1|t
MN452101|Gạch xây dựng|thùng|1|t
MN452102|Con rối|bộ|1|g
MN452103|Dụng cụ gõ đệm theo phách nhịp|cái|5|t
MN452104|Đất nặn|hộp|30|t
MN452105|Màu nước|hộp|25|t
MN452106|Bút lông cỡ to|cái|12|t
MN452107|Bút lông cỡ nhỏ|cái|12|t
MN452108|Dập ghim|cái|1|g
MN452109|Bìa các màu|tờ|50|g
MN452110|Giấy trắng A0|tờ|50|c
MN452111|Kẹp sắt các cỡ|cái|10|c
MN452112|Dập lỗ|cái|1|g
MN453122|Băng/đĩa các bài hát, nhạc không lời, dân ca, hát ru|bộ|1|g
MN453123|Băng/đĩa thơ ca, truyện kể|bộ|1|g
MN453124|Băng/đĩa hình "Vẽ tranh theo truyện kể"|bộ|1|g
MN453125|Băng/đĩa hình "Kể chuyện theo tranh"|bộ|1|g
MN453126|Băng/đĩa hình về Bác Hồ|bộ|1|g
MN561001|Giá phơi khăn|cái|1|t
MN561002|Cốc uống nước|cái|35|t
MN561003|Tủ (giá) đựng ca cốc|cái|1|t
MN561004|Bình ủ nước|cái|1|t
MN561005|Tủ để đồ dùng cá nhân của trẻ|cái|2|t
MN561006|Tủ đựng chăn, màn, chiếu|cái|2|t
MN561007|Phản|cái|18|t
MN561008|Giá để giày dép|cái|2|t
MN561009|Thùng đựng rác có nắp đậy|cái|2|c
MN561010|Thùng đựng nước có vòi|cái|1|t
MN561011|Xô|cái|2|t
MN561012|Chậu|cái|2|t
MN561013|Bàn cho trẻ|cái|18|t
MN561014|Ghế cho trẻ|cái|35|t
MN561015|Bàn giáo viên|cái|1|g
MN561016|Ghế giáo viên|cái|2|g
MN561017|Giá để đồ chơi và học liệu|cái|5|t
MN561018|Tivi|cái|1|c
MN561019|Đầu đĩa DVD|cái|1|c
MN561020|Đàn organ|cái|1|g
MN562021|Bàn chải đánh răng trẻ em|cái|6|t
MN562022|Mô hình hàm răng|cái|3|t
MN562023|Vòng thể dục to|cái|2|t
MN562024|Vòng thể dục nhỏ|cái|35|t
MN562025|Gậy thể dục nhỏ|cái|35|t
MN562026|Xắc xô|cái|2|g
MN562027|Cổng chui|cái|5|t
MN562028|Gậy thể dục to|cái|2|g
MN562029|Cột ném bóng|cái|2|t
MN562030|Bóng các loại|quả|16|t
MN562031|Đồ chơi Bowling|bộ|5|t
MN562032|Dây thừng|cái|3|t
MN562033|Nguyên liệu để đan tết|kg|1|t
MN562034|Kéo thủ công|cái|35|t
MN562035|Kéo văn phòng|cái|1|g
MN562036|Bút chì đen|cái|35|t
MN562037|Bút sáp, phấn vẽ, bút chì màu|hộp|35|t
MN562038|Bộ dinh dưỡng 1|bộ|1|t
MN562039|Bộ dinh dưỡng 2|bộ|1|t
MN562040|Bộ dinh dưỡng 3|bộ|1|t
MN562041|Bộ dinh dưỡng 4|bộ|1|t
MN562042|Đồ chơi dụng cụ chăm sóc cây|bộ|1|t
MN562043|Bộ lắp ráp kỹ thuật|bộ|2|t
MN562044|Bộ xếp hình xây dựng|bộ|2|t|51 chi tiết
MN562045|Bộ luồn hạt|bộ|5|t
MN562046|Bộ lắp ghép|bộ|2|t|Khối chữ X
MN562047|Đồ chơi các phương tiện giao thông|bộ|2|t
MN562048|Bộ lắp ráp xe lửa|bộ|1|t|Bản đọc được không ghi số lượng, tạm để 1, cần đối chiếu văn bản gốc
MN562049|Bộ sa bàn giao thông|bộ|1|t
MN562050|Bộ động vật sống dưới nước|bộ|2|t
MN562051|Bộ động vật sống trong rừng|bộ|2|t
MN562052|Bộ động vật nuôi trong gia đình|bộ|2|t
MN562053|Bộ côn trùng|bộ|2|t
MN562054|Cân chia vạch|cái|1|t
MN562055|Nam châm thẳng|cái|3|t
MN562056|Kính lúp|cái|3|t
MN562057|Phễu nhựa|cái|3|t
MN562058|Bể chơi với cát và nước|bộ|1|t
MN562059|Ghép nút lớn|bộ|5|t
MN562060|Bộ ghép hình hoa|bộ|5|t
MN562061|Bảng chun học toán|bộ|5|t
MN562062|Đồng hồ học số, học hình|cái|2|t
MN562063|Bàn tính học đếm|cái|2|t
MN562064|Bộ làm quen với toán|bộ|15|t|Mẫu giáo 5–6 tuổi
MN562065|Bộ hình khối|bộ|5|t
MN562066|Bộ nhận biết hình phẳng|túi|35|t
MN562067|Bộ que tính|bộ|15|t
MN562068|Lô tô động vật|bộ|15|c
MN562069|Lô tô thực vật|bộ|15|c
MN562070|Lô tô phương tiện giao thông|bộ|15|c
MN562071|Lô tô đồ vật|bộ|15|c
MN562072|Domino chữ cái và số|hộp|10|t
MN562073|Bảng quay 2 mặt|cái|1|c
MN562074|Bộ chữ cái|bộ|15|t
MN562075|Lô tô lắp ghép các khái niệm tương phản|bộ|5|t
MN562076|Lịch của trẻ|bộ|1|t
MN562077|Tranh ảnh về Bác Hồ|bộ|1|g
MN562078|Tranh cảnh báo nguy hiểm|bộ|1|g
MN562079|Tranh ảnh một số nghề phổ biến|bộ|1|g
MN562080|Bộ tranh truyện mẫu giáo 5 - 6 tuổi|bộ|2|g
MN562081|Bộ tranh minh họa thơ mẫu giáo 5 - 6 tuổi|bộ|2|g
MN562082|Bộ tranh mẫu giáo 5-6 tuổi theo chủ đề|bộ|2|g
MN562083|Bộ dụng cụ lao động|bộ|3|t
MN562084|Bộ đồ chơi nhà bếp|bộ|2|t
MN562085|Bộ đồ chơi đồ dùng gia đình|bộ|2|t
MN562086|Bộ đồ chơi đồ dùng ăn uống|bộ|2|t
MN562087|Bộ trang phục nấu ăn|bộ|1|t
MN562088|Búp bê bé trai|con|3|t
MN562089|Búp bê bé gái|con|3|t
MN562090|Bộ trang phục công an|bộ|2|t
MN562091|Doanh trại bộ đội|bộ|2|t
MN562092|Bộ trang phục bộ đội|bộ|2|t
MN562093|Bộ trang phục công nhân|bộ|2|t
MN562094|Bộ dụng cụ bác sỹ|bộ|2|t
MN562095|Bộ trang phục bác sỹ|bộ|2|t
MN562096|Gạch xây dựng|thùng|2|t
MN562097|Bộ xếp hình xây dựng|bộ|2|t|44 chi tiết
MN562098|Hàng rào lắp ghép lớn|túi|3|t
MN562099|Dụng cụ gõ đệm theo phách nhịp|cái|12|t
MN562100|Đất nặn|hộp|30|t
MN562101|Màu nước|hộp|25|t
MN562102|Bút lông cỡ to|cái|12|t
MN562103|Bút lông cỡ nhỏ|cái|12|t
MN562104|Dập ghim|cái|1|g
MN562105|Bìa các màu|tờ|50|g
MN562106|Giấy trắng A0|tờ|50|c
MN562107|Kẹp sắt các cỡ|cái|10|c
MN562108|Dập lỗ|cái|1|g
MN563119|Băng/đĩa các bài hát, nhạc không lời, dân ca, hát ru|bộ|1|g
MN563120|Băng/đĩa thơ ca, truyện kể|bộ|1|g
MN563121|Băng/đĩa hình "Vẽ tranh theo truyện kể"|bộ|1|g
MN563122|Băng/đĩa hình "Kể chuyện theo tranh"|bộ|1|g
MN563123|Băng/đĩa hình về Bác Hồ|bộ|1|g
MN563124|Băng/đĩa hình các hoạt động giáo dục theo chủ đề|bộ|1|g
`;

export function parseTemplateLines(text: string): EquipmentTemplateItem[] {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      const [code = '', name = '', unit = '', quantity = '', target = '', note] = line.split('|');
      const ageGroup = AGE_GROUP_OF_CODE[code.slice(2, 4)];
      const group = GROUP_OF_DIGIT[code.charAt(4) as keyof typeof GROUP_OF_DIGIT];
      const targetUsers = TARGET_OF_LETTER[target as keyof typeof TARGET_OF_LETTER];
      if (!name || !unit || !ageGroup || !group || !targetUsers || !quantity || !Number.isFinite(Number(quantity))) {
        throw new Error(`Dòng mẫu thiết bị không hợp lệ: ${line}`);
      }
      return {
        code,
        name,
        unit,
        equipment_group: group,
        age_group: ageGroup,
        quantity: Number(quantity),
        target_users: targetUsers,
        note: note ?? null,
      };
    });
}

export const EQUIPMENT_TEMPLATES: EquipmentTemplate[] = [
  {
    code: 'MN-TT02-2010',
    school_level: 'MN',
    title: 'Danh mục đồ dùng, đồ chơi, thiết bị dạy học tối thiểu dùng cho giáo dục mầm non',
    source: 'Thông tư 02/2010/TT-BGDĐT, sửa đổi bởi Thông tư 34/2013/TT-BGDĐT',
    items: parseTemplateLines(MN_TT02_2010),
  },
];
