export interface Coordinate {
  latitude: number
  longitude: number
}

export enum LocationStyle {
  Physical = 'physical',
  BigBox = 'big_box',
  Mobile = 'mobile',
  Express = 'express',
  Warehouse = 'warehouse',
  Online = 'online',
}

export enum LocationStyleNormalized {
  Physical = 'physical',
  Online = 'online',
  Unknown = 'unknown',
}
