import { Panel, Typography, Container } from '@maxhub/max-ui';
import './PlaceholderScreen.css';

function TradingScreen({ onNavigate }) {
  return (
    <div className="placeholder-screen">
      <Panel mode="primary" className="placeholder-header">
        <Container>
          <Typography.Title level={2} className="header-title">
            Торговля
          </Typography.Title>
        </Container>
      </Panel>

      <div className="placeholder-content">
        <div className="placeholder-icon">📊</div>
        <Typography.Title level={3}>Торговля</Typography.Title>
        <Typography.Body className="placeholder-text">
          Раздел находится в разработке
        </Typography.Body>
      </div>

      <Panel mode="tertiary" className="bottom-nav">
        <Container>
          <div className="nav-items">
            <button 
              className="nav-item"
              onClick={() => onNavigate('collection')}
            >
              <span className="nav-icon">📷</span>
              <span className="nav-label">Коллекция</span>
            </button>
            <button 
              className="nav-item active"
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
    </div>
  );
}

export default TradingScreen;
