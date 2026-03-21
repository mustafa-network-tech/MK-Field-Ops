import { useState, useCallback, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { SiteAccessModal } from '../components/SiteAccessModal';
import { isSiteAccessUnlocked } from '../services/siteAccessGate';

/**
 * Landing: Login / Register links open an access-code modal unless this tab already verified.
 * On success, navigates to the intended path (e.g. /login, /register?plan=starter).
 */
export function useSiteAccessAuthLinks() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState('');

  const onAuthLinkClick = useCallback((e: MouseEvent, path: string) => {
    if (isSiteAccessUnlocked()) return;
    e.preventDefault();
    setPendingPath(path);
    setModalOpen(true);
  }, []);

  const SiteAccessAuthModal = (
    <SiteAccessModal
      open={modalOpen}
      variant="dismissible"
      onClose={() => {
        setModalOpen(false);
        setPendingPath('');
      }}
      onVerified={() => {
        navigate(pendingPath || '/login');
        setModalOpen(false);
        setPendingPath('');
      }}
    />
  );

  return { onAuthLinkClick, SiteAccessAuthModal };
}
