
import { useEffect } from 'react';
import { useAppStore } from '../app/store';

export const usePageTitle = (componentTitle: string) => {
    const globalTitle = useAppStore((state) => state.title);

    useEffect(() => {
        document.title = `${componentTitle || ''} - ${globalTitle}`;
    }, [globalTitle, componentTitle]);
};