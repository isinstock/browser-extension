import {Coordinate} from '../@types/locations'

// Radius of the Earth in miles
const EarthRadius = 3958.8

export const haversineLabel = ({center, location}: {center: Coordinate; location: Coordinate}): string => {
  const miles = haversineDistance({center, location})
  const roundedMiles = Math.floor(miles)
  const suffix = roundedMiles === 1 ? 'mile' : 'miles'

  return `${roundedMiles} ${suffix}`
}

export const haversineDistance = ({center, location}: {center: Coordinate; location: Coordinate}): number => {
  const rlat1 = center.latitude * (Math.PI / 180) // Convert degrees to radians
  const rlat2 = location.latitude * (Math.PI / 180) // Convert degrees to radians
  const diffLat = rlat2 - rlat1 // Radian difference (latitudes)
  const diffLon = (location.longitude - center.longitude) * (Math.PI / 180) // Radian difference (longitudes)

  return (
    2 *
    EarthRadius *
    Math.asin(
      Math.sqrt(
        Math.sin(diffLat / 2) * Math.sin(diffLat / 2) +
          Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(diffLon / 2) * Math.sin(diffLon / 2),
      ),
    )
  )
}
