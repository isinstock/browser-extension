export enum SkuImportState {
  Pending = 'pending',
  Started = 'started',
  Finished = 'finished',
  Errored = 'errored',
}

export interface SkuImportResponse {
  state: SkuImportState
  url: string
  skuUrl?: string
}

export interface SkuImportResponseFinished extends SkuImportResponse {
  state: SkuImportState.Finished
  skuUrl: string
}
