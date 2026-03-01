import { NavLink, Route, Routes } from "react-router";
import StartView from "./StartView";
import MarsView from "./MarsView";

export default function App() {
    return (
        <>
            <nav className="fixed top-0 left-0 w-full z-50 bg-white/10 backdrop-blur-md border-b border-white/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">

                        <div className="flex-shrink-0 flex items-center">
                            <span className="text-white font-bold text-xl tracking-wider">MARS <span className="text-orange-500">3D</span></span>
                        </div>

                        <div className="hidden md:block">
                            <div className="ml-10 flex items-baseline space-x-4">
                                <NavLink to="/" className="text-white hover:bg-orange-500 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300">Home</NavLink>
                                <NavLink to="/mars" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Mars</NavLink>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
            <Routes>
                <Route path="/" element={<StartView />} />
                <Route path="/mars" element={<MarsView />} />
            </Routes>
        </>
    );
}
