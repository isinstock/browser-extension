import {type ComponentChildren, createContext} from 'preact'

import {useAccessToken} from '../hooks'

type UserContextValues = {
  accessToken: string | null
}
const UserContext = createContext<Partial<UserContextValues>>({})

export function UserProvider({children}: {children: ComponentChildren}) {
  const {accessToken} = useAccessToken()
  return <UserContext.Provider value={{accessToken}}>{children}</UserContext.Provider>
}
