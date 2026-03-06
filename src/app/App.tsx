import { Route, Routes } from "react-router";
import StartView from "./start/StartView";
import MarsView from "./mars3d/MarsView";
import TopMenu from "../ui/TopMenu";
import ModalManager from "../ui/ModalManager/ModalManager";

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
