import { Route, Routes } from "react-router";
import StartView from "../presentation/pages/StartView";
import MarsView from "../presentation/pages/MarsView";
import TopMenu from "../presentation/components/ui/TopMenu";
import ModalManager from "../presentation/components/ui/ModalManager";

export default function App() {


    return (
        <>
            <TopMenu />
            <div className="mars-root">
                <Routes>
                    <Route path="/" element={<StartView />} />
                    <Route path="/mars" element={<MarsView />} />
                </Routes>
            </div>
            <ModalManager />
        </>
    );
}
