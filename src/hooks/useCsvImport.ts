import { useCallback, useState } from "react";
import { useRecords } from "../state/hooks/useRecords";
import { parseCsvImport } from "../utils/csvImportHelpers";

type ImportStatus = "idle" | "success" | "error";

export interface ImportResult {
  importedCount: number;
  errorCount: number;
}

export function useCsvImport() {
  const { importRows } = useRecords();
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);

  const importCsv = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result;
          if (typeof text !== "string") {
            setStatus("error");
            setResult(null);
            return;
          }
          const { rows, errors } = parseCsvImport(text);
          if (rows.length === 0 && errors.length > 0) {
            setStatus("error");
            setResult({ importedCount: 0, errorCount: errors.length });
            return;
          }
          const { importedCount } = importRows(rows);
          setResult({ importedCount, errorCount: errors.length });
          setStatus("success");
        } catch {
          setStatus("error");
          setResult(null);
        }
      };
      reader.onerror = () => {
        setStatus("error");
        setResult(null);
      };
      reader.readAsText(file, "utf-8");
    },
    [importRows],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
  }, []);

  return { importCsv, status, result, reset };
}
