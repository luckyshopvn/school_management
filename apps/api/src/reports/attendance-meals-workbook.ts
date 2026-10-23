import ExcelJS from 'exceljs';
import { ATTENDANCE_STAGES } from '@school-management/shared';
import {
  DAY_CODES,
  ratePercent,
  type ChildMatrixRow,
  type ClassReport,
  type ReportDay,
} from './attendance-meals-calc.js';
import type { AttendanceMealsReport } from './attendance-meals.js';

// Tệp Excel điểm danh theo mẫu của nhà trường (YCTD-100): bảng "Data" (lịch tháng, mã loại ngày, số ngày ăn, ngày lễ),
// "Tổng hợp" (số trẻ có mặt từng ngày theo lớp, nhóm theo khối), "Tổng hợp tháng" (sĩ số, tổng có mặt, tổng vắng, tỷ lệ,
// khối ký tên) và một bảng cho mỗi lớp (mã P, K, B, N của từng trẻ). Xuất theo ngày, tuần dùng cùng bố cục, giới hạn ở
// các ngày của kỳ. Ô ghi giá trị đã tính, không ghi công thức, để số liệu khớp màn hình
const FONT = 'Times New Roman';
const THIN = { style: 'thin' as const };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const CENTER: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const RESERVED_SHEETS = ['Data', 'Tổng hợp', 'Tổng hợp tháng', 'Tổng hợp tuần', 'Tổng hợp ngày'];

const toDate = (date: string) => new Date(`${date}T00:00:00Z`);
const dayMonthYear = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

function style(
  cell: ExcelJS.Cell,
  options: {
    size?: number;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    fill?: string;
    border?: boolean;
    align?: Partial<ExcelJS.Alignment>;
    numFmt?: string;
    name?: string;
  },
) {
  cell.font = {
    name: options.name ?? FONT,
    size: options.size ?? 14,
    bold: options.bold,
    italic: options.italic,
    ...(options.color ? { color: { argb: options.color } } : {}),
  };
  if (options.fill) {
    cell.fill = solid(options.fill);
  }
  if (options.border) {
    cell.border = BORDER;
  }
  if (options.align) {
    cell.alignment = options.align;
  }
  if (options.numFmt) {
    cell.numFmt = options.numFmt;
  }
}

function titles(report: AttendanceMealsReport) {
  const month = Number(report.from.slice(5, 7));
  const year = report.from.slice(0, 4);
  if (report.period === 'month') {
    return {
      summarySheet: 'Tổng hợp tháng',
      overview: `BẢNG TỔNG HỢP ĐIỂM DANH THÁNG ${month}/${year}`,
      summary: `BẢNG TỔNG HỢP ĐIỂM DANH THÁNG ${month} NĂM ${year}`,
      classSubtitle: `Tháng ${month}-${year}`,
      firstLabel: 'Ngày đầu tháng',
      lastLabel: 'Ngày cuối tháng',
    };
  }
  if (report.period === 'week') {
    const range = `${dayMonthYear(report.from)} - ${dayMonthYear(report.to)}`;
    return {
      summarySheet: 'Tổng hợp tuần',
      overview: `BẢNG TỔNG HỢP ĐIỂM DANH TUẦN ${range}`,
      summary: `BẢNG TỔNG HỢP ĐIỂM DANH TUẦN ${range}`,
      classSubtitle: `Tuần ${range}`,
      firstLabel: 'Ngày đầu tuần',
      lastLabel: 'Ngày cuối tuần',
    };
  }
  return {
    summarySheet: 'Tổng hợp ngày',
    overview: `BẢNG TỔNG HỢP ĐIỂM DANH NGÀY ${dayMonthYear(report.from)}`,
    summary: `BẢNG TỔNG HỢP ĐIỂM DANH NGÀY ${dayMonthYear(report.from)}`,
    classSubtitle: `Ngày ${dayMonthYear(report.from)}`,
    firstLabel: 'Ngày đầu kỳ',
    lastLabel: 'Ngày cuối kỳ',
  };
}

// Tên bảng tính của lớp: bỏ ký tự Excel không cho phép, tối đa 31 ký tự, không trùng
export function classSheetName(name: string, used: Set<string>): string {
  const base = (name.replace(/[\\/?*[\]:]/g, ' ').trim() || 'Lớp').slice(0, 31);
  let candidate = base;
  for (let index = 2; used.has(candidate.toLowerCase()); index += 1) {
    const suffix = ` (${index})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function dataSheet(workbook: ExcelJS.Workbook, report: AttendanceMealsReport, labels: ReturnType<typeof titles>) {
  const sheet = workbook.addWorksheet('Data');
  const set = (address: string, value: ExcelJS.CellValue, options: Parameters<typeof style>[1] = {}) => {
    const cell = sheet.getCell(address);
    cell.value = value;
    style(cell, options);
    return cell;
  };
  set('A1', 'Tháng');
  set('B1', Number(report.from.slice(5, 7)), { align: { horizontal: 'center' } });
  set('C1', 'Năm');
  set('D1', Number(report.from.slice(0, 4)), { align: { horizontal: 'center' } });
  set('A2', labels.firstLabel);
  set('B2', toDate(report.from), { align: { horizontal: 'center' }, numFmt: 'dd/mm/yyyy' });
  set('A3', labels.lastLabel);
  set('B3', toDate(report.to), { align: { horizontal: 'center' }, numFmt: 'dd/mm/yyyy' });
  set('H2', 'Số ngày ăn');
  set('I2', report.meal_day_count, { align: { horizontal: 'right' } });
  set('H3', 'Số ngày nghỉ lễ');
  set('I3', report.holiday_count, { align: { horizontal: 'right' } });
  set('H5', 'Ngày lễ trong năm', { bold: true });
  sheet.getRow(4).height = 35.25;
  sheet.getRow(6).height = 35.25;
  for (const [address, value] of [
    ['A6', 'Ngày'],
    ['B6', 'Thứ'],
    ['C6', 'Mã'],
    ['D6', 'Tính'],
    ['E6', 'Ngày lễ'],
    ['H6', 'Ngày'],
    ['I6', 'Ngày lễ'],
  ] as const) {
    set(address, value, { bold: true, border: true, align: { horizontal: 'center', vertical: 'bottom' } });
  }
  for (const [address, value] of [
    ['L6', 'Mã loại'],
    ['M6', 'Định danh'],
  ] as const) {
    set(address, value, { border: true });
  }
  set('N6', 'Tính', { border: true, align: { horizontal: 'center' } });
  report.days.forEach((day, index) => {
    const row = 7 + index;
    set(`A${row}`, toDate(day.date), { border: true, align: { horizontal: 'center' }, numFmt: 'dd/mm/yyyy' });
    set(`B${row}`, day.weekday_long, { border: true });
    const fill = day.code === 'T7' || day.code === 'CN' ? 'FFB7B7B7' : day.code === 'NL' ? 'FFE06666' : undefined;
    set(`C${row}`, day.code, { border: true, align: { horizontal: 'center' }, fill });
    set(`D${row}`, day.counted, { border: true, align: { horizontal: 'center' } });
    set(`E${row}`, day.holiday_name ?? '', { border: true });
  });
  report.year_holidays.forEach((holiday, index) => {
    set(`H${7 + index}`, toDate(holiday.holiday_date), {
      border: true,
      align: { horizontal: 'center' },
      numFmt: 'dd/mm/yyyy',
    });
    set(`I${7 + index}`, holiday.name, { border: true });
  });
  DAY_CODES.forEach((code, index) => {
    set(`L${7 + index}`, code.code, { border: true });
    set(`M${7 + index}`, code.label, { border: true });
    set(`N${7 + index}`, code.counted, { border: true, align: { horizontal: 'right' } });
  });
  const widths: Record<string, number> = {
    A: 16.44,
    C: 10.44,
    E: 17.33,
    F: 18.56,
    G: 17.22,
    H: 17.22,
    I: 19.11,
    M: 15.22,
  };
  for (const [key, width] of Object.entries(widths)) {
    sheet.getColumn(key).width = width;
  }
}

interface OverviewRow {
  kind: 'header' | 'class' | 'grade' | 'stage' | 'school';
  label: string;
  enrolled: number | null;
  present: Array<number | null>;
}

// Thứ tự dòng của bảng "Tổng hợp": tiêu đề khối, các lớp, dòng cộng của khối (và từng khối lớp nếu có nhiều), toàn trường
function overviewRows(report: AttendanceMealsReport): OverviewRow[] {
  const presentOf = (days: Array<{ date: string; present: number }>) =>
    report.days.map((day) =>
      day.counted && day.passed ? (days.find((item) => item.date === day.date)?.present ?? 0) : null,
    );
  const rows: OverviewRow[] = [];
  for (const { key: stage } of ATTENDANCE_STAGES) {
    const stageGroup = report.groups.find((group) => group.kind === 'stage' && group.key === stage);
    if (!stageGroup) {
      continue;
    }
    rows.push({ kind: 'header', label: stageGroup.label, enrolled: null, present: [] });
    const classes = report.classes.filter((row) => row.stage === stage);
    const grades = report.groups.filter(
      (group) => group.kind === 'grade' && classes.some((row) => row.grade_level === group.key),
    );
    const classRow = (row: ClassReport): OverviewRow => ({
      kind: 'class',
      label: row.class_name,
      enrolled: row.enrolled,
      present: presentOf(row.days),
    });
    if (grades.length > 0) {
      for (const grade of grades) {
        rows.push(...classes.filter((row) => row.grade_level === grade.key).map(classRow));
        rows.push({ kind: 'grade', label: grade.label, enrolled: grade.enrolled, present: presentOf(grade.days) });
      }
    } else {
      rows.push(...classes.map(classRow));
    }
    rows.push({
      kind: 'stage',
      label: stageGroup.label,
      enrolled: stageGroup.enrolled,
      present: presentOf(stageGroup.days),
    });
  }
  rows.push({
    kind: 'school',
    label: 'Toàn trường',
    enrolled: report.totals.enrolled,
    present: presentOf(report.totals.days),
  });
  return rows;
}

function overviewSheet(workbook: ExcelJS.Workbook, report: AttendanceMealsReport, labels: ReturnType<typeof titles>) {
  const sheet = workbook.addWorksheet('Tổng hợp', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 7, topLeftCell: 'C8' }],
  });
  const days = report.days;
  const lastColumn = 2 + days.length;
  const header = sheet.getRow(1);
  header.values = ['Tháng', Number(report.from.slice(5, 7)), 'Năm', Number(report.from.slice(0, 4))];
  header.hidden = true;
  const title = sheet.getCell('A2');
  title.value = labels.overview;
  style(title, { size: 19, bold: true, align: { horizontal: 'left' } });
  // Nhãn "Số ngày ăn" ở H2:I2, số ngày ở J2 như mẫu
  const mealLabelColumn = 8;
  sheet.mergeCells(2, mealLabelColumn, 2, mealLabelColumn + 1);
  const mealLabel = sheet.getCell(2, mealLabelColumn);
  mealLabel.value = 'Số ngày ăn';
  style(mealLabel, { size: 15, bold: true, align: CENTER });
  const mealCount = sheet.getCell(2, mealLabelColumn + 2);
  mealCount.value = report.meal_day_count;
  style(mealCount, { size: 15, bold: true, align: CENTER });
  for (const [row, label] of [
    [3, 'KT'],
    [4, 'Ngày đã qua'],
    [5, 'Ngày làm việc'],
  ] as const) {
    sheet.mergeCells(row, 1, row, 2);
    const cell = sheet.getCell(row, 1);
    cell.value = label;
    style(cell, { size: 15, bold: true, align: { horizontal: 'left' } });
    sheet.getRow(row).height = 22.5;
    days.forEach((day, index) => {
      const passed = day.passed ? 1 : 0;
      const value = row === 3 ? passed + day.counted : row === 4 ? passed : day.counted;
      const dayCell = sheet.getCell(row, 3 + index);
      dayCell.value = value;
      style(dayCell, { size: 15, bold: true, align: CENTER });
    });
  }
  sheet.mergeCells('A6:A7');
  sheet.mergeCells('B6:B7');
  for (const [address, value] of [
    ['A6', 'Lớp'],
    ['B6', 'Sĩ số lớp'],
  ] as const) {
    const cell = sheet.getCell(address);
    cell.value = value;
    style(cell, { bold: true, fill: 'FFAFEEEE', border: true, align: { ...CENTER, wrapText: true } });
  }
  days.forEach((day, index) => {
    const dateCell = sheet.getCell(6, 3 + index);
    dateCell.value = toDate(day.date);
    style(dateCell, { bold: true, fill: 'FFAFEEEE', border: true, align: CENTER, numFmt: 'dd' });
    const weekdayCell = sheet.getCell(7, 3 + index);
    weekdayCell.value = day.weekday;
    style(weekdayCell, { bold: true, fill: 'FFAFEEEE', border: true, align: CENTER });
  });
  let rowNumber = 8;
  for (const row of overviewRows(report)) {
    const isTotal = row.kind !== 'class' && row.kind !== 'header';
    const color = row.kind === 'school' ? 'FFFF0000' : undefined;
    const labelCell = sheet.getCell(rowNumber, 1);
    labelCell.value = row.label;
    style(labelCell, { bold: row.kind !== 'class', color, border: true, align: { horizontal: 'left' } });
    const enrolledCell = sheet.getCell(rowNumber, 2);
    enrolledCell.value = row.enrolled;
    style(enrolledCell, { bold: isTotal, color, border: true, align: CENTER });
    days.forEach((day, index) => {
      const cell = sheet.getCell(rowNumber, 3 + index);
      cell.value = row.kind === 'header' ? null : (row.present[index] ?? null);
      style(cell, { bold: isTotal, color, border: true, align: CENTER, fill: day.counted ? undefined : 'FFD9D9D9' });
    });
    rowNumber += 1;
  }
  // Tỷ lệ có mặt từng ngày của toàn trường: số có mặt trên số trẻ phải có mặt trong ngày
  days.forEach((day, index) => {
    const totals = report.totals.days[index];
    const cell = sheet.getCell(rowNumber, 3 + index);
    cell.value = day.counted && day.passed && totals && totals.expected > 0 ? totals.present / totals.expected : null;
    style(cell, { bold: true, align: CENTER, numFmt: '0.00%', fill: day.counted ? undefined : 'FFD9D9D9' });
  });
  sheet.getColumn(1).width = 15.33;
  sheet.getColumn(2).width = 5.89;
  for (let column = 3; column <= lastColumn; column += 1) {
    sheet.getColumn(column).width = 6.67;
  }
  sheet.pageSetup = {
    // Khổ A3 như mẫu; kiểu của exceljs không liệt kê A3
    paperSize: 8 as unknown as ExcelJS.PaperSize,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 1, right: 1, top: 1, bottom: 1, header: 0, footer: 0 },
  };
}

function summarySheet(
  workbook: ExcelJS.Workbook,
  report: AttendanceMealsReport,
  labels: ReturnType<typeof titles>,
  signedOn: string,
) {
  const sheet = workbook.addWorksheet(labels.summarySheet);
  const days = report.days;
  const firstDay = 6;
  const rateColumn = firstDay + days.length;
  const school = sheet.getCell('A1');
  school.value = report.school_name.toUpperCase();
  style(school, { size: 20, bold: true });
  sheet.mergeCells(3, 1, 3, rateColumn);
  const title = sheet.getCell('A3');
  title.value = labels.summary;
  style(title, { size: 25, bold: true, align: CENTER });
  const mealDays = sheet.getCell('A4');
  mealDays.value = report.meal_day_count;
  style(mealDays, { bold: true, align: CENTER });
  days.forEach((day, index) => {
    const cell = sheet.getCell(4, firstDay + index);
    cell.value = day.counted;
    style(cell, { align: CENTER });
  });
  for (const [column, label] of [
    [1, 'STT'],
    [2, 'LỚP'],
    [3, 'Sĩ số HS'],
    [4, 'Tổng có mặt'],
    [5, 'Tổng vắng mặt'],
    [rateColumn, 'Tỷ lệ %'],
  ] as const) {
    sheet.mergeCells(5, column, 6, column);
    const cell = sheet.getCell(5, column);
    cell.value = label;
    style(cell, { size: 20, bold: true, fill: 'FFBDBDBD', border: true, align: { ...CENTER, wrapText: true } });
  }
  days.forEach((day, index) => {
    const gray = day.counted ? undefined : 'FF999999';
    const weekday = sheet.getCell(5, firstDay + index);
    weekday.value = day.weekday;
    style(weekday, { size: 20, bold: true, fill: gray ?? 'FFBDBDBD', border: true, align: CENTER });
    const date = sheet.getCell(6, firstDay + index);
    date.value = toDate(day.date);
    style(date, { size: 20, bold: true, fill: gray ?? 'FFFFFFFF', border: true, align: CENTER, numFmt: 'dd' });
  });
  sheet.getRow(5).height = 45;
  sheet.getRow(6).height = 29.25;
  let rowNumber = 7;
  report.classes.forEach((row, index) => {
    const fill = index % 2 === 0 ? 'FFE0F7FA' : 'FFFFFFFF';
    const values: Array<[number, ExcelJS.CellValue, boolean]> = [
      [1, index + 1, false],
      [2, row.class_name, true],
      [3, row.enrolled, true],
      [4, row.present, false],
      [5, row.expected - row.present, false],
    ];
    for (const [column, value, bold] of values) {
      const cell = sheet.getCell(rowNumber, column);
      cell.value = value;
      style(cell, { size: 20, bold, fill, border: true, align: column === 2 ? undefined : CENTER });
    }
    days.forEach((day, dayIndex) => {
      const cell = sheet.getCell(rowNumber, firstDay + dayIndex);
      cell.value = day.counted && day.passed ? (row.days[dayIndex]?.present ?? 0) : null;
      style(cell, { size: 20, fill: day.counted ? fill : 'FF999999', border: true, align: CENTER });
    });
    const rate = sheet.getCell(rowNumber, rateColumn);
    rate.value = row.expected > 0 ? row.present / row.expected : 0;
    style(rate, { size: 20, fill, border: true, numFmt: '0.00%' });
    rowNumber += 1;
  });
  sheet.mergeCells(rowNumber, 1, rowNumber, 2);
  const totals = report.totals;
  const sumRow: Array<[number, ExcelJS.CellValue]> = [
    [1, 'CỘNG'],
    [3, totals.enrolled],
    [4, totals.present],
    [5, totals.expected - totals.present],
    [rateColumn, totals.expected > 0 ? totals.present / totals.expected : 0],
  ];
  for (const [column, value] of sumRow) {
    const cell = sheet.getCell(rowNumber, column);
    cell.value = value;
    style(cell, {
      size: 20,
      bold: column !== rateColumn,
      fill: 'FFFFFFFF',
      border: true,
      align: column === rateColumn ? undefined : CENTER,
      numFmt: column === rateColumn ? '0.00%' : undefined,
    });
  }
  days.forEach((day, index) => {
    const cell = sheet.getCell(rowNumber, firstDay + index);
    cell.value = day.counted && day.passed ? (totals.days[index]?.present ?? 0) : null;
    style(cell, { size: 20, bold: true, fill: day.counted ? 'FFFFFFFF' : 'FF999999', border: true, align: CENTER });
  });
  rowNumber += 1;
  sheet.mergeCells(rowNumber, 1, rowNumber, 2);
  const rateLabel = sheet.getCell(rowNumber, 1);
  rateLabel.value = 'TỶ LỆ';
  style(rateLabel, { size: 20, bold: true, fill: 'FFE0F7FA', align: CENTER });
  days.forEach((day, index) => {
    const dayTotals = totals.days[index];
    const cell = sheet.getCell(rowNumber, firstDay + index);
    cell.value =
      day.counted && day.passed && dayTotals ? (ratePercent(dayTotals.present, dayTotals.expected) ?? 0) / 100 : null;
    style(cell, { size: 15, bold: true, fill: 'FFE0F7FA', align: CENTER, numFmt: '0.00%' });
  });
  // Khối ký tên dưới bảng như mẫu: người lập bảng bên trái, hiệu trưởng bên phải; họ tên để trống cho người ký ghi
  const signRow = rowNumber + 3;
  sheet.mergeCells(signRow, 4, signRow, 6);
  const maker = sheet.getCell(signRow, 4);
  maker.value = 'Người lập bảng';
  style(maker, { size: 20, bold: true, align: CENTER });
  const rightEnd = Math.max(rateColumn - 1, 8);
  const rightStart = Math.max(rightEnd - 7, 7);
  sheet.mergeCells(signRow, rightStart, signRow, rightEnd);
  const place = sheet.getCell(signRow, rightStart);
  place.value = `Ngày ${Number(signedOn.slice(8, 10))} tháng ${Number(signedOn.slice(5, 7))} năm ${signedOn.slice(0, 4)}`;
  style(place, { size: 20, italic: true, align: CENTER });
  sheet.mergeCells(signRow + 1, rightStart, signRow + 1, rightEnd);
  const principal = sheet.getCell(signRow + 1, rightStart);
  principal.value = 'HIỆU TRƯỞNG';
  style(principal, { size: 20, bold: true, align: CENTER });
  const widths = [6.44, 17.11, 7.33, 10.33, 10.67];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  for (let column = firstDay; column < rateColumn; column += 1) {
    sheet.getColumn(column).width = 8;
  }
  sheet.getColumn(rateColumn).width = 10.89;
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0, footer: 0 },
  };
}

const CELL_TEXT: Record<string, string> = { future: '', off: '' };

function classSheet(
  workbook: ExcelJS.Workbook,
  report: AttendanceMealsReport,
  labels: ReturnType<typeof titles>,
  row: ClassReport,
  children: ChildMatrixRow[],
  sheetName: string,
) {
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', xSplit: 3, ySplit: 0 }] });
  const days: ReportDay[] = report.days;
  const firstDay = 4;
  const absentColumn = firstDay + days.length;
  const presentColumn = absentColumn + 1;
  const rateColumn = absentColumn + 2;
  for (const [rowNumber, value] of [
    [1, report.school_name.toUpperCase()],
    [2, `LỚP: ${row.class_name}`],
  ] as const) {
    sheet.mergeCells(rowNumber, 1, rowNumber, 3);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = value;
    style(cell, { size: 18, bold: true, align: CENTER });
  }
  for (const [rowNumber, value] of [
    [3, 'BẢNG ĐIỂM DANH BỆNH'],
    [4, `${labels.classSubtitle} (${report.meal_day_count} ngày ăn)`],
  ] as const) {
    sheet.mergeCells(rowNumber, firstDay, rowNumber, rateColumn);
    const cell = sheet.getCell(rowNumber, firstDay);
    cell.value = value;
    style(cell, { size: 18, bold: true, align: CENTER });
  }
  for (const [rowNumber, label] of [
    [5, 'KT'],
    [6, 'Ngày đã qua'],
    [7, 'Ngày làm việc'],
  ] as const) {
    sheet.getRow(rowNumber).height = 24;
    const labelCell = sheet.getCell(rowNumber, 2);
    labelCell.value = label;
    style(labelCell, { size: 12, italic: true, color: 'FF7F7F7F' });
    days.forEach((day, index) => {
      const passed = day.passed ? 1 : 0;
      const cell = sheet.getCell(rowNumber, firstDay + index);
      cell.value = rowNumber === 5 ? passed + day.counted : rowNumber === 6 ? passed : day.counted;
      style(cell, { name: 'Tahoma', size: 18, bold: true, align: CENTER });
    });
  }
  sheet.mergeCells(8, 1, 9, 1);
  sheet.mergeCells(8, 2, 9, 3);
  for (const [column, label] of [
    [1, 'STT'],
    [2, 'Họ tên'],
    [absentColumn, 'Vắng mặt'],
    [presentColumn, 'Hiện diện'],
    [rateColumn, 'Tỷ lệ'],
  ] as const) {
    if (column >= absentColumn) {
      sheet.mergeCells(8, column, 9, column);
    }
    const cell = sheet.getCell(8, column);
    cell.value = label;
    style(cell, { size: 18, bold: true, fill: 'FFAFEEEE', border: true, align: { ...CENTER, wrapText: true } });
  }
  days.forEach((day, index) => {
    const date = sheet.getCell(8, firstDay + index);
    date.value = toDate(day.date);
    style(date, { size: 18, bold: true, fill: 'FFAFEEEE', border: true, align: CENTER, numFmt: 'dd' });
    const weekday = sheet.getCell(9, firstDay + index);
    weekday.value = day.weekday;
    style(weekday, { size: 18, bold: true, fill: 'FFAFEEEE', border: true, align: CENTER });
  });
  sheet.getRow(8).height = 24;
  sheet.getRow(9).height = 25.5;
  let rowNumber = 10;
  children.forEach((child, index) => {
    sheet.mergeCells(rowNumber, 2, rowNumber, 3);
    const order = sheet.getCell(rowNumber, 1);
    order.value = index + 1;
    style(order, { size: 18, border: true, align: CENTER });
    const name = sheet.getCell(rowNumber, 2);
    name.value = child.full_name;
    style(name, { size: 18, border: true });
    days.forEach((day, dayIndex) => {
      const code = child.codes[day.date] ?? '';
      const cell = sheet.getCell(rowNumber, firstDay + dayIndex);
      cell.value = CELL_TEXT[code] ?? code;
      style(cell, { size: 18, border: true, align: CENTER, fill: day.counted ? undefined : 'FFB7B7B7' });
    });
    for (const [column, value, numFmt] of [
      [absentColumn, child.absent, undefined],
      [presentColumn, child.present, undefined],
      [rateColumn, child.expected > 0 ? child.present / child.expected : 0, '0.00%'],
    ] as const) {
      const cell = sheet.getCell(rowNumber, column);
      cell.value = value;
      style(cell, { size: 18, border: true, align: CENTER, numFmt });
    }
    rowNumber += 1;
  });
  rowNumber += 1;
  const total = sheet.getCell(rowNumber, 2);
  total.value = 'TỔNG CỘNG';
  style(total, { size: 18, bold: true });
  for (const [column, value] of [
    [absentColumn, children.reduce((sum, child) => sum + child.absent, 0)],
    [presentColumn, children.reduce((sum, child) => sum + child.present, 0)],
  ] as const) {
    const cell = sheet.getCell(rowNumber, column);
    cell.value = value;
    style(cell, { size: 18, bold: true, align: CENTER });
  }
  rowNumber += 1;
  // Số trẻ hiện diện, vắng (P, K, B) và nghỉ bệnh từng ngày
  for (const [label, pick] of [
    ['Hiện diện', (day: (typeof row.days)[number]) => day.present],
    ['Vắng mặt', (day: (typeof row.days)[number]) => day.absent_p + day.absent_k + day.absent_b],
    ['Bệnh', (day: (typeof row.days)[number]) => day.absent_b],
  ] as const) {
    const labelCell = sheet.getCell(rowNumber, 2);
    labelCell.value = label;
    style(labelCell, { size: 18, bold: true, border: true, align: CENTER });
    days.forEach((day, index) => {
      const dayCounts = row.days[index];
      const cell = sheet.getCell(rowNumber, firstDay + index);
      cell.value = day.counted && day.passed && dayCounts ? pick(dayCounts) : 0;
      style(cell, { size: 18, bold: label === 'Hiện diện', border: true, align: CENTER, numFmt: '0' });
    });
    rowNumber += 1;
  }
  const legend = sheet.getCell(rowNumber + 1, 2);
  legend.value =
    'Ký hiệu: để trống là có mặt; P nghỉ có phép; K nghỉ không phép; B nghỉ bệnh; N không tính; ? chưa điểm danh';
  style(legend, { size: 12, italic: true });
  sheet.getColumn(1).width = 7.56;
  sheet.getColumn(2).width = 25.11;
  sheet.getColumn(3).width = 8.33;
  for (let column = firstDay; column < absentColumn; column += 1) {
    sheet.getColumn(column).width = 8.11;
  }
  sheet.getColumn(absentColumn).width = 8;
  sheet.getColumn(presentColumn).width = 8;
  sheet.getColumn(rateColumn).width = 9.78;
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0, footer: 0 },
  };
}

export function attendanceWorkbook(
  report: AttendanceMealsReport,
  options: { createdAt: Date; signedOn: string },
): { workbook: ExcelJS.Workbook; rowCount: number } {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'School Management';
  workbook.created = options.createdAt;
  const labels = titles(report);
  dataSheet(workbook, report, labels);
  overviewSheet(workbook, report, labels);
  summarySheet(workbook, report, labels, options.signedOn);
  const used = new Set(RESERVED_SHEETS.map((name) => name.toLowerCase()));
  let rowCount = report.classes.length;
  for (const row of report.classes) {
    const children = report.children[row.class_id] ?? [];
    rowCount += children.length;
    classSheet(workbook, report, labels, row, children, classSheetName(row.class_name, used));
  }
  return { workbook, rowCount };
}
