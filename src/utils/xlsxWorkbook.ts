import type { SheetData } from "./xlsxSheetData";

// ワークブック組み立てに必要な部分だけを型として取り出す。
// 型としてしか参照しないので、このモジュール自体は wasm に依存しない
// （ブラウザでは web ビルド、テストでは nodejs ビルドを引数で渡す）。
export type XlsxApi = Pick<
  typeof import("wasm-xlsxwriter/web"),
  "Workbook" | "Format" | "FormatBorder" | "Color" | "ExcelDateTime"
>;

const HEADER_BACKGROUND = 0xe8eef7;

export function assembleWorkbook(xlsx: XlsxApi, sheets: SheetData[]): Uint8Array {
  const { Workbook, Format, FormatBorder, Color, ExcelDateTime } = xlsx;
  const workbook = new Workbook();

  try {
    const headerFormat = new Format()
      .setBold()
      .setBackgroundColor(Color.rgb(HEADER_BACKGROUND))
      .setBorder(FormatBorder.Thin);
    const noteFormat = new Format().setBold();
    const percentFormat = new Format().setNumFormat("0.0%");
    const dateFormat = new Format().setNumFormat("yyyy/mm/dd hh:mm");

    for (const sheet of sheets) {
      const worksheet = workbook.addWorksheet();
      worksheet.setName(sheet.name);

      const notes = sheet.notes ?? [];
      notes.forEach((note, i) => worksheet.writeWithFormat(i, 0, note, noteFormat));
      // 説明行があるときは1行あけてから表を始める。
      const headerRow = notes.length > 0 ? notes.length + 1 : 0;

      worksheet.writeRowWithFormat(
        headerRow,
        0,
        sheet.columns.map((c) => c.header),
        headerFormat,
      );

      sheet.rows.forEach((cells, rowIndex) => {
        const row = headerRow + 1 + rowIndex;
        cells.forEach((value, col) => {
          if (value === undefined) return; // 空セルは書き込まない
          switch (sheet.columns[col].format) {
            case "date":
              // Date をそのまま渡すと UTC 基準で直列化されてしまうため、
              // ローカル日時文字列を Excel の日付として解釈させる。
              worksheet.writeDateWithFormat(
                row,
                col,
                ExcelDateTime.parseFromStr(String(value)),
                dateFormat,
              );
              break;
            case "percent":
              worksheet.writeWithFormat(row, col, value, percentFormat);
              break;
            default:
              worksheet.write(row, col, value);
          }
        });
      });

      sheet.columns.forEach((c, col) => worksheet.setColumnWidth(col, c.width));
      worksheet.setFreezePanes(headerRow + 1, 0);
      if (sheet.rows.length > 0) {
        worksheet.autofilter(
          headerRow,
          0,
          headerRow + sheet.rows.length,
          sheet.columns.length - 1,
        );
      }
    }

    return workbook.saveToBufferSync();
  } finally {
    // 繰り返しエクスポートしたときに wasm 側のメモリを溜め込まないよう解放する。
    workbook.free();
  }
}
