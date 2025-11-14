import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Panel, Typography, Container } from '@maxhub/max-ui';
import './CollectionScreen.css';
import apiClient from '../api/apiClient';
import { triggerHapticNotification, triggerHapticImpact } from '../utils/hapticFeedback';
import { groupPhotosByDate } from '../utils/dateUtils';

function useFileInput() {
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  return { isMobile };
}

function useLongPress(onLongPress, onClick, { ms = 500 } = {}) {
  const timer = useRef();
  const isLongPress = useRef(false);
  const moved = useRef(false);

  const start = (e) => {
    e.preventDefault();
    isLongPress.current = false;
    moved.current = false;
    
    timer.current = setTimeout(() => {
      if (!moved.current) {
        onLongPress(e);
        isLongPress.current = true;
      }
    }, ms);
  };

  const stop = (e) => {
    e.preventDefault();
    clearTimeout(timer.current);
    
    if (!isLongPress.current && !moved.current) {
      onClick(e);
    }
    
    isLongPress.current = false;
    moved.current = false;
  };

  const cancel = (e) => {
    e.preventDefault();
    clearTimeout(timer.current);
    moved.current = true;
    isLongPress.current = false;
  };

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchMove: cancel, 
    onTouchCancel: cancel,
  };
}

function ProfilePhotoItem({ photo, isSelected, isImported, isMobile, selectionMode, onPhotoClick, onLongPress }) {
  const handleShortClick = () => {
    onPhotoClick(photo);
  };

  const longPressEvents = useLongPress(
    () => onLongPress(photo),
    handleShortClick,
    { ms: 500 }
  );

  const handleDesktopClick = (e) => {
    e.preventDefault();
    onPhotoClick(photo);
  };

  const handleDesktopContextMenu = (e) => {
    e.preventDefault();
    onLongPress(photo);
  };

  const desktopEvents = {
    onClick: handleDesktopClick,
    onContextMenu: handleDesktopContextMenu
  };

  return (
    <div
      className={`photo-item ${isSelected ? 'selected' : ''} ${isImported ? 'imported' : ''}`}
      {...(isMobile ? longPressEvents : desktopEvents)}
    >
      <img src={photo.url} alt="" />
      {isSelected && (
        <div className="selection-indicator">✓</div>
      )}
      {isImported && (
        <div className="imported-indicator">📥</div>
      )}
    </div>
  );
}

function ProfileViewScreen({ userId, userInfo, onNavigate, onRequestSent, refreshTrigger }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [displayUserInfo, setDisplayUserInfo] = useState(userInfo);
  const [hasExistingRequest, setHasExistingRequest] = useState(false);
  const [approvedPhotos, setApprovedPhotos] = useState([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [showRequestSentMessage, setShowRequestSentMessage] = useState(false);
  const [showApprovedMessage, setShowApprovedMessage] = useState(false);
  const [importedPhotoIds, setImportedPhotoIds] = useState(new Set());
  const { isMobile } = useFileInput();

  useEffect(() => {
    if (userId) {
      setRequestSent(false);
      setRequestStatus(null);
      setApprovedPhotos([]);
      setShowRequestSentMessage(false);
      setShowApprovedMessage(false);
      
      if (!displayUserInfo) {
        setIsLoading(true);
        apiClient.getUserInfo(userId)
          .then((info) => {
            setDisplayUserInfo(info);
            setIsLoading(false);
          })
          .catch((error) => {
            console.error('Failed to load user info:', error);
            setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [userId]);
  
  useEffect(() => {
    if (userInfo) {
      setDisplayUserInfo(userInfo);
    }
  }, [userInfo]);

  const loadApprovedPhotos = useCallback(() => {
    if (userId) {
      setIsLoadingPhotos(true);
      
      Promise.all([
        apiClient.getUserApprovedPhotos(userId),
        apiClient.getImportedPhotoIds()
      ])
        .then(([photos, importedIds]) => {
          setApprovedPhotos(photos || []);
          setImportedPhotoIds(new Set(importedIds || []));
          setIsLoadingPhotos(false);
        })
        .catch((error) => {
          console.error('Failed to load approved photos:', error);
          setApprovedPhotos([]);
          setImportedPhotoIds(new Set());
          setIsLoadingPhotos(false);
        });
    }
  }, [userId]);

  const checkSessionApproval = useCallback((targetUserId) => {
    if (!targetUserId) return false;
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
    
    try {
      const storageKey = `approved_profile_${targetUserId}`;
      const approvalData = localStorage.getItem(storageKey);
      if (approvalData) {
        try {
          const data = JSON.parse(approvalData);
          return data.approved === true;
        } catch (e) {
          return false;
        }
      }
    } catch (e) {
      return false;
    }
    return false;
  }, []);

  const saveSessionApproval = useCallback((targetUserId) => {
    if (!targetUserId) return;
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    
    try {
      const storageKey = `approved_profile_${targetUserId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        approved: true,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  const loadRequestStatus = useCallback(() => {
    if (!userId) {
      setIsLoadingStatus(false);
      setRequestSent(false);
      setApprovedPhotos([]);
      return;
    }
    
    setIsLoadingStatus(true);
    loadApprovedPhotos();
    
    const hasSessionApproval = checkSessionApproval(userId);
    
    apiClient.getRequestStatus(userId)
      .then((status) => {
        setRequestStatus(status);
        setIsLoadingStatus(false);
        
        if (status && status.has_request && status.status === 'approved') {
          if (!hasSessionApproval) {
            saveSessionApproval(userId);
          }
          setRequestSent(true);
          loadApprovedPhotos();
        } else {
          if (hasSessionApproval) {
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
              try {
                const storageKey = `approved_profile_${userId}`;
                localStorage.removeItem(storageKey);
              } catch (e) {
                // Ignore localStorage errors
              }
            }
          }
          
          if (status && status.has_request) {
            if (status.status === 'pending') {
              setRequestSent(true);
              setHasExistingRequest(false);
            } else {
              setRequestSent(false);
            }
          } else {
            setRequestSent(false);
          }
        }
      })
      .catch((error) => {
        console.error('Failed to load request status:', error);
        setRequestStatus(null);
        setIsLoadingStatus(false);
        setRequestSent(false);
      });
  }, [userId, loadApprovedPhotos, checkSessionApproval, saveSessionApproval]);

  useEffect(() => {
    // Загрузить статус только если userId установлен
    if (userId) {
      loadRequestStatus();
    } else {
      // Если userId не установлен, сбросить состояние
      setIsLoadingStatus(false);
      setRequestSent(false);
      setRequestStatus(null);
      setApprovedPhotos([]);
    }
  }, [userId, loadRequestStatus]);

  useEffect(() => {
    if (refreshTrigger && userId) {
      saveSessionApproval(userId);
      setShowApprovedMessage(true);
      setShowRequestSentMessage(false);
      
      const timeoutId = setTimeout(() => {
        setShowApprovedMessage(false);
      }, 3000);
      
      loadRequestStatus();
      
      return () => clearTimeout(timeoutId);
    }
  }, [refreshTrigger, loadRequestStatus, userId, saveSessionApproval]);

  const togglePhotoSelection = useCallback((photoId) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
    triggerHapticImpact('light');
  }, []);

  const handleLongPress = useCallback((photo) => {
    if (!selectionMode) {
      setSelectionMode(true);
      togglePhotoSelection(photo.id);
      triggerHapticImpact('medium');
    } else {
      togglePhotoSelection(photo.id);
    }
  }, [selectionMode, togglePhotoSelection]);

  const handlePhotoClick = useCallback((photo) => {
    if (selectionMode) {
      togglePhotoSelection(photo.id);
    } else {
      // Открыть фотографию для просмотра
      onNavigate('viewing', { 
        photoId: photo.id, 
        approvedPhotos: approvedPhotos,
        profileUserId: userId 
      });
    }
  }, [selectionMode, togglePhotoSelection, onNavigate, approvedPhotos, userId]);

  const handleRequestSelectedPhotos = async () => {
    if (selectedPhotos.size === 0) {
      alert('Выберите хотя бы одну фотографию');
      return;
    }

    if (!userId) {
      alert('ID пользователя не указан');
      return;
    }

    setIsRequesting(true);
    try {
      const response = await apiClient.createProfileRequest(userId);
      
      setRequestSent(true);
      setHasExistingRequest(false);
      setSelectionMode(false);
      setSelectedPhotos(new Set());
      setShowRequestSentMessage(true);
      setShowApprovedMessage(false);
      triggerHapticNotification('success');
      
      loadRequestStatus();
      
      if (window.WebApp && window.WebApp.showPopup) {
        window.WebApp.showPopup({
          title: "Запрос отправлен",
          message: `Запрос на просмотр ${selectedPhotos.size} ${selectedPhotos.size === 1 ? 'фотографии' : 'фотографий'} отправлен. Ожидайте ответа.`,
          buttons: [{type: "ok"}]
        });
      }

      if (onRequestSent) {
        onRequestSent(response);
      }
      
      setTimeout(() => {
        setShowRequestSentMessage(false);
      }, 3000);
    } catch (error) {
      console.error('Error creating profile request:', error);
      const errorMessage = error.message || 'Ошибка при отправке запроса';
      
      if (errorMessage.includes('already have a pending request') || errorMessage.includes('already')) {
        setHasExistingRequest(true);
        setRequestSent(true);
        setShowRequestSentMessage(true);
        if (window.WebApp && window.WebApp.showPopup) {
          window.WebApp.showPopup({
            title: "Запрос уже отправлен",
            message: "У вас уже есть активный запрос на просмотр профиля этого пользователя.",
            buttons: [{type: "ok"}]
          });
        }
      } else {
        alert(errorMessage);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSendRequest = async () => {
    if (!userId) {
      alert('ID пользователя не указан');
      return;
    }

    setIsRequesting(true);
    try {
      const response = await apiClient.createProfileRequest(userId);
      
      setRequestSent(true);
      setHasExistingRequest(false);
      setShowRequestSentMessage(true);
      setShowApprovedMessage(false);
      triggerHapticNotification('success');
      
      loadRequestStatus();
      
      if (window.WebApp && window.WebApp.showPopup) {
        window.WebApp.showPopup({
          title: "Запрос отправлен",
          message: "Запрос на просмотр профиля отправлен. Ожидайте ответа.",
          buttons: [{type: "ok"}]
        });
      }

      if (onRequestSent) {
        onRequestSent(response);
      }
      
      setTimeout(() => {
        setShowRequestSentMessage(false);
      }, 3000);
    } catch (error) {
      console.error('Error creating profile request:', error);
      const errorMessage = error.message || 'Ошибка при отправке запроса';
      
      // Проверка на существующий запрос
      if (errorMessage.includes('already have a pending request') || errorMessage.includes('already')) {
        setHasExistingRequest(true);
        setRequestSent(true);
        setShowRequestSentMessage(true);
        if (window.WebApp && window.WebApp.showPopup) {
          window.WebApp.showPopup({
            title: "Запрос уже отправлен",
            message: "У вас уже есть активный запрос на просмотр профиля этого пользователя.",
            buttons: [{type: "ok"}]
          });
        }
      } else {
        alert(errorMessage);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  if (!displayUserInfo) {
    return (
      <div className="collection-screen">
        <Panel mode="primary" className="collection-header">
          <Container>
            <div className="header-content">
              <button className="icon-btn" onClick={() => onNavigate('collection')}>
                🔙
              </button>
              <Typography.Title level={2} className="header-title">
                Профиль пользователя
              </Typography.Title>
            </div>
          </Container>
        </Panel>
        <div className="empty-container">
          <Typography.Body>Информация о пользователе не найдена</Typography.Body>
        </div>
      </div>
    );
  }

  return (
    <div className="collection-screen" style={{ paddingBottom: '180px' }}>
      <Panel mode="primary" className="collection-header">
        <Container>
          <div className="header-content">
            <button className="icon-btn" onClick={() => onNavigate('collection')}>
              🔙
            </button>
            <Typography.Title level={2} className="header-title">
              Профиль
            </Typography.Title>
          </div>
        </Container>
      </Panel>

      <Panel mode="secondary" style={{ padding: '20px 0', marginBottom: '16px' }}>
        <Container>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '12px'
          }}>
            {displayUserInfo.photo_url ? (
              <img 
                src={displayUserInfo.photo_url} 
                alt="Profile" 
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #667eea'
                }}
              />
            ) : (
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                backgroundColor: '#e0e0e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px'
              }}>
                👤
              </div>
            )}
            
            <div style={{ textAlign: 'center' }}>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {displayUserInfo.first_name} {displayUserInfo.last_name || ''}
              </Typography.Title>
              {displayUserInfo.username && (
                <Typography.Body size="s" style={{ color: '#666', marginTop: '4px' }}>
                  @{displayUserInfo.username}
                </Typography.Body>
              )}
              {displayUserInfo.is_public_profile && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  backgroundColor: '#dcfce7',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '16px' }}>🌐</span>
                  <Typography.Body size="s" style={{ color: '#166534', fontWeight: 'bold' }}>
                    Публичный профиль
                  </Typography.Body>
                </div>
              )}
            </div>
          </div>
        </Container>
      </Panel>

      {approvedPhotos.length > 0 && (
        <Panel mode="secondary" style={{ marginBottom: '16px' }}>
          <Container>
            <div style={{ marginBottom: '12px' }}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                Доступные фотографии ({approvedPhotos.length})
              </Typography.Title>
            </div>
            
            <div className="photo-grid-container">
              {groupPhotosByDate(approvedPhotos).map((group) => (
                <div key={group.dateKey} className="photo-date-group">
                  <div className="date-separator">
                    <Typography.Title level={4} className="date-label">
                      {group.dateLabel}
                    </Typography.Title>
                  </div>
                  <div className="photo-grid">
                    {group.photos.map((photo) => (
                      <ProfilePhotoItem
                        key={photo.id}
                        photo={photo}
                        isSelected={selectedPhotos.has(photo.id)}
                        isImported={importedPhotoIds.has(photo.id)}
                        isMobile={isMobile}
                        selectionMode={selectionMode}
                        onPhotoClick={handlePhotoClick}
                        onLongPress={handleLongPress}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </Panel>
      )}

      {isLoadingStatus || isLoadingPhotos ? (
        <div className="empty-container">
          <Typography.Body>Загрузка...</Typography.Body>
        </div>
      ) : approvedPhotos.length === 0 && requestSent && !selectionMode && displayUserInfo && (
        <div className="empty-container" style={{ padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📷</div>
          <Typography.Body style={{ textAlign: 'center', color: '#666' }}>
            {requestStatus && requestStatus.status === 'pending'
              ? 'Запрос отправлен. После одобрения здесь появятся фотографии пользователя.'
              : requestStatus && requestStatus.status === 'approved'
              ? 'Нет доступных фотографий.'
              : 'Фотографии пользователя будут доступны после одобрения запроса на просмотр профиля.'}
          </Typography.Body>
        </div>
      )}

      {selectionMode && (
        <Panel mode="secondary" style={{ position: 'fixed', bottom: selectedPhotos.size > 0 ? '80px' : 0, left: 0, right: 0, zIndex: 99 }}>
          <Container>
            <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography.Body size="s">
                Выбрано: {selectedPhotos.size}
              </Typography.Body>
              <Button
                size="s"
                mode="secondary"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedPhotos(new Set());
                }}
              >
                Отмена
              </Button>
            </div>
          </Container>
        </Panel>
      )}

      {selectionMode && selectedPhotos.size > 0 && (
        <Panel mode="tertiary" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, maxHeight: 'auto' }}>
          <Container>
            <div style={{ padding: '16px 0' }}>
              <Button
                mode="primary"
                size="l"
                stretched
                onClick={handleRequestSelectedPhotos}
                disabled={isRequesting}
              >
                {isRequesting ? 'Отправка...' : `Запросить просмотр (${selectedPhotos.size})`}
              </Button>
            </div>
          </Container>
        </Panel>
      )}

      {(() => {
        const isPublicProfile = displayUserInfo?.is_public_profile;
        return !requestSent && !selectionMode && !isLoadingStatus && displayUserInfo && userId && !isPublicProfile;
      })() && (
        <Panel mode="tertiary" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}>
          <Container>
            <div style={{ padding: '20px 0', maxHeight: 'none' }}>
              <Button
                mode="primary"
                size="l"
                stretched
                onClick={handleSendRequest}
                disabled={isRequesting || isLoading || !userId}
                style={{ marginBottom: '16px' }}
              >
                {isRequesting ? 'Отправка...' : 'Запросить просмотр профиля'}
              </Button>
              <Typography.Body size="s" style={{ textAlign: 'center', color: '#666', padding: '0 8px', lineHeight: '1.5' }}>
                Пользователь выберет фотографии для просмотра после одобрения запроса
              </Typography.Body>
            </div>
          </Container>
        </Panel>
      )}

      {showRequestSentMessage && (
        <div style={{ 
          position: 'fixed', 
          top: '70px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          zIndex: 999,
          width: '90%',
          maxWidth: '400px',
          pointerEvents: 'none',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <Panel mode="tertiary" style={{ 
            backgroundColor: '#e8f5e9',
            border: '1px solid #4caf50',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            <Container>
              <div style={{ padding: '12px 16px', textAlign: 'center' }}>
                <Typography.Body style={{ color: '#2e7d32', fontWeight: '500' }}>
                  ✅ {hasExistingRequest ? 'Запрос уже был отправлен ранее.' : 'Запрос отправлен. Ожидайте ответа.'}
                </Typography.Body>
              </div>
            </Container>
          </Panel>
        </div>
      )}

      {showApprovedMessage && (
        <div style={{ 
          position: 'fixed', 
          top: '70px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          zIndex: 999,
          width: '90%',
          maxWidth: '400px',
          pointerEvents: 'none',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <Panel mode="tertiary" style={{ 
            backgroundColor: '#e8f5e9',
            border: '1px solid #4caf50',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            <Container>
              <div style={{ padding: '12px 16px', textAlign: 'center' }}>
                <Typography.Body style={{ color: '#2e7d32', fontWeight: '500' }}>
                  ✅ Запрос одобрен! Фотографии доступны для просмотра.
                </Typography.Body>
              </div>
            </Container>
          </Panel>
        </div>
      )}
    </div>
  );
}

export default ProfileViewScreen;
