import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Panel, Typography, Container } from '@maxhub/max-ui';
import './CollectionScreen.css';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import apiClient from '../api/apiClient';
import { triggerHapticNotification, triggerHapticImpact } from '../utils/hapticFeedback';
import { groupPhotosByDate } from '../utils/dateUtils';

function useFileInput() {
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  return { isMobile };
}

function useLongPress(onLongPress, onClick, { ms = 300 } = {}) {
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

function PhotoItem({ photo, onNavigate, onToggleSelection, isMobile, lookAtPhotoType, handleLongPress }) {
  const handleShortClick = () => {
    if (lookAtPhotoType) {
      onNavigate('viewing', { photoId: photo.id });
    } else {
      onToggleSelection(photo.id);
    }
  };

  const longPressEvents = useLongPress(
    () => {
      handleLongPress(photo);
    }, 
    handleShortClick,
    { ms: 500 }
  );

  const handleDesktopClick = (e) => {
    e.preventDefault();
    if (lookAtPhotoType) {
      onNavigate('viewing', { photoId: photo.id });
    } else {
      onToggleSelection(photo.id);
    }
  };

  const handleDesktopContextMenu = (e) => {
    e.preventDefault();
    handleLongPress(photo);
  };

  const desktopEvents = {
    onClick: handleDesktopClick,
    onContextMenu: handleDesktopContextMenu
  };

  return (
    <div
      className={`photo-item ${photo.selected ? 'selected' : ''} ${photo.borrowed ? 'borrowed' : ''} ${photo.is_imported ? 'imported' : ''}`}
      {...(isMobile ? longPressEvents : desktopEvents)}
    >
      <img src={photo.url} alt="" />
      {photo.selected && <div className="selection-indicator">✓</div>}
      {photo.is_imported && <div className="imported-indicator">📥</div>}
    </div>
  );
}

function CollectionScreen({ photos, onToggleSelection, onAddPhoto, onDeletePhotos, onNavigate, onLogout, scannedTrades, loadScannedTrades, pendingProfileRequests, onProfileRequestClick, onReloadPhotos }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [lookAtPhotoType, setlookAtPhotoType] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSharePhotoQR, setShowSharePhotoQR] = useState(false);
  const [handleQRScan, sethandleQRScan] = useState(false);
  const [photoToShareQR, setPhotoToShareQR] = useState('');
  const [sharePhotoCount, setSharePhotoCount] = useState(0);
  const { isMobile } = useFileInput();
  const [isPublicProfile, setIsPublicProfile] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [contactLink, setContactLink] = useState('');
  const [isSavingLink, setIsSavingLink] = useState(false);

  const [dragOver, setDragOver] = useState(false);
  const [inputKey, setInputKey] = useState(Date.now());
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [userIdInput, setUserIdInput] = useState('');
  
  const qrScannerRef = useRef(null);
  const processedScanResultRef = useRef(null);
  const isProcessingScanRef = useRef(false);

  // Load profile settings and user ID on mount
  useEffect(() => {
    loadProfileSettings();
    if (window.WebApp?.initDataUnsafe?.user?.id) {
      setCurrentUserId(window.WebApp?.initDataUnsafe?.user?.id);
    }
  }, []);

  const loadProfileSettings = async () => {
    try {
      const settings = await apiClient.getProfileSettings();
      setIsPublicProfile(settings.is_public_profile);
      setContactLink(settings.contact_link || '');
    } catch (error) {
      console.error('Failed to load profile settings:', error);
    }
  };

  const handleSaveContactLink = async () => {
    if (isSavingLink) return;
    
    setIsSavingLink(true);
    try {
      await apiClient.updateContactLink(contactLink);
      alert('Ссылка для связи сохранена!');
    } catch (error) {
      console.error('Failed to save contact link:', error);
      alert('Не удалось сохранить ссылку');
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleTogglePublicProfile = async () => {
    if (isTogglingPublic) return;
    
    const newValue = !isPublicProfile;
    const confirmMessage = newValue 
      ? 'Сделать профиль публичным? Все ваши фотографии станут доступны всем пользователям.'
      : 'Сделать профиль приватным? Все ваши фотографии станут приватными и будут удалены из коллекций других пользователей.';
    
    if (!confirm(confirmMessage)) return;
    
    setIsTogglingPublic(true);
    try {
      await apiClient.togglePublicProfile(newValue);
      setIsPublicProfile(newValue);
      setShowSettingsModal(false);
      alert(newValue ? 'Профиль теперь публичный!' : 'Профиль теперь приватный');
      // Reload photos to reflect changes
      if (onReloadPhotos) {
        onReloadPhotos();
      }
    } catch (error) {
      console.error('Failed to toggle public profile:', error);
      alert('Не удалось изменить настройки профиля');
    } finally {
      setIsTogglingPublic(false);
    }
  };

  const handleShareSelectedPhotos = async () => {
    const selectedPhotos = photos.filter(p => p.selected);
    if (selectedPhotos.length === 0) {
      alert('Выберите хотя бы одну фотографию для обмена');
      return;
    }

    try {
      const photoIds = selectedPhotos
        .filter(p => p.id && typeof p.id === 'number')
        .map(p => p.id);

      if (photoIds.length === 0) {
        alert('Не удалось найти фотографии для обмена');
        return;
      }

        const response = await apiClient.createShareTrades(photoIds);

      if (response && response.share_token) {
        const shareData = `trade:${response.share_token}`;
        setSharePhotoCount(response.trade_count);
        setPhotoToShareQR(shareData);
        setShowSharePhotoQR(true);

        triggerHapticNotification('success');
      } else {
        console.error('Invalid response from createShareTrades:', response);
        alert('Не удалось создать обмен');
      }
    } catch (error) {
      console.error('Error sharing photos:', error);
      alert(`Ошибка при создании QR-кода: ${error.message || 'Неизвестная ошибка'}`);
    }
  };

  const handleFileSelect = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    
    const imageFiles = Array.from(files)
      .filter(file => file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(file.name));

    if (imageFiles.length > 0) {
      onAddPhoto(imageFiles);
      setShowAddDialog(false);
      setInputKey(Date.now());
    } else {
      alert('Не удалось загрузить изображения. Выберите файлы изображений.');
    }
  };

const handleOpenQRScanner = useCallback(async () => {
  if (!window.WebApp) {
    console.error('MAX Bridge не доступен');
    setIsScanning(false);
    sethandleQRScan(false);
    return;
  }

  try {
    const result = await window.WebApp.openCodeReader();
    
    
    if (result !== null && result !== undefined) {
      let scanData;
      
      if (typeof result === 'object' && result.value) {
        scanData = result.value;
      } else if (typeof result === 'object') {
        scanData = result.data || result.text || result.code || JSON.stringify(result);
      } else {
        scanData = result;
      }
      
      setScanResult(scanData);
      triggerHapticNotification('success');
    } else {
      setScanResult(null);
    }
  } catch (error) {
    if (error && error.error && error.error.code) {
      const errorCode = error.error.code;
      
      if (errorCode.includes('not_supported')) {
        alert('На устройстве нет камеры');
      } else if (errorCode.includes('permission_denied')) {
        alert('Доступ к камере запрещен');
      } else if (errorCode.includes('cancelled')) {
        setScanResult(null);
      } else {
        alert('Ошибка сканирования: ' + errorCode);
      }
    } else if (error.code) {
      switch (error.code) {
        case 'client.open_code_reader.not_supported':
          alert('На устройстве нет камеры');
          break;
        case 'client.open_code_reader.permission_denied':
          alert('Доступ к камере запрещен');
          break;
        case 'client.open_code_reader.cancelled':
          setScanResult(null);
          break;
        default:
          alert('Ошибка сканирования: ' + error.code);
      }
    }
  } finally {
    setTimeout(() => {
      setIsScanning(false);
    }, 100);
  }
}, []);

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        onAddPhoto(imageFiles);
      }
    }
  };

  const handleCancelSelection = () => {
    const selectedPhotos = photos.filter(p => p.selected);
    selectedPhotos.forEach(p => {
      onToggleSelection(p.id);
    });
    setlookAtPhotoType(true);
  };

  const handleDeleteClick = () => {
    const selectedIds = photos.filter(p => p.selected).map(p => p.id);
    if (selectedIds.length > 0) {
      onDeletePhotos(selectedIds);
    }
  };

  const selectedCount = photos.filter(p => p.selected).length;

  const dragProps = isMobile ? {} : {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  const handleLongPress = useCallback((photo) => {
    if (lookAtPhotoType) {
      setlookAtPhotoType(false);
      onToggleSelection(photo.id);
      triggerHapticImpact('medium');
    } else {
      onToggleSelection(photo.id);
    }
  }, [lookAtPhotoType, onToggleSelection]);

  useEffect(() => {
    if (showQRScanner && !window.WebApp) {
      qrScannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 }
        },
        false
      );

      qrScannerRef.current.render(
        (decodedText) => {
          setScanResult(decodedText);
          setIsScanning(false); 
          
          qrScannerRef.current.clear();
        },
        (error) => {
          setIsScanning(false); 
        }
      );
    } else {
      if (qrScannerRef.current) {
        qrScannerRef.current.clear();
        qrScannerRef.current = null;
      }
    }

    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.clear();
      }
    };
  }, [showQRScanner]);

  useEffect(() => {
    if (window.WebApp) window.WebApp.ready();
    if (loadScannedTrades) {
      loadScannedTrades();

      const interval = setInterval(() => {
        loadScannedTrades();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [loadScannedTrades]);

  // Убран автоматический выход из режима выбора
  // Пользователь должен явно нажать "Отмена" для выхода
  // useEffect(() => {
  //   if (isMobile && selectedCount === 0 && !lookAtPhotoType) {
  //     setlookAtPhotoType(true);
  //   }
  // }, [selectedCount, lookAtPhotoType, isMobile]);


  const processTradeScan = async (tradeIds) => {
    try {
      if (!tradeIds || tradeIds.length === 0) {
        return;
      }


      const scannedTrades = [];

      for (const tradeId of tradeIds) {
        try {
          const scanResponse = await apiClient.scanTrade(tradeId);

          if (scanResponse) {
            scannedTrades.push(scanResponse);
          } else {
            console.error(`Failed to scan trade: ${tradeId}`);
          }

        } catch (error) {
          console.error(`Error scanning trade ${tradeId}:`, error);
        }
      }


      if (scannedTrades.length > 0) {
        loadScannedTrades();
      }

      return scannedTrades;

    } catch (error) {
      console.error('Error in processTradeScan:', error);
      alert('Ошибка при сканировании трейдов');
    }
  };

  const handleConfirmTrade = async (tradeId, accept) => {
    try {
      const response = accept
        ? await apiClient.confirmTrade(tradeId)
        : await apiClient.rejectTrade(tradeId);


      triggerHapticNotification('success');

      if (loadScannedTrades) {
        loadScannedTrades();
      }

    } catch (error) {
      console.error(`Error ${accept ? 'confirming' : 'rejecting'} trade ${tradeId}:`, error);
      alert('Ошибка при обработке трейда');
    }
  };

  useEffect(() => {
    if (!scanResult) return;
    
    // Проверяем, не обрабатывается ли уже этот scanResult
    if (isProcessingScanRef.current) {
      return;
    }
    
    // Проверяем, не обрабатывался ли уже этот scanResult
    if (processedScanResultRef.current === scanResult) {
      return;
    }

    const handleScannedData = async () => {
      // Помечаем, что начинаем обработку
      isProcessingScanRef.current = true;
      processedScanResultRef.current = scanResult;
      
      // Очищаем scanResult сразу, чтобы предотвратить повторные вызовы
      const currentScanResult = scanResult;
      setScanResult(null);
      
      try {
        sethandleQRScan(true);

        if (currentScanResult.startsWith('user:')) {
          const parts = currentScanResult.split(':');
          if (parts.length < 2) {
            alert('Неверный формат QR-кода');
            return;
          }

          const userId = parseInt(parts[1]);

          if (isNaN(userId)) {
            alert('Неверный ID пользователя');
            setShowQRScanner(false);
            setIsScanning(false);
            return;
          }

          const currentUserId = window.WebApp?.initDataUnsafe?.user?.id;
          if (userId === currentUserId) {
            alert('Нельзя отправить запрос самому себе');
            setShowQRScanner(false);
            setIsScanning(false);
            return;
          }

          onNavigate('profile_view', { userId });
          
          setShowQRScanner(false);
          setIsScanning(false);
        } else if (currentScanResult.startsWith('trade:')) {
          const parts = currentScanResult.split(':');
          if (parts.length < 2) {
            alert('Неверный формат QR-кода');
            setShowQRScanner(false);
            setIsScanning(false);
            return;
          }

          const shareToken = parts[1];

          try {
            const response = await apiClient.scanShareToken(shareToken);

            if (response && response.trade_count) {
              triggerHapticNotification('success');
              
              try {
                if (onReloadPhotos) {
                  await onReloadPhotos();
                }
                
                if (loadScannedTrades) {
                  await loadScannedTrades();
                }
                
                alert(`Получено ${response.trade_count} ${response.trade_count === 1 ? 'фото' : 'фотографий'}!`);
              } catch (reloadError) {
                console.error('Error reloading photos after scan:', reloadError);
                alert(`Получено ${response.trade_count} ${response.trade_count === 1 ? 'фото' : 'фотографий'}!`);
              }
            }
          } catch (error) {
            console.error("Error scanning share token:", error);
            const errorMessage = error.message || 'Ошибка при сканировании QR-кода';

            if (errorMessage.includes('already received') || errorMessage.includes('already have') || errorMessage.includes('уже')) {
              // Не показываем alert для уже полученных фотографий, просто обновляем данные
              if (onReloadPhotos) {
                try {
                  await onReloadPhotos();
                } catch (reloadError) {
                  // Ignore reload errors
                }
              }
              if (loadScannedTrades) {
                await loadScannedTrades();
              }
              // Убираем alert, так как фотографии уже были получены и обновлены
            } else if (errorMessage.includes('No pending trades found')) {
              alert('QR-код недействителен или уже был использован. Возможно, владелец отозвал предложение.');
            } else if (errorMessage.includes('cannot scan your own') || errorMessage.includes('your own trade')) {
              alert('Нельзя сканировать свой собственный QR-код для обмена фотографиями');
            } else {
              alert(errorMessage);
            }
          }

          setShowQRScanner(false);
          setIsScanning(false);
        } else {
          try {
            const data = JSON.parse(currentScanResult);
            if (data.photo_file_id) {
              const borrowedPhoto = {
                id: `borrowed-${Date.now()}`,
                file_id: data.photo_file_id,
                url: `${import.meta.env.VITE_API_URL || 'https://api.whitea.cloud'}/uploads/${data.photo_file_id}`,
                borrowed: true,
                selected: false,
                created_at: new Date().toISOString()
              };
              onAddPhoto([borrowedPhoto]);
              alert('Фото добавлено!');
            } else if (data.photo_file_ids && Array.isArray(data.photo_file_ids)) {
              const borrowedPhotos = data.photo_file_ids.map((fileId, index) => ({
                id: `borrowed-${Date.now()}-${index}`,
                file_id: fileId,
                url: `${import.meta.env.VITE_API_URL || 'https://api.whitea.cloud'}/uploads/${fileId}`,
                borrowed: true,
                selected: false,
                created_at: new Date().toISOString()
              }));
              onAddPhoto(borrowedPhotos);
              alert(`Добавлено ${data.photo_file_ids.length} фотографий!`);
            }
          } catch (e) {
            console.error('Error processing scanned data:', e);
          }
        }
      } catch (error) {
        console.error('Ошибка обработки QR-кода:', error);
      } finally {
        isProcessingScanRef.current = false;
        setTimeout(() => {
          sethandleQRScan(false);
          // Очищаем processedScanResultRef через некоторое время, чтобы можно было повторно отсканировать тот же QR-код через некоторое время
          setTimeout(() => {
            processedScanResultRef.current = null;
          }, 5000);
        }, 100);
      }
    };

    handleScannedData();
  }, [scanResult, onAddPhoto, onNavigate, onReloadPhotos, loadScannedTrades]);

  return (
    <div className="collection-screen">
      <Panel mode="primary" className="collection-header" style={{ overflow: 'visible' }}>
        <Container style={{ overflow: 'visible' }}>
          <div className="header-content">
            <Typography.Title level={2} className="header-title">Фото</Typography.Title>
            <div className="header-actions">
              <button className="icon-btn" onClick={() => setShowAddDialog(true)}>➕</button>
              <button className="icon-btn" onClick={() => setShowQRCode(true)}>🔍</button>
              {isMobile ? (
                <button
                  className="icon-btn"
                  onClick={async () => {
                    sethandleQRScan(true);
                    setIsScanning(true);
                    setScanResult(null);
                    processedScanResultRef.current = null;
                    isProcessingScanRef.current = false;
                    setShowQRScanner(true);
                    await handleOpenQRScanner();
                  }}
                  title="Сканировать QR-код"
                  disabled={isScanning}
                >
                  {isScanning ? '⏳' : '📷'}
                </button>
              ) : (
                <button
                  className="icon-btn"
                  onClick={() => {
                    setShowQRScanner(true);
                    setScanResult(null);
                    setUserIdInput('');
                    processedScanResultRef.current = null;
                    isProcessingScanRef.current = false;
                  }}
                  title="Ввести ID пользователя"
                >
                  👤
                </button>
              )}
              {!isMobile && (
                <button className="icon-btn" onClick={() => {
                  if (!lookAtPhotoType) {
                    // When exiting selection mode, clear all selections
                    handleCancelSelection();
                  } else {
                    setlookAtPhotoType(false);
                  }
                }} title="Режим выбора">
                  {!lookAtPhotoType ? '✅' : '⬜️'}
                </button>
              )}
              <button className="icon-btn" onClick={() => setShowSettingsModal(true)} title="Настройки">
                ⋮
              </button>
            </div>
          </div>
          <div className="header-date">{new Date().toLocaleDateString('ru-RU')}</div>
          {isPublicProfile && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              backgroundColor: '#dcfce7',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '16px' }}>🌐</span>
              <Typography.Body size="s" style={{ color: '#166534', fontWeight: 'bold' }}>
                Публичный профиль
              </Typography.Body>
            </div>
          )}
        </Container>
      </Panel>

      {!lookAtPhotoType && (
        <Panel mode="secondary" className="selection-toolbar">
          <Container>
            <div className="toolbar-content">
              <Typography.Body>Выбрано: {selectedCount}</Typography.Body>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedCount > 0 && (
                  <>
                    <Button size="s" mode="primary" onClick={handleShareSelectedPhotos}>Поделиться</Button>
                    <Button size="s" mode="destructive" onClick={handleDeleteClick}>Удалить</Button>
                  </>
                )}
                <Button size="s" mode="secondary" onClick={handleCancelSelection}>Отмена</Button>
              </div>
            </div>
          </Container>
        </Panel>
      )}

      {pendingProfileRequests && pendingProfileRequests.length > 0 && (
        <Panel mode="secondary" className="pending-transfers-panel">
          <Container>
            <Typography.Title level={4}>
              Запросы на просмотр профиля ({pendingProfileRequests.length})
            </Typography.Title>
            <div className="pending-transfers-list">
              {pendingProfileRequests.map((request) => (
                <div key={request.id} className="pending-transfer-card" style={{ cursor: 'pointer' }}>
                  <div className="pending-transfer-image-container" onClick={() => onProfileRequestClick(request)}>
                    <div className="pending-overlay">
                      <Typography.Body size="s" className="pending-label">
                        {request.first_name} {request.last_name || ''} запрашивает доступ
                      </Typography.Body>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </Panel>
      )}

      {scannedTrades && scannedTrades.length > 0 && (
        <Panel mode="secondary" className="pending-transfers-panel">
          <Container>
            <Typography.Title level={4}>
              Ожидают подтверждения ({scannedTrades.length})
            </Typography.Title>
            <div className="pending-transfers-list">
              {scannedTrades.slice(0, 3).map((trade) => (
                <div key={trade.trade_id} className="pending-transfer-card">
                  <div className="pending-transfer-image-container">
                    <img
                      src={`${import.meta.env.VITE_API_URL || 'https://api.whitea.cloud'}/uploads/${trade.file_id}`}
                      alt="Pending"
                      className="pending-transfer-image blurred"
                    />
                    <div className="pending-overlay">
                      <Typography.Body size="s" className="pending-label">Ожидает подтверждения</Typography.Body>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '12px' }}>
              <Button
                mode="primary"
                onClick={() => onNavigate('approval')}
              >
                Просмотреть все ({scannedTrades.length})
              </Button>
            </div>
          </Container>
        </Panel>
      )}

      {photos.length > 0 ? (
        <div className={`photo-grid-container ${dragOver ? 'drag-over' : ''}`} {...dragProps}>
          {groupPhotosByDate(photos).map((group) => (
            <div key={group.dateKey} className="photo-date-group">
              <div className="date-separator">
                <Typography.Title level={4} className="date-label">
                  {group.dateLabel}
                </Typography.Title>
              </div>
              <div className="photo-grid">
                {group.photos.map((photo) => (
                  <PhotoItem
                    key={photo.id}
                    photo={photo}
                    onNavigate={onNavigate}
                    onToggleSelection={onToggleSelection}
                    isMobile={isMobile}
                    lookAtPhotoType={lookAtPhotoType}
                    handleLongPress={handleLongPress}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-container">
          <div>
            <img src="../img/pls_load_photo.png" alt="Загрузите фото" /><br/>
            <Typography.Body>Загрузите фото</Typography.Body>
          </div>
        </div>
      )}

      <Panel mode="tertiary" className="bottom-nav">
        <Container>
          <div className="nav-items">
            <button className="nav-item active" onClick={() => onNavigate('collection')}>
              <span className="nav-icon">📷</span><span className="nav-label">Коллекция</span>
            </button>
            <button className="nav-item" onClick={() => onNavigate('public_feed')}>
              <span className="nav-icon">🌐</span><span className="nav-label">Лента</span>
            </button>
            <button className="nav-item" onClick={() => onNavigate('permissions')}>
              <span className="nav-icon">🔐</span><span className="nav-label">Разрешения</span>
            </button>
          </div>
        </Container>
      </Panel>

      {showAddDialog && (
        <div className="modal-overlay" onClick={() => setShowAddDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Typography.Title level={3}>Добавить фотографии</Typography.Title>
            {isMobile ? (
              <>
                <label className="file-input-label">
                  <input
                    key={`camera-${inputKey}`}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    onInput={handleFileSelect}
                    className="file-input"
                    capture="environment"
                  />
                  <div className="file-input-button">📸 Сделать фото</div>
                </label>
                <label className="file-input-label" style={{ marginTop: '12px' }}>
                  <input
                    key={`gallery-${inputKey}`}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    onInput={handleFileSelect}
                    className="file-input"
                  />
                  <div className="file-input-button">🖼️ Выбрать из галереи</div>
                </label>
              </>
            ) : (
              <label className="file-input-label">
                <input
                  key={`desktop-${inputKey}`}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  onInput={handleFileSelect}
                  className="file-input"
                />
                <div className="file-input-button">📁 Выбрать файлы</div>
              </label>
            )}
            <div className="modal-actions">
              <Button mode="secondary" onClick={() => setShowAddDialog(false)}>Отмена</Button>
            </div>
          </div>
        </div>
      )}

      {showQRScanner && (
        <div className="modal-overlay" onClick={() => {
          if (!isScanning) {
            setShowQRScanner(false);
            processedScanResultRef.current = null;
            isProcessingScanRef.current = false;
          }
        }}>
          <div className="modal-content qr-scanner-modal" onClick={(e) => e.stopPropagation()}>
            <Typography.Title level={3}>
              {isScanning ? 'Сканирование...' : scanResult ? 'Результат сканирования' : isMobile ? 'Сканировать QR или ввести ID' : 'Введите ID пользователя'}
            </Typography.Title>
            
            <div className="qr-scanner-section">
              {isScanning ? (
                <>
                  <Typography.Body className="qr-scanner-hint">
                    Наведите камеру на QR-код
                  </Typography.Body>
                  
                  {!window.WebApp && (
                    <div id="qr-reader" className="qr-scanner-container"></div>
                  )}
                  
                  {window.WebApp && (
                    <div className="qr-scanner-loading">
                      <div className="loading-spinner"></div>
                      <Typography.Body size="s">
                        Используется системный сканер MAX...
                      </Typography.Body>
                    </div>
                  )}
                </>
              ) : scanResult ? (
                <>
                  <div className="scan-success">
                    <Typography.Body className="success-text">
                      ✅ QR-код успешно отсканирован!
                    </Typography.Body>
                    <div className="scan-result">
                      <Typography.Body size="s" className="result-label">
                        Результат:
                      </Typography.Body>
                      <Typography.Body className="result-value">
                        {scanResult}
                      </Typography.Body>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <Typography.Body className="qr-scanner-hint" style={{ marginBottom: '12px' }}>
                      {isMobile ? 'Или введите ID пользователя:' : 'Введите ID пользователя:'}
                    </Typography.Body>
                    <input
                      type="number"
                      value={userIdInput}
                      onChange={(e) => setUserIdInput(e.target.value)}
                      placeholder="Введите ID пользователя"
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '16px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontFamily: 'monospace'
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && userIdInput.trim()) {
                          const userId = parseInt(userIdInput.trim());
                          if (!isNaN(userId) && userId > 0) {
                            const currentUserId = window.WebApp?.initDataUnsafe?.user?.id;
                            if (userId === currentUserId) {
                              alert('Нельзя отправить запрос самому себе');
                              return;
                            }
                            setScanResult(`user:${userId}`);
                            setUserIdInput('');
                          } else {
                            alert('Введите корректный ID пользователя');
                          }
                        }
                      }}
                    />
                    {userIdInput.trim() && (
                      <Button
                        mode="primary"
                        stretched
                        style={{ marginTop: '12px' }}
                        onClick={() => {
                          const userId = parseInt(userIdInput.trim());
                          if (!isNaN(userId) && userId > 0) {
                            const currentUserId = window.WebApp?.initDataUnsafe?.user?.id;
                            if (userId === currentUserId) {
                              alert('Нельзя отправить запрос самому себе');
                              return;
                            }
                            setScanResult(`user:${userId}`);
                            setUserIdInput('');
                          } else {
                            alert('Введите корректный ID пользователя');
                          }
                        }}
                      >
                        Открыть профиль
                      </Button>
                    )}
                  </div>
                  {isMobile && (
                    <Typography.Body className="scan-cancelled" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                      Или отсканируйте QR-код
                    </Typography.Body>
                  )}
                </>
              )}
            </div>

            <div className="modal-actions">
              <Button
                mode="secondary"
                onClick={() => {
                  setShowQRScanner(false);
                  setIsScanning(false);
                  setScanResult(null);
                  setUserIdInput('');
                  processedScanResultRef.current = null;
                  isProcessingScanRef.current = false;
                }}
                disabled={isScanning}
              >
                {isScanning ? 'Отмена' : 'Закрыть'}
              </Button>
              
              {!isScanning && !scanResult && isMobile && (
              <Button
                mode="primary"
                onClick={async () => {
                  setIsScanning(true);
                  setScanResult(null);
                  setUserIdInput('');
                  processedScanResultRef.current = null;
                  isProcessingScanRef.current = false;
                  await handleOpenQRScanner();
                }}
              >
                Сканировать QR
              </Button>
            )}
            </div>
          </div>
        </div>
      )}

      {showQRCode && (
        <div className="modal-overlay" onClick={() => setShowQRCode(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Typography.Title level={3}>Поделиться профилем</Typography.Title>
            <div className="qr-display-section">
              <QRCodeSVG value={`user:${window.WebApp.initDataUnsafe?.user?.id?.toString() || 'unknown'}`} size={256} />
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
                <Typography.Body size="s" style={{ color: '#666', marginBottom: '4px' }}>ID пользователя:</Typography.Body>
                <Typography.Title level={4} style={{ margin: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {window.WebApp.initDataUnsafe?.user?.id?.toString() || 'Неизвестно'}
                </Typography.Title>
              </div>
              <Typography.Body size="s" className="qr-hint" style={{ marginTop: '16px' }}>Отсканируйте QR-код или введите ID для запроса просмотра профиля</Typography.Body>
            </div>
            <div className="modal-actions">
              <Button mode="secondary" onClick={() => setShowQRCode(false)}>Закрыть</Button>
            </div>
          </div>
        </div>
      )}

      {showSharePhotoQR && (
        <div className="modal-overlay" onClick={() => setShowSharePhotoQR(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Typography.Title level={3}>
              Поделиться {sharePhotoCount > 1 ? `(${sharePhotoCount} фото)` : 'Фото'}
            </Typography.Title>
            
            {sharePhotoCount > 1 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center', maxHeight: '120px', overflow: 'hidden' }}>
                {photos.filter(p => p.selected).slice(0, 6).map(photo => (
                  <img 
                    key={photo.id} 
                    src={photo.url} 
                    alt="" 
                    style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                  />
                ))}
                {sharePhotoCount > 6 && (
                  <div style={{ 
                    width: '60px', 
                    height: '60px', 
                    background: '#e0e0e0', 
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#666'
                  }}>
                    +{sharePhotoCount - 6}
                  </div>
                )}
              </div>
            )}
            
            <div className="qr-display-section">
              {photoToShareQR ? (
                <>
                  <QRCodeSVG 
                    value={photoToShareQR} 
                    size={256}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                    includeMargin={true}
                  />
                  <Typography.Body size="s" className="qr-hint">
                    {sharePhotoCount > 1 
                      ? `Отсканируйте QR-код для получения ${sharePhotoCount} фотографий`
                      : 'Отсканируйте QR-код для получения фото'
                    }
                  </Typography.Body>
                </>
              ) : (
                <Typography.Body>Загрузка QR-кода...</Typography.Body>
              )}
            </div>
            <div className="modal-actions">
              <Button mode="secondary" onClick={() => setShowSharePhotoQR(false)}>Закрыть</Button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content settings-modal-content" onClick={(e) => e.stopPropagation()}>
            <Typography.Title level={3} style={{ marginBottom: '12px' }}>Настройки профиля</Typography.Title>
            
            <div style={{ 
              padding: '12px',
              backgroundColor: isPublicProfile ? '#dcfce7' : '#f3f4f6',
              borderRadius: '8px',
              marginTop: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '20px' }}>{isPublicProfile ? '🔓' : '🔒'}</span>
                <Typography.Title level={4} style={{ margin: 0, fontSize: '16px' }}>
                  {isPublicProfile ? 'Публичный профиль' : 'Приватный профиль'}
                </Typography.Title>
              </div>
              <Typography.Body size="xs" style={{ color: '#666', marginTop: '4px' }}>
                {isPublicProfile 
                  ? 'Все ваши фотографии доступны всем пользователям без запроса' 
                  : 'Фотографии доступны только с вашего разрешения'}
              </Typography.Body>
            </div>

            <div style={{ 
              marginTop: '12px',
              padding: '12px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              border: '1px solid #fbbf24'
            }}>
              <Typography.Body size="xs" style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                Ссылка для связи (отображается в профиле):
              </Typography.Body>
              <Typography.Body size="xs" style={{ color: '#666', marginBottom: '6px', fontSize: '11px' }}>
                Укажите ссылку на ваш Max, Telegram или другой мессенджер. По умолчанию показывается ваш ID.
              </Typography.Body>
              <div style={{ 
                display: 'flex', 
                gap: '6px',
                alignItems: 'center',
                marginTop: '6px'
              }}>
                <input
                  type="text"
                  placeholder={`По умолчанию: ID ${currentUserId}`}
                  value={contactLink}
                  onChange={(e) => setContactLink(e.target.value)}
                  maxLength={200}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px'
                  }}
                />
                <Button
                  mode="secondary"
                  size="s"
                  onClick={handleSaveContactLink}
                  disabled={isSavingLink}
                >
                  {isSavingLink ? '⏳' : '💾'}
                </Button>
              </div>
            </div>

            {isPublicProfile && currentUserId && (
              <div style={{ 
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #93c5fd'
              }}>
                <Typography.Body size="xs" style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  Ссылка на ваш профиль:
                </Typography.Body>
                <div style={{ 
                  display: 'flex', 
                  gap: '6px',
                  alignItems: 'center',
                  marginTop: '6px'
                }}>
                  <input
                    type="text"
                    readOnly
                    value={`${import.meta.env.VITE_PRODUCTION_PROTOCOL || 'https'}://${import.meta.env.VITE_PRODUCTION_DOMAIN || 'whitea.cloud'}/public/${currentUserId}`}
                    onClick={(e) => e.target.select()}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  />
                  <Button
                    mode="secondary"
                    size="s"
                    onClick={() => {
                      const link = `${import.meta.env.VITE_PRODUCTION_PROTOCOL || 'https'}://${import.meta.env.VITE_PRODUCTION_DOMAIN || 'whitea.cloud'}/public/${currentUserId}`;
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(link).then(() => {
                          alert('Ссылка скопирована в буфер обмена!');
                        }).catch((err) => {
                          console.error('Clipboard error:', err);
                          // Fallback method
                          const textArea = document.createElement('textarea');
                          textArea.value = link;
                          textArea.style.position = 'fixed';
                          textArea.style.left = '-999999px';
                          document.body.appendChild(textArea);
                          textArea.select();
                          try {
                            document.execCommand('copy');
                            alert('Ссылка скопирована!');
                          } catch (e) {
                            alert('Не удалось скопировать. Выделите текст вручную.');
                          }
                          document.body.removeChild(textArea);
                        });
                      } else {
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = link;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-999999px';
                        document.body.appendChild(textArea);
                        textArea.select();
                        try {
                          document.execCommand('copy');
                          alert('Ссылка скопирована!');
                        } catch (e) {
                          alert('Не удалось скопировать. Выделите текст вручную.');
                        }
                        document.body.removeChild(textArea);
                      }
                    }}
                  >
                    📋
                  </Button>
                </div>
                <Typography.Body size="xs" style={{ color: '#666', marginTop: '4px', fontSize: '11px' }}>
                  Поделитесь этой ссылкой, чтобы другие могли посмотреть ваши фотографии
                </Typography.Body>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '16px', gap: '8px' }}>
              <Button
                mode="primary"
                onClick={handleTogglePublicProfile}
                disabled={isTogglingPublic}
                style={{ flex: 1 }}
              >
                {isTogglingPublic ? 'Сохранение...' : (isPublicProfile ? 'Сделать приватным' : 'Сделать публичным')}
              </Button>
              <Button mode="secondary" onClick={() => setShowSettingsModal(false)}>
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollectionScreen;