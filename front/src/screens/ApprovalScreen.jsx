import { Button, Panel, Typography, Container } from '@maxhub/max-ui';
import './ViewingScreen.css';
import { useState, useEffect, useRef } from 'react';

function ApprovalScreen({ scannedTrades, onNavigate, onConfirmTrade, onRejectTrade }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const prevLengthRef = useRef(scannedTrades?.length || 0);

  useEffect(() => {
    if (prevLengthRef.current > 0 && scannedTrades.length === 0) {
      onNavigate('collection');
    }
    prevLengthRef.current = scannedTrades.length;
  }, [scannedTrades, onNavigate]);

  if (!scannedTrades || scannedTrades.length === 0) {
    return (
      <div className="view-screen">
        <Panel mode="primary" className="collection-header">
          <Container>
            <div className="header-content">
              <button className="icon-btn" onClick={() => onNavigate('collection')}>
                🔙
              </button>
              <Typography.Title level={2} className="header-title">
                Подтверждения
              </Typography.Title>
            </div>
          </Container>
        </Panel>

        <div className="empty-container">
          <Typography.Body>Нет ожидающих подтверждения</Typography.Body>
        </div>

        <Panel mode="tertiary" className="bottom-nav">
          <Container>
            <div className="nav-items">
              <button className="nav-item" onClick={() => onNavigate('collection')}>
                <span className="nav-icon">📷</span>
                <span className="nav-label">Коллекция</span>
              </button>
              <button className="nav-item" onClick={() => onNavigate('public_feed')}>
                <span className="nav-icon">🌐</span>
                <span className="nav-label">Лента</span>
              </button>
              <button className="nav-item" onClick={() => onNavigate('permissions')}>
                <span className="nav-icon">🔐</span>
                <span className="nav-label">Разрешения</span>
              </button>
            </div>
          </Container>
        </Panel>
      </div>
    );
  }

  const currentTrade = scannedTrades[currentIndex];

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStart === null || scannedTrades.length < 2) {
      return;
    }

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        if (currentIndex < scannedTrades.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
      } else {
        if (currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        }
      }
    }

    setTouchStart(null);
  };

  const handlePreviewClick = (index) => {
    setCurrentIndex(index);
  };

  const handleConfirm = async () => {
    await onConfirmTrade(currentTrade.trade_id, true);
    if (currentIndex >= scannedTrades.length - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleReject = async () => {
    await onRejectTrade(currentTrade.trade_id, false);
    if (currentIndex >= scannedTrades.length - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const getPreviewTrades = () => {
    const numTrades = scannedTrades.length;
    if (numTrades === 0) return [null, null, null, null, null];

    const p_minus_2 = currentIndex > 1 ? scannedTrades[currentIndex - 2] : null;
    const p_minus_1 = currentIndex > 0 ? scannedTrades[currentIndex - 1] : null;
    const p_0 = scannedTrades[currentIndex];
    const p_plus_1 = currentIndex < numTrades - 1 ? scannedTrades[currentIndex + 1] : null;
    const p_plus_2 = currentIndex < numTrades - 2 ? scannedTrades[currentIndex + 2] : null;

    return [p_minus_2, p_minus_1, p_0, p_plus_1, p_plus_2];
  };

  return (
    <div className="view-screen">
      <Panel mode="primary" className="collection-header">
        <Container>
          <div className="header-content">
            <button className="icon-btn" onClick={() => onNavigate('collection')}>
              🔙
            </button>
            <Typography.Title level={2} className="header-title">
              Подтверждения ({currentIndex + 1}/{scannedTrades.length})
              <h6>{currentTrade.created_at ? new Date(currentTrade.created_at).toLocaleString() : '...'}</h6>
            </Typography.Title>
            <div className="header-actions">
              <button className="icon-btn">
                ℹ
              </button>
            </div>
          </div>
        </Container>
      </Panel>

      <div className="showImageContainer" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <img
          key={currentTrade.trade_id}
          src={`${import.meta.env.VITE_API_URL || 'https://api.whitea.cloud'}/uploads/${currentTrade.file_id}`}
          alt=""
        />
      </div>

      <Panel mode="primary" className="bottom-nav">
        <Container>
          <div className="nav-items-preview">
            {getPreviewTrades().map((trade, index) => (
              trade ? (
                <img
                  className={`nav-img-preview ${trade.trade_id === currentTrade.trade_id ? 'selected' : ''}`}
                  key={`${trade.trade_id}-${index}`}
                  src={`${import.meta.env.VITE_API_URL || 'https://api.whitea.cloud'}/uploads/${trade.file_id}`}
                  alt=""
                  onClick={() => handlePreviewClick(scannedTrades.findIndex(t => t.trade_id === trade.trade_id))}
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
            <button className="nav-item" onClick={handleConfirm}>
              <span className="nav-icon">✅</span>
              <span className="nav-label">Подтвердить</span>
            </button>
            <button className="nav-item" onClick={handleReject}>
              <span className="nav-icon">❌</span>
              <span className="nav-label">Отклонить</span>
            </button>
          </div>
        </Container>
      </Panel>
    </div>
  );
}

export default ApprovalScreen;
