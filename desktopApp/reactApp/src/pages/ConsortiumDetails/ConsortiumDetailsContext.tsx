import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import {
  PublicUser,
  StudyConfiguration,
} from '../../apis/centralApi/generated/graphql'
import { useParams } from 'react-router-dom'
import { useUserState } from '../../contexts/UserStateContext'

// Define the shape of the context
interface ConsortiumDetailsContextType {
  data: {
    studyConfiguration?: StudyConfiguration;
    members: PublicUser[];
    activeMembers: PublicUser[];
    readyMembers: PublicUser[];
    leader: PublicUser;
    title: string;
    description: string;
    isPrivate: boolean;
  };
  status: {
    loading: boolean;
    error: string | null;
  };
  refetch: () => void;
  isLeader: boolean;
  deleteConsortium: () => Promise<void>;
  updateConsortiumPrivacy: (isPrivate: boolean) => Promise<void>;
}

// Create the context
const ConsortiumDetailsContext =
  createContext<ConsortiumDetailsContextType | undefined>(undefined)

// Custom hook to use the context
export const useConsortiumDetailsContext = () => {
  const context = useContext(ConsortiumDetailsContext)
  if (!context) {
    throw new Error('useConsortiumDetailsContext must be used within a ConsortiumDetailsProvider')
  }
  return context
}

// Provider component to manage and provide consortium details
interface ConsortiumDetailsProviderProps {
  children: ReactNode;
}

export const ConsortiumDetailsProvider:
React.FC<ConsortiumDetailsProviderProps> = ({ children }) => {
  const {
    getConsortiumDetails,
    consortiumDelete,
    consortiumEdit,
    subscriptions: {
      consortiumDetailsChanged,
    },
  } = useCentralApi()
  const { consortiumId } = useParams<{ consortiumId: string }>()
  const { userId } = useUserState()

  // State Variables
  const [
    studyConfiguration,
    setStudyConfiguration,
  ] = useState<StudyConfiguration>()
  const [members, setMembers] = useState<PublicUser[]>([])
  const [activeMembers, setActiveMembers] = useState<PublicUser[]>([])
  const [readyMembers, setReadyMembers] = useState<PublicUser[]>([])
  const [leader, setLeader] = useState<PublicUser>({ id: '', username: '' })
  const [title, setTitle] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [isPrivate, setIsPrivate] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLeader, setIsLeader] = useState(false)

  // Fetch consortium details function
  const fetchConsortiumDetails = useCallback(async () => {
    if (!consortiumId) return
    setLoading(true)
    setError(null)

    try {
      const result = await getConsortiumDetails({ consortiumId })
      setMembers(result.members)
      setActiveMembers(result.activeMembers)
      setReadyMembers(result.readyMembers)
      setLeader(result.leader)
      setTitle(result.title)
      setDescription(result.description)
      setIsPrivate(result.isPrivate)
      setStudyConfiguration(result.studyConfiguration)

      setIsLeader(result.leader.id === userId)
    } catch (err) {
      setError('Failed to fetch consortium details.')
    } finally {
      setLoading(false)
    }
  }, [consortiumId, getConsortiumDetails, userId])

  // Effect to handle fetching and subscribing to changes
  useEffect(() => {
    if (consortiumId) {
      fetchConsortiumDetails()
      const subscription = consortiumDetailsChanged({ consortiumId })
        .subscribe({
          next: () => {
            fetchConsortiumDetails()
          },
        })
      return () => {
        subscription.unsubscribe()
      }
    }
  }, [consortiumId])

  // Handle consortium deletion
  const deleteConsortium = useCallback(async () => {
    if (!consortiumId) return
    setLoading(true)
    setError(null)

    try {
      await consortiumDelete({ consortiumId })
      // You can navigate away here if needed, e.g., to a list page
      // navigate('/consortia');
    } catch (err) {
      setError('Failed to delete consortium.')
    } finally {
      setLoading(false)
    }
  }, [consortiumId, consortiumDelete])

  const updateConsortiumPrivacy = useCallback(
    async (value: boolean) => {
      if (!consortiumId) return
      setLoading(true)
      setError(null)
      try {
        await consortiumEdit({
          consortiumId,
          title,
          description,
          isPrivate: value,
        })
        setIsPrivate(value)
        await fetchConsortiumDetails()
      } catch (err) {
        setError('Failed to update consortium privacy.')
      } finally {
        setLoading(false)
      }
    },
    [consortiumId, consortiumEdit, title, description, fetchConsortiumDetails],
  )

  // Context value
  const contextValue: ConsortiumDetailsContextType = {
    data: {
      studyConfiguration,
      members,
      activeMembers,
      readyMembers,
      leader,
      title,
      description,
      isPrivate,
    },
    status: {
      loading,
      error,
    },
    refetch: fetchConsortiumDetails,
    isLeader,
    deleteConsortium,
    updateConsortiumPrivacy,
  }

  return (
    <ConsortiumDetailsContext.Provider value={contextValue}>
      {children}
    </ConsortiumDetailsContext.Provider>
  )
}
