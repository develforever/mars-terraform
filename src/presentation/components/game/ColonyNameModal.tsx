import { useState } from "react";
import { useNavigate } from "react-router";
import { useGameStore } from "../../../application/store/useGameStore";

interface ColonyNameModalProps {
    onConfirm: () => void;
    onCancel: () => void;
}

export function ColonyNameModal({ onConfirm, onCancel }: ColonyNameModalProps) {
    const [colonyName, setColonyName] = useState("");
    const navigate = useNavigate();
    const setGameColonyName = useGameStore((state: { setColonyName: (name: string) => void }) => state.setColonyName);

    const handleConfirm = () => {
        if (!colonyName.trim()) return;
        setGameColonyName(colonyName.trim());
        onConfirm();
        navigate("/mars");
    };

    const handleCancel = () => {
        onCancel();
    };

    return (
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
                        onClick={handleConfirm}
                        disabled={!colonyName.trim()}
                        className="bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold transition-colors p-1"
                    >
                        Rozpocznij Kolonizację
                    </button>

                    <button
                        onClick={handleCancel}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                        Powrót
                    </button>
                </div>
            </div>
        </div>
    );
}
