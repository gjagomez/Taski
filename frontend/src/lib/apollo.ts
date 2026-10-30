import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'

export const TOKEN_KEY = 'gestor.token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/'

export const client = new ApolloClient({
  link: new HttpLink({
    uri: API_URL,
    fetch: (uri, options) => {
      const token = getToken()
      const headers = new Headers(options?.headers)
      if (token) headers.set('authorization', `Bearer ${token}`)
      return fetch(uri, { ...options, headers })
    },
  }),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
})

/** Extrae un mensaje legible de un error de Apollo/GraphQL. */
export function errorMessage(error: unknown): string {
  const e = error as { errors?: { message: string }[]; message?: string }
  return e?.errors?.[0]?.message ?? e?.message ?? 'Ocurrió un error inesperado'
}
