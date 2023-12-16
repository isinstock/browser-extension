export class FetchError extends Error {
  status: number
  response: Response

  constructor(response: Response) {
    super(`Could not fetch ${response.url} (${response.status})`)

    this.status = response.status
    this.response = response
    this.name = 'FetchError'
  }
}
