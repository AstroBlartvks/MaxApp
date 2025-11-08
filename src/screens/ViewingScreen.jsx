import { Button, Panel, Typography, Container, IconButton } from '@maxhub/max-ui';
import './ViewingScreen.css';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const deselectAllPhotos = (setPhotos) => {
  setPhotos(prevPhotos => 
    prevPhotos.map(photo => ({
      ...photo,
      selected: false
    }))
  );
};

function ViewingScreen({ USERID, photos, onNavigate, setPhotos, onSelectPhoto }) { 

  const [showQRCode, setShowQRCode] = useState(false);
  const handlePreviewClick = (clickedPhotoId) => {
    if (onSelectPhoto) {
      onSelectPhoto(clickedPhotoId);
    }
  };

  const getPreviewPhotos = () => {
    const selectedIndex = photos.findIndex(photo => photo.selected);
    
    if (selectedIndex === -1) {
      return photos.slice(0, 5);
    }

    let startIndex = selectedIndex - 2;
    let endIndex = selectedIndex + 3;

    if (startIndex < 0) {
      startIndex = 0;
      endIndex = Math.min(5, photos.length);
    }
    
    if (endIndex > photos.length) {
      endIndex = photos.length;
      startIndex = Math.max(0, endIndex - 5);
    }

    return photos.slice(startIndex, endIndex);
  };

  return (
    <div className="view-screen">
      <Panel mode="primary" className="collection-header">
        <Container>
          <div className="header-content">
            <button 
              className="icon-btn"
              onClick={() => {
                deselectAllPhotos(setPhotos);
                onNavigate('collection');
              }}
            >
              🔙
            </button>
            <Typography.Title level={2} className="header-title">
              Вчера
              <h6>23:30</h6>
            </Typography.Title>
            
            <div className="header-actions">
              <button className="icon-btn">
                ❤️
              </button>
              <button className="icon-btn">
                ℹ
              </button>
            </div>
          </div>
        </Container>
      </Panel>

      <div className="showImageContainer">
        {photos.map(element => {
          if (element.selected) {
            return <img key={element.id} src={element.url} alt="" />;
          }
          return null;
        })}
      </div>

      <Panel mode="primary" className="bottom-nav">
        <Container>
          <div className="nav-items-preview">
            {getPreviewPhotos().map(element => (
              <img 
                className={`nav-img-preview ${element.selected ? 'selected' : ''}`}
                key={element.id} 
                src={element.url} 
                alt="" 
                onClick={() => handlePreviewClick(element.id)}
              />
            ))}
          </div>
        </Container>
      </Panel>

      <Panel mode="tertiary" className="bottom-nav">
        <Container>
          <div className="nav-items">
            <button className="nav-item" onClick={() => setShowQRCode(true)}>
              <span className="nav-icon">💌</span>
              <span className="nav-label">Поделиться</span>
            </button>
            <button className="nav-item">
              <span className="nav-icon">📁</span>
              <span className="nav-label">Копировать</span>
            </button>
            <button className="nav-item">
              <span className="nav-icon">🧺</span>
              <span className="nav-label">Удалить</span>
            </button>
          </div>
        </Container>
      </Panel>

      {showQRCode && (
        <div className="modal-overlay" onClick={() => setShowQRCode(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Typography.Title level={3}>Поделиться</Typography.Title>
            <div>
              <h3>QR код фотографии</h3>
              <QRCodeSVG
                value={photos.map(element => {
                  if (element.selected) {
                    return element.url;
                  }
                  return null;
                })}
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

export default ViewingScreen;