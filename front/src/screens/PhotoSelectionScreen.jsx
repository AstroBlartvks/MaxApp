import { useState, useEffect } from 'react';
import { Button, Panel, Typography, Container } from '@maxhub/max-ui';
import './CollectionScreen.css';

function PhotoSelectionScreen({ photos, onNavigate, onConfirmSelection, requestInfo, editingPermission }) {
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Если редактируется разрешение, предварительно выбрать уже разрешенные фото
  useEffect(() => {
    if (editingPermission && editingPermission.selected_photo_ids) {
      setSelectedPhotos(new Set(editingPermission.selected_photo_ids));
    }
  }, [editingPermission]);

  const toggleSelection = (photoId, photo) => {
    if (isProcessing) return;
    // Запретить выбор импортированных фото
    if (photo?.is_imported) {
      alert('Нельзя предоставить доступ к импортированным фотографиям. Вы можете делиться только своими фото.');
      return;
    }
    
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  const handleConfirm = async () => {
    if (isProcessing) return;
    if (selectedPhotos.size === 0) {
      alert('Выберите хотя бы одну фотографию');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirmSelection(Array.from(selectedPhotos));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isProcessing) return;
    
    if (editingPermission) {
      // When canceling edit, just navigate back without making changes
      onNavigate('permissions');
    } else {
      // When rejecting a new profile request, actually reject it
      if (!requestInfo || !requestInfo.id) {
        onNavigate('collection');
        return;
      }
      
      setIsProcessing(true);
      try {
        // Import apiClient
        const apiClient = (await import('../api/apiClient')).default;
        await apiClient.respondToProfileRequest(requestInfo.id, false, []);
        onNavigate('collection');
      } catch (error) {
        console.error('Error rejecting profile request:', error);
        // Still navigate back even if rejection fails
        onNavigate('collection');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="collection-screen">
      <Panel mode="primary" className="collection-header">
        <Container>
          <div className="header-content">
            <button className="icon-btn" onClick={() => onNavigate('collection')}>
              🔙
            </button>
            <Typography.Title level={2} className="header-title">
              {editingPermission ? 'Редактировать разрешение' : 'Выберите фотографии'}
            </Typography.Title>
          </div>
          {requestInfo && (
            <div className="header-subtitle">
              <Typography.Body size="s">
                {editingPermission 
                  ? `Редактирование разрешения для: ${requestInfo.first_name} ${requestInfo.last_name || ''}${requestInfo.username ? ` (@${requestInfo.username})` : ''}`
                  : `Запрос от: ${requestInfo.first_name} ${requestInfo.last_name || ''}${requestInfo.username ? ` (@${requestInfo.username})` : ''}`
                }
              </Typography.Body>
            </div>
          )}
        </Container>
      </Panel>

      <Panel mode="secondary" className="selection-toolbar">
        <Container>
          <div className="toolbar-content">
            <Typography.Body>Выбрано: {selectedPhotos.size}</Typography.Body>
          </div>
        </Container>
      </Panel>

      {photos.length > 0 ? (
        <div className="photo-grid-container">
          <div className="photo-grid">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className={`photo-item ${selectedPhotos.has(photo.id) ? 'selected' : ''} ${photo.is_imported ? 'disabled imported' : ''}`}
                onClick={() => toggleSelection(photo.id, photo)}
              >
                <img src={photo.url} alt="" />
                {selectedPhotos.has(photo.id) && <div className="selection-indicator">✓</div>}
                {photo.is_imported && (
                  <div className="disabled-overlay">
                    <span>📥</span>
                    <Typography.Body size="s" style={{ color: 'white', textAlign: 'center', marginTop: '4px' }}>
                      Импортировано
                    </Typography.Body>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-container">
          <Typography.Body>Нет фотографий для выбора</Typography.Body>
        </div>
      )}

      <Panel mode="tertiary" className="bottom-nav">
        <Container>
          <div className="nav-items">
            <button className="nav-item" onClick={handleConfirm} disabled={isProcessing}>
              <span className="nav-icon">✅</span>
              <span className="nav-label">{isProcessing ? 'Обработка...' : `Подтвердить (${selectedPhotos.size})`}</span>
            </button>
            <button className="nav-item" onClick={handleReject} disabled={isProcessing}>
              <span className="nav-icon">❌</span>
              <span className="nav-label">Отклонить</span>
            </button>
          </div>
        </Container>
      </Panel>
    </div>
  );
}

export default PhotoSelectionScreen;
