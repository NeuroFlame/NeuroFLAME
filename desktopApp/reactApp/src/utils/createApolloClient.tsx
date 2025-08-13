import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  split,
  ApolloLink,
  from,
} from '@apollo/client'
import { onError } from '@apollo/client/link/error'
import { getMainDefinition } from '@apollo/client/utilities'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { createClient } from 'graphql-ws'

type ApolloClientConfig = {
  httpUrl: string
  wsUrl: string
  getAccessToken: () => string // Function that returns a string
}

// Error Handling Link

// Setup Apollo Client
export const createApolloClient = ({
  httpUrl,
  wsUrl,
  getAccessToken,
}: ApolloClientConfig) => {
  const httpLink = new HttpLink({ uri: httpUrl })
  const wsLink = new GraphQLWsLink(
    createClient({
      url: wsUrl,
      connectionParams: () => {
        return { accessToken: getAccessToken() }
      },
    }),
  )

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors)
      graphQLErrors.forEach((err) =>
        console.error(
          '[GraphQL error]:',
          JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
        )
      )
    if (networkError) console.error(`[Network error]: ${networkError}`)
  })

  // Authentication Link
  const authLink = new ApolloLink((operation, forward) => {

    operation.setContext(({ headers = {} }) => ({
      headers: {
        ...headers,
        'x-access-token': getAccessToken(),
      },
    }))
    return forward(operation)
  })

  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query)
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      )
    },
    wsLink,
    authLink.concat(httpLink),
  )

  return new ApolloClient({
    link: from([errorLink, splitLink]),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
      },
      query: {
        fetchPolicy: 'no-cache',
      },
    },
  })
}

