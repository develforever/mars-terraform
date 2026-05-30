import { useEffect, useRef, useState } from "react";

interface BuildingTooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
}

export function BuildingTooltip({ children, content }: BuildingTooltipProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [isDisabled, setIsDisabled] = useState(false);
    const [visible, setVisible] = useState(false);
    const [positionClass, setPositionClass] = useState<"above" | "below">("above");

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const button = wrapper.querySelector("button");
        if (button) {
            setIsDisabled(button.disabled);
            const observer = new MutationObserver(() => {
                setIsDisabled(button.disabled);
            });
            observer.observe(button, { attributes: true, attributeFilter: ["disabled"] });
            return () => observer.disconnect();
        }
    }, []);

    const showTooltip = () => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        setPositionClass(rect.top < 200 ? "below" : "above");
        setVisible(true);
    };

    const hideTooltip = () => setVisible(false);

    return (
        <div
            ref={wrapperRef}
            className="tooltip-wrapper"
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
        >
            {children}
            {isDisabled && <span className="tooltip-overlay" aria-hidden="true" />}
            {visible && (
                <div className={`tooltip-panel tooltip-panel--${positionClass}`}>
                    {content}
                </div>
            )}
        </div>
    );
}
