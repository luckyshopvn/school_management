# Tệp mẫu danh mục đơn vị (dữ liệu giả)

Hai tệp ở đây chỉ để kiểm thử công cụ nhập danh mục đơn vị toàn quốc (DT-24, `tai_lieu/32` mục 16). Toàn bộ là dữ liệu giả:
mã sở 97, 98 và mã phường, xã 99xxx không có trong danh mục hành chính; tên trường, tên địa phương là tên bịa.

Tệp mẫu cố ý có các dòng cần làm sạch để kiểm thử: mã không chuẩn, tên rỗng, thiếu phường, xã, mã xã không có trong danh mục,
trường liên cấp, ô có dấu phẩy trong ngoặc kép, một mã đã che và một mã 12 chữ số trùng khuôn số căn cước (cả hai phải bị loại).

**Không đặt tệp danh mục thật vào kho mã** (kho công khai). Cách nạp danh mục thật khi triển khai: `tai_lieu/32` mục 16.6.
