import type {
  ImportCommitRequest,
  StartTvTimeImportDto,
  TvTimeImportJobDto,
} from "@tracklore/shared";
import { request } from "./core";

/** Analyse an export → reconciliation plan (writes nothing). Poll the job. */
export function analyzeTvTimeImport(
  body: StartTvTimeImportDto,
): Promise<TvTimeImportJobDto> {
  return request("/import/tvtime/analyze", { method: "POST", body });
}

/** Commit an analysed import with the user's reconciliation decisions. */
export function commitTvTimeImport(
  jobId: string,
  body: ImportCommitRequest,
): Promise<TvTimeImportJobDto> {
  return request(`/import/tvtime/${jobId}/commit`, { method: "POST", body });
}

export function getTvTimeImportJob(jobId: string): Promise<TvTimeImportJobDto> {
  return request(`/import/tvtime/${jobId}`);
}
