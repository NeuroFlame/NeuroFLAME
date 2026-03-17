import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
} from '@apollo/client'

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_API_URL,
})

const authLink = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem('accessToken')

  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      'x-access-token': token || '',
    },
  }))

  return forward(operation)
})

const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
})

export default apolloClient
