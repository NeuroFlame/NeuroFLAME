import {
    Route,
    Routes,
} from 'react-router-dom';
import { AppConfig } from './AppConfig/AppConfig';
import LoginPage from './LoginPage/LoginPage';
import HomePage from './HomePage/HomePage';
import ConsortiumListPage from './ConsortiumList/ConsortiumListPage';
import ConsortiumDetailsPage from './ConsortiumDetails/ConsortiumDetailsPage';
import ConsortiumCreatePage from './ConsortiumCreate/ConsortiumCreatePage';
import { RunDetails } from './RunDetails/RunDetails';
import { RunList } from './RunList/RunList';
import RunResults from './RunResults/RunResults';
import ComputationListPage from './ComputationList/ComputationListPage';
import ComputationDetailsPage from './ComputationDetails/ComputationDetailsPage';
import AdminPage from './Admin/AdminPage';
import ConsortiumWizard from './ConsortiumWizard/ConsortiumWizard';


export default function AppRoutes() {
    return (
        <Routes>
            <Route index path="/" element={<LoginPage />} />
            <Route index path="/home" element={<HomePage />} />
            <Route path="/consortium/create" element={<ConsortiumCreatePage />} />
            <Route path="/consortium/list" element={<ConsortiumListPage />} />
            <Route path="/consortium/details/:consortiumId" element={<ConsortiumDetailsPage />} />
            <Route path="/consortium/wizard/:consortiumId/*" element={<ConsortiumWizard />} />
            <Route path="/computation/list" element={<ComputationListPage></ComputationListPage>} />
            <Route path="/computation/details/:computationId" element={<ComputationDetailsPage />} />
            <Route path="/run/list" element={<RunList />} />
            <Route path="/run/details/:runId" element={<RunDetails />} />
            <Route path="/run/results/:consortiumId/:runId" element={<RunResults />} />
            <Route path="/appConfig" element={<AppConfig />} />
            <Route path="/admin" element={<AdminPage />} />
        </Routes>
    )
}