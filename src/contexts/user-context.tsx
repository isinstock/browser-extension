import {type ComponentChildren, createContext} from 'preact'

import {useAuth} from '../hooks'

type UserContextValues = {
  accessToken: string | null
}
const UserContext = createContext<Partial<UserContextValues>>({})

export function UserProvider({children}: {children: ComponentChildren}) {
  const {accessToken} = useAuth()
  return <UserContext.Provider value={{accessToken}}>{children}</UserContext.Provider>
}
