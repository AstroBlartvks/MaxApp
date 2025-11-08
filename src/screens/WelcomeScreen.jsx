import { Button, Container, Typography } from '@maxhub/max-ui';
import './WelcomeScreen.css';

function WelcomeScreen({ photos, onStart }) {
  return (
    <div className="welcome-screen">
      <div className="photo-grid-background">
        {photos.map((photo) => (
          <div key={photo.id} className="photo-cell blurred">
            <img src={photo.url} alt="" />
          </div>
        ))}
      </div>
      
      <div className="welcome-content">
        <Container className="welcome-container">
          <div className="welcome-text">
            <Typography.Title level={1} className="welcome-title">
              Добро пожаловать
            </Typography.Title>
            <Typography.Body className="welcome-subtitle">
              Ваша фотогалерея в Max
            </Typography.Body>
          </div>
          
          <Button 
            size="l" 
            mode="primary" 
            stretched
            onClick={onStart}
            className="start-button"
          >
            ▶ Начать
          </Button>
        </Container>
      </div>
    </div>
  );
}

export default WelcomeScreen;
