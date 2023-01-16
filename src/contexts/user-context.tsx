import type {ComponentChildren, Provider} from 'preact'
import {createContext} from 'preact'
import {useEffect, useState} from 'preact/hooks'
import {useAuth} from '../hooks'

type UserContextValues = {
  accessToken: string | null
}
const UserContext = createContext<Partial<UserContextValues>>({})

export function UserProvider({children}: {children: ComponentChildren}) {
  const {accessToken} = useAuth()
  return <UserContext.Provider value={{accessToken}}>{children}</UserContext.Provider>
}
