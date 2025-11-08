import { useState, useEffect } from 'react';
import { Button, Panel, Typography, Container, IconButton } from '@maxhub/max-ui';
import './CollectionScreen.css';
import QRCode from 'qrcode';
import { QRCodeSVG } from 'qrcode.react';

const generateQRCode = async (url = 'https://example.com') => {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000', 
        light: '#FFFFFF'
      }
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Ошибка генерации QR-кода:', error);
    throw error;
  }
};

function CollectionScreen({ USERID, photos, onToggleSelection, onAddPhoto, onDeletePhotos, onNavigate }) {
  const [viewMode, setViewMode] = useState('grid');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const selectedCount = photos.filter(p => p.selected).length;
  const hasSelected = selectedCount > 0;

  const handleFileUpload = (event) => {
  const files = event.target.files;
  if (files && files.length > 0) {
    const uploadedUrls = [];
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        uploadedUrls.push(url);
        onAddPhoto(url);
      }
    });
    
    console.log('Загружено файлов:', uploadedUrls.length);
    setShowAddDialog(false);
    
    event.target.value = '';
  }
};

  const handleDeletePhotos = () => {
    if (window.confirm(`Удалить выбранные фото (${selectedCount})?`)) {
      onDeletePhotos();
    }
  };

  return (
    <div className="collection-screen">
      <Panel mode="primary" className="collection-header">
        <Container>
          <div className="header-content">
            <Typography.Title level={2} className="header-title">
              Фото
            </Typography.Title>
            <div className="header-actions">
              <button 
                className="icon-btn"
                onClick={() => setShowAddDialog(true)}
              >
                ➕
              </button>
              <button className="icon-btn"
                onClick={() => setShowQRCode(true)}
              >
                🔍
              </button>
              <button className="icon-btn">✅</button>
              <button className="icon-btn">⋮</button>
            </div>
          </div>
          <div className="header-date">
            05.11.2025
          </div>
        </Container>
      </Panel>

      {hasSelected && (
        <Panel mode="secondary" className="selection-toolbar">
          <Container>
            <div className="toolbar-content">
              <Typography.Body>
                Выбрано: {selectedCount}
              </Typography.Body>
              <Button 
                size="s" 
                mode="destructive"
                onClick={handleDeletePhotos}
              >
                Удалить
              </Button>
            </div>
          </Container>
        </Panel>
      )}

      {/* <div className="photo-grid-container">
        <div className="photo-grid">
          {photos.map((photo) => (
            <div 
              key={photo.id} 
              className={`photo-item ${photo.selected ? 'selected' : ''}`}
              onClick={() => onToggleSelection(photo.id)}
            >
              <img src={photo.url} alt="" />
              {photo.selected && (
                <div className="selection-indicator">
                  ✓
                </div>
              )}
            </div>
          ))}
        </div>
      </div> */}

      <div className="photo-grid-container">
        <div className="photo-grid">
          {photos.map((photo) => (
            <div 
              key={photo.id} 
              className="photo-item"
              onClick={() => {onToggleSelection(photo.id), onNavigate('viewing')}}
            >
              <img src={photo.url} alt="" />
            </div>
          ))}
        </div>
      </div>

      <Panel mode="tertiary" className="bottom-nav">
        <Container>
          <div className="nav-items">
            <button 
              className="nav-item active"
              onClick={() => onNavigate('collection')}
            >
              <span className="nav-icon">📷</span>
              <span className="nav-label">Коллекция</span>
            </button>
            <button 
              className="nav-item"
              onClick={() => onNavigate('trading')}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-label">Торговля</span>
            </button>
            <button 
              className="nav-item"
              onClick={() => onNavigate('bonuses')}
            >
              <span className="nav-icon">🎁</span>
              <span className="nav-label">Бонусы</span>
            </button>
            <button 
              className="nav-item"
              onClick={() => onNavigate('history')}
            >
              <span className="nav-icon">🕐</span>
              <span className="nav-label">История</span>
            </button>
          </div>
        </Container>
      </Panel>

      {showAddDialog && (
        <div className="modal-overlay" onClick={() => setShowAddDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Typography.Title level={3}>Добавить фотографии</Typography.Title>
            <label className="file-input-label">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="file-input"
              />
              <div className="file-input-button">
                📁 Выбрать файлы
              </div>
            </label>
            <Typography.Body className="file-input-hint">
              Можно выбрать несколько картинок
            </Typography.Body>
            <div className="modal-actions">
              <Button
                mode="secondary"
                onClick={() => setShowAddDialog(false)}
              >
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      {showQRCode && (
        <div className="modal-overlay" onClick={() => setShowQRCode(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Typography.Title level={3}>Поделиться</Typography.Title>
            <div>
              <h3>QR код для коллекции</h3>
              <QRCodeSVG
                value={USERID}
                size={256}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                includeMargin={true}
              />
              <p>Сканируйте QR код для доступа</p>
            </div>
            <div className="modal-actions">
              <Button
                mode="secondary"
                onClick={() => setShowQRCode(false)}
              >
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollectionScreen;
