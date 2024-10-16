import React, { useState } from "react";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import ComputationList from "./ComputationList";
import { useComputationSelect } from "./useComputationSelect";
import { useConsortiumDetailsContext } from "../../../ConsortiumDetailsContext";

export default function ComputationSelect() {
    const { computations, loading, error, selectComputation } = useComputationSelect();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { refetch } = useConsortiumDetailsContext();

    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleSelectComputation = async (computationId: string) => {
        await selectComputation(computationId);
        refetch(); // Refetch consortium details to update computation
        handleCloseModal(); // Close modal after selection
    };

    return (
        <div>
            <Button variant="outlined" color="primary" onClick={handleOpenModal} size="small">
                Change
            </Button>

            <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
                <DialogTitle>Select a Computation</DialogTitle>
                <DialogContent>
                    {loading && <p>Loading computations...</p>}
                    {error && <p style={{ color: "red" }}>{error}</p>}
                    {!loading && !error && (
                        <ComputationList computations={computations} onSelect={handleSelectComputation} />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseModal} color="secondary">
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
