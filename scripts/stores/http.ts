// What the store clients share: the fetch they're given (a fake in the tests), a wait between two looks, and a plain
// error when a store answers with an error (its status and what it said, never the request's credentials).

export type Fetch = typeof fetch
export type Sleep = (ms: number) => Promise<void>
export type Log = (line: string) => void

export const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** The answer's JSON; an answer that isn't 2xx throws, saying which call and what the store said. */
export async function answer<T>(response: Response, what: string): Promise<T> {
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${what}: ${response.status} ${response.statusText}: ${text.slice(0, 2000)}`)
  }
  return (text.length > 0 ? JSON.parse(text) : {}) as T
}

/** Asks again until `done` says the answer is final, a pause between two; past `tries`, it gives up. */
export async function poll<T>(
  look: () => Promise<T>,
  done: (value: T) => boolean,
  options: { what: string; tries: number; every: number; wait: Sleep },
): Promise<T> {
  for (let tried = 1; ; tried++) {
    const value = await look()
    if (done(value)) {
      return value
    }
    if (tried >= options.tries) {
      throw new Error(`${options.what}: still not done after ${tried} looks.`)
    }
    await options.wait(options.every)
  }
}
