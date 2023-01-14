const fetchPoll = async (url: RequestInfo, options: RequestInit, pollInterval = 1000): Promise<Response> => {
  const poll = async (wait: number): Promise<Response> => {
    const request = new Request(url, options)
    const response = await fetch(request)

    const {status} = response
    if (status < 200 || status >= 300) {
      throw new Error(`Bad response status ${status}`)
    }

    if (status === 200) {
      return response
    }

    if (status === 202) {
      await new Promise(resolve => setTimeout(resolve, wait))
      return poll(wait)
    }

    throw new Error(`Bad response status ${status}`)
  }
  return poll(pollInterval)
}

export default fetchPoll
