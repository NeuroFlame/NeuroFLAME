// src/hooks/useComputationParameters.ts
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useCentralApi } from "../../../apis/centralApi/centralApi";
import { useConsortiumDetailsContext } from "../ConsortiumDetailsContext";

export const useComputationParameters = () => {
    const { refetch, isLeader, data: consortiumDetails } = useConsortiumDetailsContext();
    const computationParameters = consortiumDetails?.studyConfiguration?.computationParameters;
    const [isEditing, setIsEditing] = useState(false);
    const { studySetParameters } = useCentralApi();
    const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string;
    const handleEdit = () => setIsEditing(true);

    const handleSave = async (newParameters: string) => {
        await studySetParameters({ consortiumId, parameters: newParameters });
        // setComputationParameters(newParameters);
        refetch();
        setIsEditing(false);
    };

    const handleCancel = () => setIsEditing(false);

    return {
        isEditing,
        isLeader,
        computationParameters,
        handleEdit,
        handleSave,
        handleCancel,
    };
};
