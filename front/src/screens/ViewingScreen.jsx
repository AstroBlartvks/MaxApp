import { Button, Panel, Typography, Container, IconButton } from '@maxhub/max-ui';
import './ViewingScreen.css';
import { useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import apiClient from '../api/apiClient';

function ViewingScreen({ photos, onNavigate, onSelectPhoto, onDeletePhotos, viewingPhotoId, onSetViewedPhoto, profileUserId, onRequestPhoto, favoritePhotoIds, onFavoriteToggle }) {

  const [showQRCode, setShowQRCode] = useState(false);
  const [shareToken, setShareToken] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [metadata, setMetadata] = useState({ description: '', tags: [], is_public: false, can_edit: false, can_edit_public: false });
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStart === null || photos.length < 2) {
      return;
    }

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      const currentIndex = photos.findIndex(p => p.id === viewingPhotoId);
      if (currentIndex === -1) return;

      const numPhotos = photos.length;
      if (diff > 0) { 
        if (currentIndex < numPhotos - 1) { 
          onSetViewedPhoto(photos[currentIndex + 1].id);
        }
      } else { 
        if (currentIndex > 0) { 
          onSetViewedPhoto(photos[currentIndex - 1].id); 
        }
      }
    }

    setTouchStart(null);
  };

  const handlePreviewClick = (clickedPhotoId) => {
    if (onSetViewedPhoto) {
      onSetViewedPhoto(clickedPhotoId);
    }
  };

  const handleSharePhoto = async () => {
    const viewedPhoto = photos.find(p => p.id === viewingPhotoId);
    if (!viewedPhoto || !viewedPhoto.id || typeof viewedPhoto.id !== 'number') {
      alert('Не удалось найти фотографию для обмена');
      return;
    }

    try {
      const response = await apiClient.initiateTrade(viewedPhoto.id);

      if (response && response.share_token) {
        setShareToken(response.share_token);
        setShowQRCode(true);
      } else {
        alert('Не удалось создать обмен');
      }
    } catch (error) {
      console.error('Error initiating trade:', error);
      alert('Ошибка при создании QR-кода');
    }
  };

  const handleRequestPhoto = async () => {
    if (!viewingPhotoId) {
      alert('Фото не выбрано');
      return;
    }

    setIsRequesting(true);
    try {
      await apiClient.importPhoto(viewingPhotoId);
      alert('Фото добавлено в вашу коллекцию!');
      // Обновить коллекцию
      if (window.location) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error importing photo:', error);
      const errorMessage = error.message || 'Не удалось добавить фото';
      
      if (errorMessage.includes('already imported')) {
        alert('Это фото уже есть в вашей коллекции');
      } else if (errorMessage.includes('do not have permission')) {
        alert('У вас нет доступа к этому фото. Возможно, владелец отозвал разрешение.');
      } else {
        alert(`Ошибка: ${errorMessage}`);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const viewedPhotoFromCollection = photos.find(p => p.id === viewingPhotoId);

  const getPreviewPhotos = () => {
    const fileIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\w+$/i;

    if (typeof viewingPhotoId === 'string' && fileIdRegex.test(viewingPhotoId) && !viewedPhotoFromCollection) {
      return [];
    }

    const numPhotos = photos.length;
    if (numPhotos === 0) return [null, null, null, null, null];

    const currentIndex = photos.findIndex(p => p.id === viewingPhotoId);
    if (currentIndex === -1) {
      const p0 = numPhotos > 0 ? photos[0] : null;
      const p1 = numPhotos > 1 ? photos[1] : null;
      const p2 = numPhotos > 2 ? photos[2] : null;
      const p3 = numPhotos > 3 ? photos[3] : null;
      const p4 = numPhotos > 4 ? photos[4] : null;
      return [p0, p1, p2, p3, p4];
    }

    const p_minus_2 = currentIndex > 1 ? photos[currentIndex - 2] : null;
    const p_minus_1 = currentIndex > 0 ? photos[currentIndex - 1] : null;
    const p_0 = photos[currentIndex];
    const p_plus_1 = currentIndex < numPhotos - 1 ? photos[currentIndex + 1] : null;
    const p_plus_2 = currentIndex < numPhotos - 2 ? photos[currentIndex + 2] : null;

    return [p_minus_2, p_minus_1, p_0, p_plus_1, p_plus_2];
  };
  
  let displayPhotoUrl = '';
  let displayPhotoCreatedAt = null;
  let displayPhotoId = null;

  const fileIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\w+$/i;

  if (viewedPhotoFromCollection) {
    displayPhotoUrl = viewedPhotoFromCollection.url;
    displayPhotoCreatedAt = viewedPhotoFromCollection.created_at;
    displayPhotoId = viewedPhotoFromCollection.id;
  } else if (typeof viewingPhotoId === 'string' && fileIdRegex.test(viewingPhotoId)) {
    displayPhotoUrl = `${import.meta.env.VITE_API_URL || 'https://api.whitea.cloud'}/uploads/${viewingPhotoId}`;
    displayPhotoId = viewingPhotoId; 
    displayPhotoCreatedAt = new Date().toISOString(); 
  }

  const handleDeletePhotos = useCallback(() => {
    if (displayPhotoId && typeof displayPhotoId === 'number') { 
      onDeletePhotos([displayPhotoId]);
      onNavigate('collection'); 
    } else {
      alert("Невозможно удалить внешнюю фотографию.");
    }
  }, [displayPhotoId, onDeletePhotos, onNavigate]);

  const handleFavoriteToggle = useCallback(() => {
    if (displayPhotoId && typeof displayPhotoId === 'number') {
      onFavoriteToggle(displayPhotoId);
    }
  }, [displayPhotoId, onFavoriteToggle]);

  const isFavorite = displayPhotoId && typeof displayPhotoId === 'number' && favoritePhotoIds && favoritePhotoIds.has(displayPhotoId);

  const handleInfoClick = async () => {
    if (!displayPhotoId || typeof displayPhotoId !== 'number') {
      return;
    }
    
    try {
      const data = await apiClient.getPhotoMetadata(displayPhotoId);
      setMetadata(data);
      setEditDescription(data.description || '');
      setEditTags(data.tags ? data.tags.join(', ') : '');
      setEditIsPublic(data.is_public || false);
      setShowMetadataModal(true);
      setIsEditingMetadata(false);
    } catch (error) {
      console.error('Error loading metadata:', error);
      alert('Не удалось загрузить информацию о фото');
    }
  };

  const handleSaveMetadata = async () => {
    if (!displayPhotoId || typeof displayPhotoId !== 'number') {
      return;
    }
    
    setIsSavingMetadata(true);
    try {
      const tagsArray = editTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      const updatedData = await apiClient.updatePhotoMetadata(
        displayPhotoId,
        editDescription,
        tagsArray,
        editIsPublic
      );
      
      setMetadata({
        ...metadata,
        description: updatedData.description,
        tags: updatedData.tags,
        is_public: updatedData.is_public
      });
      setIsEditingMetadata(false);
      alert('Метаданные сохранены');
    } catch (error) {
      console.error('Error saving metadata:', error);
      alert('Не удалось сохранить изменения');
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDescription(metadata.description || '');
    setEditTags(metadata.tags ? metadata.tags.join(', ') : '');
    setEditIsPublic(metadata.is_public || false);
    setIsEditingMetadata(false);
  };

  return (
    <div className="view-screen">
      <Panel mode="primary" className="collection-header">
        <Container>
          <div className="header-content">
            <button 
              className="icon-btn"
              onClick={() => onNavigate('collection')}
            >
              🔙
            </button>
            <Typography.Title level={2} className="header-title">
              {displayPhotoCreatedAt ? new Date(displayPhotoCreatedAt).toLocaleDateString() : 'Загрузка...'}
              <h6>{displayPhotoCreatedAt ? new Date(displayPhotoCreatedAt).toLocaleTimeString() : '...'}</h6>
            </Typography.Title>
            
            <div className="header-actions">
              <button 
                className="icon-btn" 
                onClick={handleFavoriteToggle}
                style={{ fontSize: '24px' }}
              >
                {isFavorite ? '❤️' : '🤍'}
              </button>
              <button className="icon-btn" onClick={handleInfoClick}>
                ℹ
              </button>
            </div>
          </div>
        </Container>
      </Panel>

      <div 
        className={`showImageContainer ${viewedPhotoFromCollection?.is_imported ? 'imported-photo' : ''}`} 
        onTouchStart={handleTouchStart} 
        onTouchEnd={handleTouchEnd}
      >
        {displayPhotoUrl && <img key={displayPhotoId} src={displayPhotoUrl} alt="" />}
        {viewedPhotoFromCollection?.is_imported && (
          <div className="imported-badge">📥 Импортировано</div>
        )}
      </div>

      <Panel mode="primary" className="bottom-nav">
        <Container>
          <div className="nav-items-preview">
            {getPreviewPhotos().map((element, index) => (
              element ? (
                <img 
                  className={`nav-img-preview ${element.id === displayPhotoId ? 'selected' : ''} ${element.is_imported ? 'imported' : ''}`}
                  key={`${element.id}-${index}`} 
                  src={element.url} 
                  alt="" 
                  onClick={() => handlePreviewClick(element.id)}
                />
              ) : (
                <div key={`placeholder-${index}`} className="nav-img-preview placeholder" />
              )
            ))}
          </div>
        </Container>
      </Panel>

      <Panel mode="tertiary" className="bottom-nav">
        <Container>
          <div className="nav-items">
            {profileUserId ? (
              <button 
                className="nav-item" 
                onClick={handleRequestPhoto}
                disabled={isRequesting}
              >
                <span className="nav-icon">📥</span>
                <span className="nav-label">{isRequesting ? 'Отправка...' : 'Запросить фото'}</span>
              </button>
            ) : (
              <button className="nav-item" onClick={handleSharePhoto}>
                <span className="nav-icon">💌</span>
                <span className="nav-label">Поделиться</span>
              </button>
            )}
            {!profileUserId && (
              <button className="nav-item"
                onClick={handleDeletePhotos}>
                <span className="nav-icon">🧺</span>
                <span className="nav-label">Удалить</span>
              </button>
            )}
          </div>
        </Container>
      </Panel>

      {showQRCode && shareToken && displayPhotoUrl && viewedPhotoFromCollection && (
        <div className="modal-overlay" onClick={() => setShowQRCode(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Typography.Title level={3}>Поделиться Фото</Typography.Title>
            <div className="qr-display-section">
              <QRCodeSVG
                value={`trade:${shareToken}`}
                size={256}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                includeMargin={true}
              />
              <Typography.Body size="s" className="qr-hint">
                Отсканируйте QR-код, чтобы получить фото
              </Typography.Body>
            </div>
            <div className="modal-actions">
              <Button
                mode="secondary"
                onClick={() => setShowQRCode(false)}
              >
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}

      {showMetadataModal && (
        <div className="modal-overlay" onClick={() => setShowMetadataModal(false)}>
          <div className="modal-content metadata-modal" onClick={(e) => e.stopPropagation()}>
            <Typography.Title level={3}>Информация о фото</Typography.Title>
            
            {isEditingMetadata ? (
              <div className="metadata-edit">
                <div className="metadata-field">
                  <Typography.Body size="m" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                    Описание:
                  </Typography.Body>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Добавьте описание фотографии..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid #ccc',
                      fontSize: '14px',
                      resize: 'vertical'
                    }}
                  />
                </div>
                
                <div className="metadata-field" style={{ marginTop: '16px' }}>
                  <Typography.Body size="m" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                    Теги (через запятую):
                  </Typography.Body>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="например: природа, закат, пляж"
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid #ccc',
                      fontSize: '14px'
                    }}
                  />
                </div>
                
                {metadata.can_edit_public && (
                  <div className="metadata-field" style={{ marginTop: '16px' }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '12px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: editIsPublic ? '#f0f9ff' : 'white'
                    }}>
                      <div>
                        <Typography.Body size="m" style={{ fontWeight: 'bold' }}>
                          Публичное фото
                        </Typography.Body>
                        <Typography.Body size="s" style={{ color: '#666', marginTop: '4px' }}>
                          Доступно всем, у кого есть доступ к профилю
                        </Typography.Body>
                      </div>
                      <input
                        type="checkbox"
                        checked={editIsPublic}
                        onChange={(e) => setEditIsPublic(e.target.checked)}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer'
                        }}
                      />
                    </label>
                  </div>
                )}
                
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <Button
                    mode="primary"
                    onClick={handleSaveMetadata}
                    disabled={isSavingMetadata}
                  >
                    {isSavingMetadata ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                  <Button
                    mode="secondary"
                    onClick={handleCancelEdit}
                    disabled={isSavingMetadata}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <div className="metadata-view">
                <div className="metadata-field">
                  <Typography.Body size="m" style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    Описание:
                  </Typography.Body>
                  <Typography.Body size="m">
                    {metadata.description || 'Нет описания'}
                  </Typography.Body>
                </div>
                
                <div className="metadata-field" style={{ marginTop: '16px' }}>
                  <Typography.Body size="m" style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    Теги:
                  </Typography.Body>
                  {metadata.tags && metadata.tags.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {metadata.tags.map((tag, index) => (
                        <span
                          key={index}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#e0e7ff',
                            borderRadius: '16px',
                            fontSize: '14px',
                            color: '#4338ca'
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <Typography.Body size="m">Нет тегов</Typography.Body>
                  )}
                </div>
                
                <div className="metadata-field" style={{ marginTop: '16px' }}>
                  <Typography.Body size="m" style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    Статус:
                  </Typography.Body>
                  <Typography.Body size="m" style={{ 
                    color: metadata.is_public ? '#059669' : '#6b7280',
                    fontWeight: metadata.is_public ? 'bold' : 'normal'
                  }}>
                    {metadata.is_public ? '🌐 Публичное фото' : '🔒 Приватное фото'}
                  </Typography.Body>
                  {metadata.is_public && (
                    <Typography.Body size="s" style={{ color: '#666', marginTop: '4px' }}>
                      Доступно всем, у кого есть доступ к вашему профилю
                    </Typography.Body>
                  )}
                </div>
                
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  {metadata.can_edit && (
                    <Button
                      mode="primary"
                      onClick={() => setIsEditingMetadata(true)}
                    >
                      Редактировать
                    </Button>
                  )}
                  <Button
                    mode="secondary"
                    onClick={() => setShowMetadataModal(false)}
                  >
                    Закрыть
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default ViewingScreen;