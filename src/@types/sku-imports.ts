export enum SkuImportState {
  Pending = 'pending',
  Started = 'started',
  Finished = 'finished',
  Errored = 'errored',
}

export interface SkuImportResponse {
  state: SkuImportState
  url: string
}
