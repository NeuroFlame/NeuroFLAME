// VaultUserList.tsx

import React, { useEffect, useState } from "react";
import { useCentralApi } from "../../../apis/centralApi/centralApi";
import { PublicUser } from "../../../apis/centralApi/generated/graphql";
import { useParams } from "react-router-dom";
import {
    Container,
    List,
    ListItem,
    ListItemText,
    Button,
    Divider,
    Typography,
    Box
} from "@mui/material";

interface VaultUserListProps {
    onClose: () => void;
}

const VaultUserList: React.FC<VaultUserListProps> = ({ onClose }) => {
    const { getVaultUserList, leaderAddVaultUser } = useCentralApi();
    const [vaultUserList, setVaultUserList] = useState<PublicUser[]>([]);
    const [selectedVaultInfo, setSelectedVaultInfo] = useState<number>(0);
    const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string;

    useEffect(() => {
        getVaultUserList()
            .then((res) => setVaultUserList(res))
            .catch((err) => console.error("Error fetching users:", err));
    }, []);

    const handleAdd = async (userId: string) => {
        try {
            await leaderAddVaultUser({ consortiumId, userId });
            onClose();
        } catch (error) {
            console.error("Error adding user:", error);
        }
    };

    return (
        <>
            <Box sx={{display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start'}}>
                <Box sx={{width: '50%', borderRight: '1px solid grey', padding: '0 1rem 1rem 0', height: '275px', overflow: 'scroll'}}>
                    <List>
                        {vaultUserList.map(({ id, username, vault}, index) => (
                            <React.Fragment key={id}>
                                <ListItem
                                    secondaryAction={
                                        <Box sx={{display: 'flex', flexDirection: 'row', gap: '0.5rem'}}>
                                        <Button
                                            variant="outlined"
                                            color="primary"
                                            size="small"
                                            onClick={() => setSelectedVaultInfo(index)}
                                        >
                                            Info
                                        </Button>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            size="small"
                                            onClick={() => handleAdd(id)}
                                        >
                                            Add
                                        </Button>
                                        </Box>
                                    }
                                >
                                    <ListItemText
                                        primary={username}
                                        secondary={vault?.name || "No Vault Assigned"}
                                        primaryTypographyProps={{ fontWeight: "bold" }}
                                    />
                                </ListItem>
                                <Divider component="li" />
                            </React.Fragment>
                        ))}
                    </List>
                </Box>
                <Box sx={{width: '50%', padding: '0 1rem 1rem 1rem', height: '275px', overflow: 'scroll'}}>
                    <h2 style={{color: 'black'}}>{vaultUserList[selectedVaultInfo]?.username}</h2>
                    <h3>{vaultUserList[selectedVaultInfo]?.vault?.name}</h3>
                    <div>{vaultUserList[selectedVaultInfo]?.vault?.description}</div>
                </Box>
            </Box>
        </>
    );
};

export default VaultUserList;
