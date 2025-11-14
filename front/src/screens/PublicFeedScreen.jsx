import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Panel, Typography, Container } from '@maxhub/max-ui';
import './PublicFeedScreen.css';
import apiClient from '../api/apiClient';
import { triggerHapticNotification } from '../utils/hapticFeedback';

function PhotoModal({ photo, photos, onClose, onNavigate, onImport, onRemoveImport, currentIndex, onSetIndex }) {
  const [touchStart, setTouchStart] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  if (!photo) return null;

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
      if (diff > 0 && currentIndex < photos.length - 1) {
        onSetIndex(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        onSetIndex(currentIndex - 1);
      }
    }

    setTouchStart(null);
  };

  const truncateDescription = (text, maxLength = 50) => {
    if (!text) return 'Нет описания';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleImport = async () => {
    if (isImporting || isRemoving) return;
    setIsImporting(true);
    try {
      await onImport(photo.id);
      triggerHapticNotification('success');
    } catch (error) {
      console.error('Error importing photo:', error);
      alert(error.message || 'Не удалось импортировать фото');
    } finally {
      setIsImporting(false);
    }
  };

  const handleRemoveImport = async () => {
    if (isImporting || isRemoving) return;
    setIsRemoving(true);
    try {
      await onRemoveImport(photo.id);
      triggerHapticNotification('success');
    } catch (error) {
      console.error('Error removing imported photo:', error);
      alert(error.message || 'Не удалось удалить фото из коллекции');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content photo-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="photo-modal-header">
          <Typography.Title level={3}>Публичное фото</Typography.Title>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        
        <div 
          className="photo-modal-image-container"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img src={photo.url} alt="" />
          {photos.length > 1 && (
            <div className="photo-modal-navigation">
              <button 
                className="nav-arrow nav-arrow-left"
                onClick={() => currentIndex > 0 && onSetIndex(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                ‹
              </button>
              <button 
                className="nav-arrow nav-arrow-right"
                onClick={() => currentIndex < photos.length - 1 && onSetIndex(currentIndex + 1)}
                disabled={currentIndex === photos.length - 1}
              >
                ›
              </button>
            </div>
          )}
        </div>

        <div className="photo-modal-info">
          <div className="photo-modal-field">
            <Typography.Body size="s" style={{ fontWeight: 'bold', color: '#666' }}>
              ID автора:
            </Typography.Body>
            <Typography.Body size="m">{photo.owner_id}</Typography.Body>
          </div>

          <div className="photo-modal-field">
            <Typography.Body size="s" style={{ fontWeight: 'bold', color: '#666' }}>
              Описание:
            </Typography.Body>
            <Typography.Body size="m">
              {truncateDescription(photo.description)}
            </Typography.Body>
          </div>

          {photo.tags && photo.tags.length > 0 && (
            <div className="photo-modal-field">
              <Typography.Body size="s" style={{ fontWeight: 'bold', color: '#666' }}>
                Теги:
              </Typography.Body>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                {photo.tags.map((tag, index) => (
                  <span key={index} className="tag-badge">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          {photo.is_imported ? (
            <Button
              mode="destructive"
              onClick={handleRemoveImport}
              disabled={isRemoving}
              stretched
            >
              {isRemoving ? 'Удаление...' : 'Удалить из коллекции'}
            </Button>
          ) : (
            <Button
              mode="primary"
              onClick={handleImport}
              disabled={isImporting}
              stretched
            >
              {isImporting ? 'Импорт...' : 'Импорт'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PublicFeedScreen({ onNavigate, onReloadPhotos }) {
  const [photos, setPhotos] = useState([]);
  const [filteredPhotos, setFilteredPhotos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [error, setError] = useState(null);
  const observerTarget = useRef(null);
  const limit = 20;

  const loadPhotos = useCallback(async (reset = false) => {
    if (isLoading && !reset) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const currentPage = reset ? 0 : page;
      const offset = currentPage * limit;
      const newPhotos = await apiClient.getPublicPhotos(limit, offset);
      
      if (reset) {
        setPhotos(newPhotos);
        setPage(1);
      } else {
        setPhotos(prev => [...prev, ...newPhotos]);
        setPage(prev => prev + 1);
      }
      
      setHasMore(newPhotos.length === limit);
    } catch (err) {
      console.error('Error loading public photos:', err);
      setError('Не удалось загрузить фотографии');
    } finally {
      setIsLoading(false);
    }
  }, [page, isLoading, limit]);

  useEffect(() => {
    loadPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPhotos(photos);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = photos.filter(photo => {
      const userIdMatch = query.match(/user[:\s]*(\d+)/i);
      const userId = userIdMatch ? parseInt(userIdMatch[1]) : null;
      
      if (userId !== null && photo.owner_id !== userId) {
        return false;
      }

      const searchText = query.replace(/user[:\s]*\d+/gi, '').trim();
      
      if (!searchText) {
        return true;
      }

      const matchesDescription = photo.description && 
        photo.description.toLowerCase().includes(searchText);
      
      const matchesTags = photo.tags && photo.tags.some(tag => 
        tag.toLowerCase().includes(searchText)
      );

      return matchesDescription || matchesTags;
    });

    setFilteredPhotos(filtered);
  }, [searchQuery, photos]);

  useEffect(() => {
    if (searchQuery.trim()) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadPhotos();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoading, loadPhotos, searchQuery]);

  const handlePhotoClick = (photo) => {
    const index = filteredPhotos.findIndex(p => p.id === photo.id);
    setSelectedPhotoIndex(index);
    setSelectedPhoto(photo);
  };

  const handleModalNavigate = (newIndex) => {
    if (newIndex >= 0 && newIndex < filteredPhotos.length) {
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(filteredPhotos[newIndex]);
    }
  };

  const handleImport = async (photoId) => {
    try {
      await apiClient.importPhoto(photoId);
      setPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, is_imported: true } : p
      ));
      setFilteredPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, is_imported: true } : p
      ));
      if (selectedPhoto && selectedPhoto.id === photoId) {
        setSelectedPhoto(prev => ({ ...prev, is_imported: true }));
      }
      if (onReloadPhotos) {
        onReloadPhotos();
      }
    } catch (error) {
      console.error('Error importing photo:', error);
      throw error; // Re-throw to be handled by modal
    }
  };

  const handleRemoveImport = async (photoId) => {
    try {
      await apiClient.removeImportedPhoto(photoId);
      setPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, is_imported: false } : p
      ));
      setFilteredPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, is_imported: false } : p
      ));
      if (selectedPhoto && selectedPhoto.id === photoId) {
        setSelectedPhoto(prev => ({ ...prev, is_imported: false }));
      }
      if (onReloadPhotos) {
        onReloadPhotos();
      }
    } catch (error) {
      console.error('Error removing imported photo:', error);
      throw error; // Re-throw to be handled by modal
    }
  };

  const handleCloseModal = () => {
    setSelectedPhoto(null);
  };

  return (
    <div className="public-feed-screen">
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
              Публичная лента
            </Typography.Title>
            <div className="header-actions"></div>
          </div>
        </Container>
      </Panel>

      <Panel mode="secondary" className="search-panel">
        <Container>
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Поиск по тегам, описанию или user:ID автора"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </Container>
      </Panel>

      {error && (
        <Panel mode="secondary" className="error-panel">
          <Container>
            <Typography.Body style={{ color: '#d32f2f' }}>{error}</Typography.Body>
          </Container>
        </Panel>
      )}

      {filteredPhotos.length > 0 ? (
        <div className="photo-grid-container">
          <div className="photo-grid">
            {filteredPhotos.map((photo) => (
              <div
                key={photo.id}
                className={`photo-item ${photo.is_imported ? 'imported' : ''}`}
                onClick={() => handlePhotoClick(photo)}
              >
                <img src={photo.url} alt="" />
                {photo.is_imported && (
                  <div className="imported-indicator">📥</div>
                )}
              </div>
            ))}
          </div>
          <div ref={observerTarget} className="observer-target">
            {isLoading && <Typography.Body>Загрузка...</Typography.Body>}
          </div>
        </div>
      ) : !isLoading ? (
        <div className="empty-container">
          <Typography.Body>
            {searchQuery ? 'Ничего не найдено' : 'Нет публичных фотографий'}
          </Typography.Body>
        </div>
      ) : (
        <div className="empty-container">
          <Typography.Body>Загрузка...</Typography.Body>
        </div>
      )}

      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          photos={filteredPhotos}
          currentIndex={selectedPhotoIndex}
          onSetIndex={handleModalNavigate}
          onClose={handleCloseModal}
          onNavigate={onNavigate}
          onImport={handleImport}
          onRemoveImport={handleRemoveImport}
        />
      )}
    </div>
  );
}

export default PublicFeedScreen;
