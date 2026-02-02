/**
 * Transforms a Best Buy product URL from the /product/ format to the /site/ format.
 *
 * Input:  https://www.bestbuy.com/product/scuf-envision-pro-v1-wireless-gaming-controller-for-pc-steel-gray/J3RZQZR92W
 * Output: https://www.bestbuy.com/site/scuf-envision-pro-v1-wireless-gaming-controller-for-pc-steel-gray/1234567.p
 */
export const transformBestBuyUrl = (url: string, sku: string): string => {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    const productIndex = pathParts.indexOf('product')
    if (productIndex !== -1) {
      pathParts[productIndex] = 'site'
    }
    if (pathParts.length > 0) {
      pathParts[pathParts.length - 1] = `${sku}.p`
    }
    urlObj.pathname = pathParts.join('/')
    return urlObj.toString()
  } catch (error) {
    console.error('Failed to transform Best Buy URL:', error)
    return url
  }
}
