
import { useModalStore } from "./store";
import { useState } from "react";

export default function ModalManager() {

    const { isOpen, close, onOk, onCancel } = useModalStore();
    const [colonyName, setColonyName] = useState("");

    const handleOk = () => {
        if (!colonyName.trim()) return; // walidacja - nie pozwól na pustą nazwę
        onOk?.();
        close();
    };

    return (
        <>
            {/* Warstwa UI (Modal) */}
            {isOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-orange-500/50 p-8 rounded-2xl shadow-2xl w-full text-center">
                        <h2 className="text-2xl font-bold text-white mb-6 uppercase tracking-wider">
                            Eksploracja Marsa
                        </h2>

                        <div className="flex flex-col gap-4">

                            <div>
                                <p className="text-gray-400">
                                    Wprowadź nazwę koloni i rozpocznij eksplorację Marsa.
                                </p>
                                <input 
                                    type="text" 
                                    placeholder="Nazwa koloni" 
                                    value={colonyName}
                                    onChange={(e) => setColonyName(e.target.value)}
                                    className="w-full p-2 border border-gray-400 rounded-lg text-white bg-gray-800 mt-2" 
                                />
                            </div>
                            <div className="flex justify-between">
                                <button
                                    onClick={handleOk}
                                    disabled={!colonyName.trim()}
                                    className="bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold transition-colors p-1"
                                >
                                    Rozpocznij Kolonizację
                                </button>

                                <button
                                    onClick={() => { onCancel?.(); close(); }}
                                    className="text-gray-400 hover:text-white transition-colors p-1"
                                >
                                    Powrót
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
