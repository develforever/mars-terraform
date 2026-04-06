import { useEffect } from 'react';
import { useAppStore } from '../../app/store';

export const usePageTitle = (componentTitle: string) => {
    const globalTitle = useAppStore((state) => state.title);

    useEffect(() => {
        const prefix = componentTitle?.trim() || '';
        document.title = prefix 
            ? `${prefix} - ${globalTitle}` 
            : globalTitle;
    }, [globalTitle, componentTitle]);
};
